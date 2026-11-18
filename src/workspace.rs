use rig_core::completion::{ToolDefinition, message::ToolName};
use rustix::fs::{Dir, Mode, OFlags, ResolveFlags, open, openat2};
use serde_json::{Value, json};
use std::{
    fs::File,
    io::Read,
    path::{Component, Path},
};

pub const MAX_CALLS: usize = 4;
const MAX_FILE: usize = 4096;
const MAX_ENTRIES: usize = 64;
const MAX_OUTPUT: usize = 8192;

pub struct Workspace {
    root: File,
}

impl Workspace {
    pub fn open(path: &str) -> Result<Self, String> {
        let relative = Path::new(path)
            .strip_prefix("/workspace")
            .map_err(|_| "workspace directory must be /workspace or a directory beneath it")?;
        let root = open(
            "/workspace",
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map_err(|e| format!("cannot open workspace: {e}"))?;
        let path = relative;
        if path
            .components()
            .any(|c| !matches!(c, Component::Normal(_) | Component::CurDir))
        {
            return Err("workspace directory must not contain '..'".into());
        }
        let path = if path.as_os_str().is_empty() {
            Path::new(".")
        } else {
            path
        };
        let fd = openat2(
            &root,
            path,
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::CLOEXEC,
            Mode::empty(),
            ResolveFlags::BENEATH | ResolveFlags::NO_SYMLINKS | ResolveFlags::NO_XDEV,
        )
        .map_err(|e| format!("cannot select workspace directory: {e}"))?;
        Ok(Self {
            root: File::from(fd),
        })
    }

    pub fn definitions() -> Vec<ToolDefinition> {
        [
            ("list_files", "List up to 64 entries in a directory beneath the selected workspace. Use path '.' for the workspace root. No recursion."),
            ("read_file", "Read a UTF-8 regular file beneath the selected workspace, at most 4096 bytes. Paths are relative to the selected workspace; symlinks and traversal are forbidden."),
        ].into_iter().map(|(name, description)| ToolDefinition::new(
            ToolName::new(name).expect("static tool name"), description,
            json!({"type":"object", "properties":{"path":{"type":"string"}}, "required":["path"], "additionalProperties":false}),
        )).collect()
    }

    pub fn execute(&self, name: &str, arguments: &Value) -> Value {
        match self.run(name, arguments) {
            Ok(value) => json!({"ok": true, "result": value}),
            Err(error) => json!({"ok": false, "error": error}),
        }
    }

    fn run(&self, name: &str, arguments: &Value) -> Result<Value, String> {
        if !matches!(name, "list_files" | "read_file") {
            return Err("unknown workspace tool".into());
        }
        let args = arguments.as_object().ok_or("expected a path object")?;
        if args.len() != 1 {
            return Err("expected only the path argument".into());
        }
        let path = args
            .get("path")
            .and_then(Value::as_str)
            .ok_or("path must be a string")?;
        if path.is_empty()
            || path.len() > 1024
            || Path::new(path)
                .components()
                .any(|c| !matches!(c, Component::Normal(_) | Component::CurDir))
        {
            return Err("use a relative path beneath the selected workspace without '..'".into());
        }
        let mut flags = OFlags::RDONLY | OFlags::NONBLOCK | OFlags::CLOEXEC;
        if name == "list_files" {
            flags |= OFlags::DIRECTORY;
        }
        let fd = openat2(
            &self.root,
            path,
            flags,
            Mode::empty(),
            ResolveFlags::BENEATH | ResolveFlags::NO_SYMLINKS | ResolveFlags::NO_XDEV,
        )
        .map_err(|e| format!("cannot open workspace path: {e}"))?;
        let file = File::from(fd);
        let value = if name == "read_file" {
            if !file.metadata().map_err(|e| e.to_string())?.is_file() {
                return Err("read_file accepts regular files only".into());
            }
            let mut bytes = Vec::new();
            file.take((MAX_FILE + 1) as u64)
                .read_to_end(&mut bytes)
                .map_err(|e| e.to_string())?;
            if bytes.len() > MAX_FILE {
                return Err("file exceeds 4096 bytes".into());
            }
            json!(String::from_utf8(bytes).map_err(|_| "file is not UTF-8 text")?)
        } else {
            let mut entries = Vec::new();
            for entry in Dir::read_from(&file).map_err(|e| e.to_string())? {
                let entry = entry.map_err(|e| e.to_string())?;
                let name = entry
                    .file_name()
                    .to_str()
                    .map_err(|_| "filename is not UTF-8")?;
                if name == "." || name == ".." {
                    continue;
                }
                if entries.len() == MAX_ENTRIES {
                    return Err("directory exceeds 64 entries; choose a smaller directory".into());
                }
                entries.push(name.to_owned());
            }
            entries.sort();
            json!(entries)
        };
        if value.to_string().len() > MAX_OUTPUT - 64 {
            return Err("tool result exceeds output limit".into());
        }
        Ok(value)
    }
}

#[cfg(test)]
mod tests {
    use super::Workspace;
    use serde_json::json;
    use std::{
        fs,
        os::unix::fs::symlink,
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
    };

