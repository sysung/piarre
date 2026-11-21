use std::{
    io,
    path::{Path, PathBuf},
};

#[cfg(target_os = "linux")]
use rustix::{
    fd::OwnedFd,
    fs::{Mode, OFlags, ResolveFlags, open, openat2},
};
#[cfg(target_os = "linux")]
use std::{
    fs::File,
    io::{Read, Write},
    os::unix::fs::MetadataExt,
    path::Component,
};

/// A directory selected for workspace access inside the Linux container.
pub struct Workspace {
    #[cfg(target_os = "linux")]
    root: OwnedFd,
    #[cfg(target_os = "linux")]
    directory: PathBuf,
    #[cfg(not(target_os = "linux"))]
    _unsupported: std::convert::Infallible,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FileAccess {
    Read,
    Write,
}

impl FileAccess {
    fn verb(self) -> &'static str {
        match self {
            Self::Read => "read",
            Self::Write => "write",
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AccessError {
    #[error("approval required to {} {}", .access.verb(), .path.display())]
    ApprovalRequired { path: PathBuf, access: FileAccess },
    #[error(transparent)]
    Io(#[from] io::Error),
}

#[cfg(target_os = "linux")]
impl Workspace {
    /// Selects an existing directory using an absolute path beneath /workspace.
    ///
    /// # Errors
    ///
    /// Fails if the path is outside the mount, contains traversal, or cannot be opened
    /// as a directory under the workspace resolution rules.
    pub fn select(directory: &Path) -> io::Result<Self> {
        const MOUNT: &str = "/workspace";

        reject_traversal(directory)?;
        let relative = directory.strip_prefix(MOUNT).map_err(|_| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "use /workspace or an absolute path beneath it",
            )
        })?;
        // Linux rejects an empty pathname. Use "." to select the mount itself.
        let relative = if relative.as_os_str().is_empty() {
            Path::new(".")
        } else {
            relative
        };
        let directory_flags = OFlags::RDONLY | OFlags::DIRECTORY;
        let mount = open(
            MOUNT,
            directory_flags | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        )?;
        let root = open_beneath(&mount, relative, directory_flags)?;
        Ok(Self {
            root,
            directory: directory.to_owned(),
        })
    }

    /// Opens an existing regular file in the selected directory for reading.
    pub fn open_read(&self, path: &Path) -> Result<impl Read, AccessError> {
        self.open_regular(path, FileAccess::Read)
    }

    /// Opens an existing regular file for writing without truncating it.
    pub fn open_write(&self, path: &Path) -> Result<impl Write, AccessError> {
        self.open_regular(path, FileAccess::Write)
    }

    fn open_regular(&self, path: &Path, access: FileAccess) -> Result<File, AccessError> {
        reject_traversal(path)?;
        let relative = if path.is_absolute() {
            path.strip_prefix(&self.directory)
                .map_err(|_| AccessError::ApprovalRequired {
                    path: path.to_owned(),
                    access,
                })?
        } else {
            path
        };
        let mode = match access {
            FileAccess::Read => OFlags::RDONLY,
            FileAccess::Write => OFlags::WRONLY,
        };
        // Avoid waiting on a pipe before we can check the file type.
        let file = File::from(open_beneath(&self.root, relative, mode | OFlags::NONBLOCK)?);
        let metadata = file.metadata()?;
        if !metadata.is_file() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "workspace access requires a regular file",
            )
            .into());
        }
        if access == FileAccess::Write && metadata.nlink() > 1 {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "workspace writes require a file without other hard links",
            )
            .into());
        }
        Ok(file)
    }
}

#[cfg(not(target_os = "linux"))]
impl Workspace {
    /// Workspace selection requires the Linux container.
    pub fn select(_: &Path) -> io::Result<Self> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "workspace selection requires the Linux container",
        ))
    }
}

#[cfg(target_os = "linux")]
fn reject_traversal(path: &Path) -> io::Result<()> {
    if path.components().any(|part| part == Component::ParentDir) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "workspace paths must not contain '..'",
        ));
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn open_beneath(root: &OwnedFd, relative: &Path, flags: OFlags) -> io::Result<OwnedFd> {
    // The kernel resolves and opens the path together, relative to the held directory.
    openat2(
        root,
        relative,
        OFlags::CLOEXEC | flags,
        Mode::empty(),
        ResolveFlags::BENEATH | ResolveFlags::NO_SYMLINKS | ResolveFlags::NO_XDEV,
    )
    .map_err(Into::into)
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::{AccessError, FileAccess, Workspace};
    use std::{
        error::Error,
        fs::{self, File},
        io::{self, Write},
        os::unix::fs::symlink,
        path::Path,
    };

    #[test]
    #[ignore = "run in Docker with an empty host fixture mounted at /workspace"]
    fn reads_and_writes_inside_the_workspace() -> Result<(), Box<dyn Error>> {
        let workspace = Workspace::select(Path::new("/workspace"))?;
        let notes = Path::new("notes.txt");
        File::create_new("/workspace/notes.txt")?.write_all(b"before\n")?;

        assert_eq!(io::read_to_string(workspace.open_read(notes)?)?, "before\n");
        workspace
            .open_write(Path::new("/workspace/notes.txt"))?
            .write_all(b"edited\n")?;
        assert_eq!(io::read_to_string(workspace.open_read(notes)?)?, "edited\n");
        Ok(())
    }

    #[test]
    #[ignore = "run in Docker with an empty host fixture mounted at /workspace"]
    fn outside_reads_and_writes_require_approval() -> Result<(), Box<dyn Error>> {
        let selected = Path::new("/workspace/samples");
        let sibling = Path::new("/workspace/outside.txt");
        fs::create_dir(selected)?;
        File::create_new(sibling)?.write_all(b"outside\n")?;
        symlink("../outside.txt", selected.join("link"))?;
        fs::hard_link(sibling, selected.join("alias"))?;
        let workspace = Workspace::select(selected)?;

        assert!(matches!(
            workspace.open_read(sibling),
            Err(AccessError::ApprovalRequired { path, access: FileAccess::Read }) if path == sibling
        ));
        assert!(matches!(
            workspace.open_write(sibling),
            Err(AccessError::ApprovalRequired { path, access: FileAccess::Write }) if path == sibling
        ));
        for path in [Path::new("../outside.txt"), Path::new("link")] {
            assert!(matches!(workspace.open_read(path), Err(AccessError::Io(_))));
            assert!(matches!(
                workspace.open_write(path),
                Err(AccessError::Io(_))
            ));
        }
        assert!(matches!(
            workspace.open_write(Path::new("alias")),
            Err(AccessError::Io(error)) if error.kind() == io::ErrorKind::PermissionDenied
        ));
        assert_eq!(fs::read(sibling)?, b"outside\n");
        Ok(())
    }
}
