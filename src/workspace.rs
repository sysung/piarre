use std::{
    io,
    path::{Path, PathBuf},
};

#[cfg(target_os = "linux")]
use rustix::fs::{Mode, OFlags, ResolveFlags, open, openat2};
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
    root: File,
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
    pub fn select(directory: &Path) -> io::Result<Self> {
        reject_traversal(directory)?;
        let relative = directory.strip_prefix("/workspace").map_err(|_| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "use /workspace or an absolute path beneath it",
            )
        })?;
        let relative = if relative.as_os_str().is_empty() {
            Path::new(".")
        } else {
            relative
        };
        let container_root = File::from(open(
            "/workspace",
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        )?);
        let root = open_beneath(
            &container_root,
            relative,
            OFlags::RDONLY | OFlags::DIRECTORY,
        )?;
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
        let file = open_beneath(&self.root, relative, mode | OFlags::NONBLOCK)?;
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
fn open_beneath(root: &File, relative: &Path, flags: OFlags) -> io::Result<File> {
    // The kernel resolves and opens the path together, relative to the held directory.
    let file = openat2(
        root,
        relative,
        OFlags::CLOEXEC | flags,
        Mode::empty(),
        ResolveFlags::BENEATH | ResolveFlags::NO_SYMLINKS | ResolveFlags::NO_XDEV,
    )?;
    Ok(File::from(file))
}
