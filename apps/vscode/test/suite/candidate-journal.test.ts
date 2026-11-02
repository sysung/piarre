import assert from "node:assert/strict";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parsePatchProposal } from "../../../../packages/core/src/execution-patch.js";
import { CandidateWorkspace } from "../../src/candidate-workspace.js";

suite("Durable isolated candidate journals", () => {
  let directory: string;
  let repository: string;
  let storage: string;
  let candidate: CandidateWorkspace;
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-journal-"));
    repository = path.join(directory, "source"); storage = path.join(directory, "storage");
    mkdirSync(repository); mkdirSync(storage);
    writeFileSync(path.join(repository, "a.ts"), "\uFEFForiginal\r\n");
    writeFileSync(path.join(repository, "b.ts"), "delete me");
    candidate = CandidateWorkspace.capture({ repositoryRoot: repository, storageDirectory: storage, relativePaths: ["a.ts", "b.ts", "new/c.ts"] });
  });
  teardown(() => { rmSync(directory, { recursive: true, force: true }); });
  const proposal = () => parsePatchProposal({ files: candidate.files.map(file => file.baseline), value: { summary: "change three files", operations: candidate.files.map(file => ({ fileId: file.baseline.fileId, content: file.baseline.relativePath === "a.ts" ? "\uFEFFchanged\r\n" : file.baseline.relativePath === "b.ts" ? null : "created" })) } });
  const reopen = () => CandidateWorkspace.reopen({ controlDirectory: candidate.controlDirectory, storageDirectory: storage, expectedCaptureHash: candidate.captureHash });
  test("create/replace/delete writes exact candidate bytes with durable baseline and review diff", () => {
    const hash = candidate.manifestHash();
    assert.equal(candidate.apply({ commandId: "patch", proposal: proposal() }).kind, "changed");
    assert.equal(readFileSync(path.join(candidate.root, "a.ts"), "utf8"), "\uFEFFchanged\r\n");
    assert.equal(existsSync(path.join(candidate.root, "b.ts")), false);
    assert.equal(readFileSync(path.join(candidate.root, "new/c.ts"), "utf8"), "created");
    assert.equal(readFileSync(path.join(repository, "a.ts"), "utf8"), "\uFEFForiginal\r\n");
    assert.equal(candidate.diff()[0]?.before, "\uFEFForiginal\r\n");
    assert.notEqual(candidate.manifestHash(), hash);
    assert.equal(reopen().manifestHash(), candidate.manifestHash());
    assert.equal(path.dirname(candidate.controlDirectory), path.dirname(candidate.root));
  });
  test("manual candidate edits conflict before any patch writes", () => {
    writeFileSync(path.join(candidate.root, "b.ts"), "manual");
    assert.equal(candidate.apply({ commandId: "patch", proposal: proposal() }).kind, "conflict");
    assert.equal(readFileSync(path.join(candidate.root, "a.ts"), "utf8"), "\uFEFForiginal\r\n");
    assert.equal(readFileSync(path.join(candidate.root, "b.ts"), "utf8"), "manual");
  });
  test("interrupted journal survives restart and finishes only safe before images", () => {
    assert.equal(candidate.apply({ commandId: "patch", proposal: proposal(), afterStep: () => { throw new Error("crash"); } }).kind, "partial");
    assert.equal(readFileSync(path.join(candidate.root, "b.ts"), "utf8"), "delete me");
    const restarted = reopen();
    assert.equal(restarted.reconcile({ commandId: "patch" }).kind, "changed");
    assert.equal(restarted.diff().length, 3);
    writeFileSync(path.join(candidate.root, "a.ts"), "later manual work");
    assert.equal(restarted.reconcile({ commandId: "patch" }).kind, "current");
    assert.equal(readFileSync(path.join(candidate.root, "a.ts"), "utf8"), "later manual work");
  });
  test("restart recovery exposes divergent files without overwriting them", () => {
    candidate.apply({ commandId: "patch", proposal: proposal(), afterStep: () => { throw new Error("crash"); } });
    writeFileSync(path.join(candidate.root, "b.ts"), "new manual");
    assert.equal(reopen().reconcile({ commandId: "patch" }).kind, "conflict");
    assert.equal(readFileSync(path.join(candidate.root, "b.ts"), "utf8"), "new manual");
  });
  test("restore previews current changes, preserves all newer scoped bytes and keeps unrelated files", () => {
    candidate.apply({ commandId: "patch", proposal: proposal() });
    writeFileSync(path.join(candidate.root, "untracked.txt"), "leave alone");
    const preview = candidate.previewRestore({ checkpointId: "baseline" });
    assert.notEqual(preview.targetManifestHash, preview.currentManifestHash);
    assert.deepEqual(preview.changes.map(change => change.kind), ["replace", "create", "delete"]);
    assert.equal(candidate.restore({ commandId: "restore", checkpointId: "baseline", expectedManifestHash: preview.currentManifestHash }).kind, "changed");
    assert.equal(candidate.manifestHash(), preview.targetManifestHash);
    assert.equal(readFileSync(path.join(candidate.root, "a.ts"), "utf8"), "\uFEFForiginal\r\n");
    assert.equal(readFileSync(path.join(candidate.root, "untracked.txt"), "utf8"), "leave alone");
    assert.equal(candidate.previewRestore({ checkpointId: "preserved:restore" }).changes.length, 3);
    writeFileSync(path.join(candidate.root, "a.ts"), "later edit");
    assert.equal(reopen().restore({ commandId: "restore", checkpointId: "baseline", expectedManifestHash: preview.currentManifestHash }).kind, "current");
    assert.equal(readFileSync(path.join(candidate.root, "a.ts"), "utf8"), "later edit");
  });
  test("stale restore preview blocks and partial restore recovers with preserved newer checkpoint", () => {
    candidate.apply({ commandId: "patch", proposal: proposal() });
    const preview = candidate.previewRestore({ checkpointId: "baseline" });
    writeFileSync(path.join(candidate.root, "a.ts"), "newer manual");
    assert.equal(candidate.restore({ commandId: "stale", checkpointId: "baseline", expectedManifestHash: preview.currentManifestHash }).kind, "conflict");
    const fresh = candidate.previewRestore({ checkpointId: "baseline" });
    assert.equal(candidate.restore({ commandId: "restore", checkpointId: "baseline", expectedManifestHash: fresh.currentManifestHash, afterStep: () => { throw new Error("crash"); } }).kind, "partial");
    const restarted = reopen();
    assert.equal(restarted.reconcile({ commandId: "restore" }).kind, "changed");
    assert.equal(restarted.previewRestore({ checkpointId: "preserved:restore" }).changes[0]?.after, "newer manual");
  });
  test("unchanged proposal files still enforce the full disclosed baseline", () => {
    const first = candidate.files[0];
    assert.ok(first);
    const partial = parsePatchProposal({ files: candidate.files.map(file => file.baseline), value: { summary: "one change", operations: [{ fileId: first.baseline.fileId, content: "change" }] } });
    writeFileSync(path.join(candidate.root, "b.ts"), "manual context change");
    assert.equal(candidate.apply({ commandId: "patch", proposal: partial }).kind, "conflict");
    assert.equal(readFileSync(path.join(candidate.root, "a.ts"), "utf8"), "\uFEFForiginal\r\n");
  });
  test("hard links and parent symlink swaps cannot redirect candidate writes", () => {
    unlinkSync(path.join(candidate.root, "a.ts"));
    linkSync(path.join(repository, "a.ts"), path.join(candidate.root, "a.ts"));
    assert.throws(() => candidate.manifestHash());
    unlinkSync(path.join(candidate.root, "a.ts"));
    writeFileSync(path.join(candidate.root, "a.ts"), "\uFEFForiginal\r\n");
    symlinkSync(repository, path.join(candidate.root, "new"));
    assert.throws(() => candidate.apply({ commandId: "patch", proposal: proposal() }));
    assert.equal(existsSync(path.join(repository, "c.ts")), false);
  });
  test("rejects symlink and directory swaps and cannot reopen outside owned storage", () => {
    unlinkSync(path.join(candidate.root, "a.ts"));
    symlinkSync(path.join(repository, "a.ts"), path.join(candidate.root, "a.ts"));
    assert.throws(() => candidate.apply({ commandId: "patch", proposal: proposal() }));
    assert.equal(readFileSync(path.join(repository, "a.ts"), "utf8"), "\uFEFForiginal\r\n");
    assert.throws(() => CandidateWorkspace.reopen({ controlDirectory: candidate.controlDirectory, storageDirectory: repository, expectedCaptureHash: candidate.captureHash }));
    assert.throws(() => CandidateWorkspace.reopen({ controlDirectory: candidate.controlDirectory, storageDirectory: storage, expectedCaptureHash: "wrong" }));
    unlinkSync(path.join(candidate.root, "a.ts")); mkdirSync(path.join(candidate.root, "a.ts"));
    assert.throws(() => candidate.manifestHash());
  });
});
