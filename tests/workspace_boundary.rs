#![cfg(target_os = "linux")]

use piarre::workspace::Workspace;
use std::{
    fs::{self, File},
    io::{self, Read, Write},
    os::unix::fs::symlink,
    path::Path,
};

#[test]
#[ignore = "run in Piarre's disposable Docker workspace"]
fn reads_stay_in_the_selected_workspace() -> io::Result<()> {
    let root = Path::new("/workspace");
    let selected = root.join("samples");
    let sibling = root.join("other.txt");
    fs::create_dir(&selected)?;
    fs::create_dir(selected.join("nested"))?;
    fs::write(selected.join("notes.txt"), b"inside notes\n")?;
    fs::write(selected.join("nested/notes.txt"), b"nested notes\n")?;
    File::create_new(&sibling)?.write_all(b"outside notes\n")?;
    symlink("../other.txt", selected.join("other-link"))?;
    symlink("..", selected.join("parent-link"))?;

    for target in [
        &sibling,
        &selected.join("other-link"),
        &selected.join("parent-link/other.txt"),
    ] {
        assert_eq!(fs::read(target)?, b"outside notes\n");
    }

    let workspace = Workspace::select(&selected)?;
    for (path, expected) in [
        ("notes.txt", "inside notes\n"),
        ("nested/notes.txt", "nested notes\n"),
    ] {
        let mut contents = String::new();
        workspace
            .open_read(Path::new(path))?
            .read_to_string(&mut contents)?;
        assert_eq!(contents, expected);
        eprintln!("read {path}: {contents:?}");
    }

    for path in [
        "/workspace/other.txt",
        "../other.txt",
        "other-link",
        "parent-link/other.txt",
        "nested",
    ] {
        let Err(error) = workspace.open_read(Path::new(path)) else {
            panic!("workspace unexpectedly opened {path}");
        };
        eprintln!("denied {path}: {error}");
    }
    Ok(())
}
