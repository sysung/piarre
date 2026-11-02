import assert from "node:assert/strict";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CandidateWorkspace } from "../../src/candidate-workspace.js";

suite("Disclosed isolated candidate files", () => {
  let directory: string;
  let repository: string;
  let storage: string;
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-candidate-"));
    repository = path.join(directory, "repository"); storage = path.join(directory, "storage");
    mkdirSync(repository); mkdirSync(storage);
    writeFileSync(path.join(repository, "refunds.ts"), "export const days = 30;\n");
    writeFileSync(path.join(repository, "private.txt"), "not disclosed");
  });
  teardown(() => { rmSync(directory, { recursive: true, force: true }); });
  const capture = (relativePaths: string[]) => CandidateWorkspace.capture({ repositoryRoot: repository, storageDirectory: storage, relativePaths });
  test("copies only disclosed source files and keeps absent-file identity", () => {
    const candidate = capture(["refunds.ts", "test/new.test.ts"]);
    assert.equal(readFileSync(path.join(candidate.root, "refunds.ts"), "utf8"), "export const days = 30;\n");
    assert.equal(existsSync(path.join(candidate.root, "private.txt")), false);
    assert.equal(existsSync(path.join(candidate.root, "test/new.test.ts")), false);
    assert.equal(candidate.files[1]?.baseline.kind, "absent");
    assert.deepEqual(candidate.inspectOriginal(), { kind: "unchanged" });
    writeFileSync(path.join(candidate.root, "refunds.ts"), "candidate only");
    assert.equal(readFileSync(path.join(repository, "refunds.ts"), "utf8"), "export const days = 30;\n");
  });
  test("manual edits and creation of an originally absent file invalidate integration baseline", () => {
    const candidate = capture(["refunds.ts", "new.ts"]);
    writeFileSync(path.join(repository, "refunds.ts"), "manual work");
    writeFileSync(path.join(repository, "new.ts"), "new manual file");
    assert.deepEqual(candidate.inspectOriginal(), { kind: "changed", paths: ["refunds.ts", "new.ts"] });
    assert.equal(readFileSync(path.join(repository, "refunds.ts"), "utf8"), "manual work");
  });
  test("rejects traversal, symlinks, hard links, directories and overlapping manifests", () => {
    symlinkSync(path.join(repository, "refunds.ts"), path.join(repository, "linked.ts"));
    symlinkSync(path.join(repository, "missing.ts"), path.join(repository, "broken.ts"));
    linkSync(path.join(repository, "private.txt"), path.join(repository, "hard.txt"));
    mkdirSync(path.join(repository, "folder"));
    for (const files of [["../escape"], ["linked.ts"], ["broken.ts"], ["hard.txt"], ["folder"], ["new", "new/child.ts"], ["NEW.ts", "new.ts"]]) {
      assert.throws(() => capture(files));
    }
  });
  test("preserves the exact UTF-8 BOM and line endings of disclosed source bytes", () => {
    const text = "\uFEFFexport const days = 30;\r\n";
    writeFileSync(path.join(repository, "refunds.ts"), text);
    const candidate = capture(["refunds.ts"]);
    assert.equal(readFileSync(path.join(candidate.root, "refunds.ts"), "utf8"), text);
    assert.deepEqual(candidate.inspectOriginal(), { kind: "unchanged" });
  });
  test("rejects candidate storage inside the user repository", () => {
    assert.throws(() => CandidateWorkspace.capture({ repositoryRoot: repository, storageDirectory: repository, relativePaths: ["refunds.ts"] }));
  });
});