    struct Fixture(PathBuf);

    impl Fixture {
        fn new() -> Self {
            static NEXT: AtomicU64 = AtomicU64::new(0);
            let path = PathBuf::from(format!(
                "/workspace/piarre-test-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).expect("run workspace tests in Linux with a writable /workspace");
            fs::create_dir(path.join("selected")).unwrap();
            Self(path)
        }

        fn selected(&self) -> String {
            self.0.join("selected").to_str().unwrap().to_owned()
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn user_can_list_and_read_files_in_the_selected_directory() {
        let fixture = Fixture::new();
        fs::create_dir(fixture.0.join("selected/nested")).unwrap();
        fs::write(fixture.0.join("selected/notes.txt"), "hello π\n").unwrap();
        fs::write(
            fixture.0.join("selected/nested/child.txt"),
            "nested content",
        )
        .unwrap();
        let workspace = Workspace::open(&fixture.selected()).unwrap();
        assert_eq!(
            workspace.execute("list_files", &json!({"path":"."})),
            json!({"ok":true,"result":["nested","notes.txt"]})
        );
        assert_eq!(
            workspace.execute("list_files", &json!({"path":"nested"})),
            json!({"ok":true,"result":["child.txt"]})
        );
        assert_eq!(
            workspace.execute("read_file", &json!({"path":"notes.txt"})),
            json!({"ok":true,"result":"hello π\n"})
        );
        assert_eq!(
            workspace.execute("read_file", &json!({"path":"nested/child.txt"})),
            json!({"ok":true,"result":"nested content"})
        );
    }

    #[test]
    fn user_cannot_read_or_list_outside_the_selected_directory() {
        let fixture = Fixture::new();
        fs::write(fixture.0.join("outside.txt"), "private outside content").unwrap();
        symlink(
            fixture.0.join("outside.txt"),
            fixture.0.join("selected/file-link"),
        )
        .unwrap();
        symlink(&fixture.0, fixture.0.join("selected/parent-link")).unwrap();
        let workspace = Workspace::open(&fixture.selected()).unwrap();
        for path in [
            "../outside.txt".to_owned(),
            fixture.0.join("outside.txt").to_str().unwrap().to_owned(),
            "file-link".into(),
            "parent-link/outside.txt".into(),
        ] {
            let result = workspace.execute("read_file", &json!({"path":path}));
            assert_eq!(result["ok"], false, "{path}: {result}");
            assert!(result.get("result").is_none());
        }
        for path in ["..", "parent-link"] {
            assert_eq!(
                workspace.execute("list_files", &json!({"path":path}))["ok"],
                false
            );
        }
    }

    #[test]
    fn invalid_directory_selection_is_rejected() {
        let fixture = Fixture::new();
        fs::write(fixture.0.join("file.txt"), "not a directory").unwrap();
        symlink(&fixture.0, fixture.0.join("link")).unwrap();
        for path in [
            "/etc".to_owned(),
            "".into(),
            fixture.0.join("missing").to_str().unwrap().into(),
            fixture.0.join("file.txt").to_str().unwrap().into(),
            fixture.0.join("selected/..").to_str().unwrap().into(),
            fixture.0.join("link/selected").to_str().unwrap().into(),
        ] {
            assert!(Workspace::open(&path).is_err(), "accepted {path}");
        }
    }
}
