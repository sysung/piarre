use std::{io, path::Path};

#[cfg(target_os = "linux")]
use rustix::fs::{Mode, OFlags, ResolveFlags, open, openat2};
#[cfg(target_os = "linux")]
use std::{fs::File, io::Read, path::Component};

/// A selected directory inside the disposable Linux workspace.
pub struct Workspace {
    #[cfg(target_os = "linux")]
    root: File,
    #[cfg(not(target_os = "linux"))]
    _unsupported: std::convert::Infallible,
}

#[cfg(target_os = "linux")]
impl Workspace {
    /// Selects an existing directory using an absolute path beneath /workspace.
    pub fn select(directory: &Path) -> io::Result<Self> {
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
        let root = open_beneath(&container_root, relative, OFlags::DIRECTORY)?;
        Ok(Self { root })
    }

    /// Opens a regular file for reading using a path relative to this workspace.
    pub fn open_read(&self, relative: &Path) -> io::Result<impl Read> {
        let file = open_beneath(&self.root, relative, OFlags::NONBLOCK)?;
        if !file.metadata()?.is_file() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "workspace reads require a regular file",
            ));
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
fn open_beneath(root: &File, relative: &Path, flags: OFlags) -> io::Result<File> {
    if relative.as_os_str().is_empty()
        || relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_) | Component::CurDir))
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "use a relative workspace path without '..'",
        ));
    }

    // The kernel resolves and opens the path together, relative to the held directory.
    let file = openat2(
        root,
        relative,
        OFlags::RDONLY | OFlags::CLOEXEC | flags,
        Mode::empty(),
        ResolveFlags::BENEATH | ResolveFlags::NO_SYMLINKS | ResolveFlags::NO_XDEV,
    )?;
    Ok(File::from(file))
}
