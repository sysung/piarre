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
    pub fn open() -> Result<Self, String> {
        Self::at(Path::new("/workspace"))
    }

    fn at(path: &Path) -> Result<Self, String> {
        let fd = open(
            path,
            OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map_err(|e| format!("cannot open workspace: {e}"))?;
        Ok(Self {
            root: File::from(fd),
        })
    }

    pub fn definitions() -> Vec<ToolDefinition> {
        [
            ("list_files", "List up to 64 entries in a directory beneath /workspace. Use path '.' for the workspace root. No recursion."),
            ("read_file", "Read a UTF-8 regular file beneath /workspace, at most 4096 bytes. Paths are relative to /workspace; symlinks and traversal are forbidden."),
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
            return Err("use a relative path beneath /workspace without '..'".into());
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
    use super::*;
    use std::{
        fs,
        os::unix::{ffi::OsStringExt, fs::symlink, net::UnixListener},
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    struct Fixture(PathBuf);

    impl Fixture {
        fn new() -> Self {
            static NEXT: AtomicU64 = AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!(
                "piarre-workspace-{}-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                NEXT.fetch_add(1, Ordering::Relaxed),
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }

        fn workspace(&self) -> Workspace {
            Workspace::at(&self.0).unwrap()
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn rejected(result: Value) {
        assert_eq!(result["ok"], false, "unexpected result: {result}");
        assert!(result["error"].as_str().is_some_and(|s| !s.is_empty()));
        assert!(result.get("result").is_none());
    }

    #[test]
    fn lists_sorted_direct_children_and_reads_utf8_files() {
        let fixture = Fixture::new();
        fs::create_dir(fixture.0.join("nested")).unwrap();
        fs::write(fixture.0.join("z.txt"), "hello π\n").unwrap();
        fs::write(fixture.0.join("nested/a.txt"), "inside").unwrap();
        let workspace = fixture.workspace();
        assert_eq!(
            workspace.execute("list_files", &json!({"path":"."})),
            json!({"ok":true,"result":["nested","z.txt"]})
        );
        assert_eq!(
            workspace.execute("list_files", &json!({"path":"nested"})),
            json!({"ok":true,"result":["a.txt"]})
        );
        assert_eq!(
            workspace.execute("read_file", &json!({"path":"z.txt"})),
            json!({"ok":true,"result":"hello π\n"})
        );
        assert_eq!(
            workspace.execute("read_file", &json!({"path":"nested/a.txt"})),
            json!({"ok":true,"result":"inside"})
        );
    }

    #[test]
    fn rejects_traversal_absolute_paths_and_symlinks() {
        let fixture = Fixture::new();
        let outside = Fixture::new();
        fs::write(outside.0.join("secret"), "outside content").unwrap();
        fs::write(fixture.0.join("local"), "inside content").unwrap();
        symlink(outside.0.join("secret"), fixture.0.join("file-link")).unwrap();
        symlink(&outside.0, fixture.0.join("parent-link")).unwrap();
        symlink("local", fixture.0.join("local-link")).unwrap();
        let workspace = fixture.workspace();
        for path in [
            "../secret",
            "nested/../../secret",
            "parent-link/secret",
            "file-link",
            "local-link",
        ] {
            rejected(workspace.execute("read_file", &json!({"path":path})));
        }
        rejected(workspace.execute("read_file", &json!({"path":outside.0.join("secret")})));
        rejected(workspace.execute("list_files", &json!({"path":"parent-link"})));
        rejected(workspace.execute("list_files", &json!({"path":".."})));
        rejected(workspace.execute("list_files", &json!({"path":outside.0})));
    }

    #[test]
    fn rejects_nonregular_files_without_waiting_for_a_fifo_writer() {
        let fixture = Fixture::new();
        rustix::fs::mkfifoat(
            rustix::fs::CWD,
            fixture.0.join("pipe"),
            Mode::RUSR | Mode::WUSR,
        )
        .unwrap();
        let _socket = UnixListener::bind(fixture.0.join("socket")).unwrap();
        let workspace = fixture.workspace();
        for path in [".", "pipe", "socket", "missing"] {
            rejected(workspace.execute("read_file", &json!({"path":path})));
        }
        fs::write(fixture.0.join("file"), "text").unwrap();
        rejected(workspace.execute("list_files", &json!({"path":"file"})));
    }

    #[test]
    fn enforces_utf8_and_file_size_boundary() {
        let fixture = Fixture::new();
        let workspace = fixture.workspace();
        fs::write(fixture.0.join("text"), "a".repeat(4096)).unwrap();
        assert_eq!(
            workspace.execute("read_file", &json!({"path":"text"})),
            json!({"ok":true,"result":"a".repeat(4096)})
        );
        fs::write(fixture.0.join("text"), "a".repeat(4097)).unwrap();
        rejected(workspace.execute("read_file", &json!({"path":"text"})));
        fs::write(fixture.0.join("text"), [0xff]).unwrap();
        rejected(workspace.execute("read_file", &json!({"path":"text"})));
        fs::write(fixture.0.join("text"), "").unwrap();
        assert_eq!(
            workspace.execute("read_file", &json!({"path":"text"})),
            json!({"ok":true,"result":""})
        );
    }

    #[test]
    fn enforces_directory_entry_limit_without_truncating() {
        let fixture = Fixture::new();
        let workspace = fixture.workspace();
        assert_eq!(
            workspace.execute("list_files", &json!({"path":"."})),
            json!({"ok":true,"result":[]})
        );
        let names: Vec<_> = (0..64).map(|i| format!("file-{i:02}")).collect();
        for name in &names {
            fs::write(fixture.0.join(name), "").unwrap();
        }
        assert_eq!(
            workspace.execute("list_files", &json!({"path":"."})),
            json!({"ok":true,"result":names})
        );
        fs::write(fixture.0.join("extra"), "").unwrap();
        rejected(workspace.execute("list_files", &json!({"path":"."})));
    }

    #[test]
    fn bounds_serialized_results_and_rejects_non_utf8_names() {
        let fixture = Fixture::new();
        let workspace = fixture.workspace();
        fs::write(fixture.0.join("escaped"), vec![0; 4096]).unwrap();
        rejected(workspace.execute("read_file", &json!({"path":"escaped"})));
        for i in 0..40 {
            fs::write(fixture.0.join(format!("{i:02}{}", "x".repeat(220))), "").unwrap();
        }
        rejected(workspace.execute("list_files", &json!({"path":"."})));

        let invalid_name = Fixture::new();
        fs::write(
            invalid_name
                .0
                .join(std::ffi::OsString::from_vec(vec![0xff])),
            "",
        )
        .unwrap();
        rejected(
            invalid_name
                .workspace()
                .execute("list_files", &json!({"path":"."})),
        );
    }

    #[test]
    fn rejects_unknown_tools_and_malformed_arguments() {
        let fixture = Fixture::new();
        let workspace = fixture.workspace();
        rejected(workspace.execute("write_file", &json!({"path":"."})));
        for arguments in [
            Value::Null,
            json!([]),
            json!({}),
            json!({"path":1}),
            json!({"path":".","extra":true}),
            json!({"other":"."}),
            json!({"path":""}),
            json!({"path":"a".repeat(1025)}),
            json!({"path":"a\u{0000}b"}),
        ] {
            for name in ["list_files", "read_file"] {
                rejected(workspace.execute(name, &arguments));
            }
        }
    }
}
