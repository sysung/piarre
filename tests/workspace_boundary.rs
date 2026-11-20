#![cfg(target_os = "linux")]

use piarre::workspace::{AccessError, FileAccess, Workspace};
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
