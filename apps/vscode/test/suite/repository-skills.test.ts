import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isEligibleContextPath, isRepositorySkillPath, portableContextPath } from "../../../../packages/core/src/context-path.js";
import { pathToFileURL } from "node:url";
import * as vscode from "vscode";
import { replay, type ProjectSnapshot } from "../../../../packages/core/src/index.js";
import { parseSuppliedSources } from "../../../../packages/core/src/supplied-source.js";
import { captureRepositorySkill, discoverRepositorySkills } from "../../src/repository-skills.js";
import { ProjectRetrieval } from "../../src/project-retrieval.js";

suite("Repository skill excerpts", () => {
  let root: string;
  let project: ProjectSnapshot;
  const add = (relative: string, text = "# Skill\nRead the current source before editing.\n"): void => {
    const absolute = path.join(root, relative);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, text);
  };
  setup(() => {
    root = mkdtempSync(path.join(tmpdir(), "piarre-skills-"));
    project = replay([{ kind: "project-created", projectId: "skill-project", repositoryUri: pathToFileURL(root).href, name: "Skills" }]);
    add("docs/python/SKILL.md");
    add(".agents/skills/local-check/SKILL.md");
  });
  teardown(() => { rmSync(root, { recursive: true, force: true }); });

  test("normalizes Windows filesystem paths at capture boundaries while stored references stay portable", () => {
    const native = path.win32.relative("C:\\workspace", path.win32.join("C:\\workspace", "src", "main.py"));
    assert.equal(isEligibleContextPath(native), false);
    assert.equal(portableContextPath(native, path.win32.sep), "src/main.py");
    assert.equal(isEligibleContextPath(portableContextPath(native, path.win32.sep)), true);
    const skill = path.win32.join(".agents", "skills", "local-check", "SKILL.md");
    assert.equal(isRepositorySkillPath(skill), false);
    assert.equal(isRepositorySkillPath(portableContextPath(skill, path.win32.sep)), true);
    assert.equal(path.posix.join(".agents/skills", "local-check", "SKILL.md"), ".agents/skills/local-check/SKILL.md");
  });

  test("discovers and captures only repository skills as parsed, immutable file evidence", () => {
    const skills = discoverRepositorySkills(project);
    assert.deepEqual(skills.map(skill => skill.path).sort(), [".agents/skills/local-check/SKILL.md", "docs/python/SKILL.md"]);
    assert.ok(skills.every(skill => skill.label.includes("excerpt")));
    const source = captureRepositorySkill(project, ".agents/skills/local-check/SKILL.md");
    assert.deepEqual(parseSuppliedSources([source]), [source]);
    assert.equal(source.reference.kind, "file");
    assert.equal(source.reference.version, "worktree-at-capture");
    assert.equal(source.reference.projectId, project.projectId);
    assert.equal(source.text, "# Skill\nRead the current source before editing.\n");
    const index = new ProjectRetrieval({ projectId: project.projectId, root });
    try { index.assertCapturedCurrent([source]); }
    finally { index.dispose(); }
  });

  test("rejects traversal, near misses, hidden roots, generated and secret-named paths at capture and parse boundaries", () => {
    const rejected = [".agents/skills/local-check/notes.md", ".agents/skills/local-check/nested/SKILL.md", ".agents/skills/secret-check/SKILL.md", ".agents/skills/local.check/SKILL.md",
      ".agents/other/SKILL.md", ".agents-other/skills/check/SKILL.md", ".github/skills/check/SKILL.md", ".codex/skills/check/SKILL.md", "node_modules/check/SKILL.md", "docs/passwords/SKILL.md"];
    for (const relative of rejected) add(relative, "Never share this\n");
    assert.equal(discoverRepositorySkills(project).length, 2);
    const source = captureRepositorySkill(project, "docs/python/SKILL.md");
    for (const relative of [...rejected, "../SKILL.md", "docs/../docs/python/SKILL.md", "/tmp/SKILL.md", "docs\\python\\SKILL.md"]) {
      assert.throws(() => captureRepositorySkill(project, relative), /eligible|Unsafe|excluded/);
      assert.throws(() => parseSuppliedSources([{ ...source, reference: { ...source.reference, path: relative } }]), /Invalid captured/);
    }
  });

  test("excludes skill file and directory symlinks and invalidates captured ancestors replaced by links", () => {
    symlinkSync(path.join(root, "docs/python"), path.join(root, ".agents/skills/linked"));
    mkdirSync(path.join(root, "docs/linked"));
    symlinkSync(path.join(root, "docs/python/SKILL.md"), path.join(root, "docs/linked/SKILL.md"));
    assert.equal(discoverRepositorySkills(project).length, 2);
    assert.throws(() => captureRepositorySkill(project, ".agents/skills/linked/SKILL.md"), /Symbolic links/);
    assert.throws(() => captureRepositorySkill(project, "docs/linked/SKILL.md"), /Symbolic links/);
    const source = captureRepositorySkill(project, ".agents/skills/local-check/SKILL.md");
    rmSync(path.join(root, ".agents"), { recursive: true });
    symlinkSync(path.join(root, "docs"), path.join(root, ".agents"));
    const index = new ProjectRetrieval({ projectId: project.projectId, root });
    try { assert.throws(() => { index.assertCapturedCurrent([source]); }, /changed|unsafe/); }
    finally { index.dispose(); }
    assert.deepEqual(discoverRepositorySkills(project).map(skill => skill.path), ["docs/python/SKILL.md"]);
  });

  test("skill content, inventory and permission changes require recapture", () => {
    const index = new ProjectRetrieval({ projectId: project.projectId, root });
    try {
      const source = captureRepositorySkill(project, ".agents/skills/local-check/SKILL.md");
      add(".agents/skills/local-check/SKILL.md", "# Changed skill\n");
      assert.throws(() => { index.assertCapturedCurrent([source]); }, /changed/);
      const updated = captureRepositorySkill(project, ".agents/skills/local-check/SKILL.md");
      add(".agents/skills/new-check/SKILL.md");
      assert.throws(() => { index.assertCapturedCurrent([updated]); }, /changed/);
      const current = captureRepositorySkill(project, ".agents/skills/local-check/SKILL.md");
      const directory = path.join(root, ".agents/skills/local-check");
      chmodSync(directory, (statSync(directory).mode & 0o777) ^ 0o020);
      assert.throws(() => { index.assertCapturedCurrent([current]); }, /changed/);
    } finally { index.dispose(); }
  });

  test("caps skills at complete lines within 200 lines and 10,000 UTF-8 bytes", () => {
    add("docs/python/SKILL.md", Array.from({ length: 250 }, (_, index) => `Step ${String(index + 1)}\n`).join(""));
    const source = captureRepositorySkill(project, "docs/python/SKILL.md");
    assert.equal(source.reference.kind, "file");
    assert.equal(source.reference.endLine, 200);
    assert.ok(source.text.endsWith("Step 200\n"));
    assert.ok(!source.text.includes("Step 201"));
    add("docs/python/SKILL.md", ("é".repeat(1000) + "\n").repeat(10));
    const bounded = captureRepositorySkill(project, "docs/python/SKILL.md");
    assert.equal(Buffer.byteLength(bounded.text), 8004);
    assert.deepEqual(parseSuppliedSources([bounded]), [bounded]);
    add("docs/python/SKILL.md", "é".repeat(5001));
    assert.throws(() => captureRepositorySkill(project, "docs/python/SKILL.md"), /first line exceeds/);
  });

  test("ordinary UTF-8 Python files can be captured, parsed, searched and revalidated", () => {
    add("pipeline.py", "def transform_rows(rows):\n    return [row for row in rows if row]\n");
    const index = new ProjectRetrieval({ projectId: project.projectId, root });
    try {
      const source = index.captureFile("pipeline.py", project.revision);
      assert.deepEqual(parseSuppliedSources([source]), [source]);
      index.assertCapturedCurrent([source]);
      index.rebuild();
      const result = index.search({ projectId: project.projectId, query: "transform_rows" });
      assert.equal(result.kind, "matched");
      assert.ok(result.hits.some(hit => hit.source.kind === "file" && hit.source.path === "pipeline.py"));
      add("pipeline.py", "def transform_rows(rows):\n    return []\n");
      assert.throws(() => { index.assertCapturedCurrent([source]); }, /changed/);
    } finally { index.dispose(); }
  });

  test("a dirty open skill buffer must be saved before capturing disk evidence", async () => {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(root, "docs/python/SKILL.md")));
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(0, 0), "Unsaved instruction\n");
    assert.equal(await vscode.workspace.applyEdit(edit), true);
    try {
      assert.equal(document.isDirty, true);
      assert.throws(() => captureRepositorySkill(project, "docs/python/SKILL.md"), /Save the selected skill buffer/);
    } finally { await document.save(); }
    assert.ok(captureRepositorySkill(project, "docs/python/SKILL.md").text.startsWith("Unsaved instruction\n"));
  });
});
