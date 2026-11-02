import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parsePatchProposal } from "../../../../packages/core/src/execution-patch.js";
import { CandidateWorkspace } from "../../src/candidate-workspace.js";
import { WorkspaceIntegration } from "../../src/workspace-integration.js";

suite("Reviewed source integration", () => {
  let directory: string;
  let source: string;
  let storage: string;
  let candidate: CandidateWorkspace;
  let integration: WorkspaceIntegration;
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-integration-")); source = path.join(directory, "source"); storage = path.join(directory, "storage");
    mkdirSync(source); mkdirSync(storage);
    writeFileSync(path.join(source, "a.ts"), "\uFEFFbase\r\n"); writeFileSync(path.join(source, "b.ts"), "deleted"); writeFileSync(path.join(source, "untracked"), "keep");
    candidate = CandidateWorkspace.capture({ repositoryRoot: source, relativePaths: ["a.ts", "b.ts", "c.ts"], storageDirectory: storage });
    candidate.apply({ commandId: "candidate", proposal: parsePatchProposal({ files: candidate.files.map(file => file.baseline), value: { summary: "change", operations: candidate.files.map(file => ({ fileId: file.baseline.fileId, content: file.baseline.relativePath === "a.ts" ? "\uFEFFnew\r\n" : file.baseline.relativePath === "b.ts" ? null : "created" })) } }) });
    integration = new WorkspaceIntegration({ candidate });
  });
  teardown(() => { rmSync(directory, { recursive: true, force: true }); });
  const args = () => {
    const preview = integration.preview();
    return { commandId: "integrate", expectedSourceManifestHash: preview.sourceManifestHash, expectedCandidateManifestHash: preview.currentCandidateHash };
  };
  const reopened = () => new WorkspaceIntegration({ candidate: CandidateWorkspace.reopen({ controlDirectory: candidate.controlDirectory, storageDirectory: storage, expectedCaptureHash: candidate.captureHash }) });
  test("reviewed create/replace/delete reaches exact candidate hash while preserving unrelated files", () => {
    const request = args();
    assert.equal(readFileSync(path.join(source, "a.ts"), "utf8"), "\uFEFFbase\r\n");
    const result = integration.apply(request);
    assert.deepEqual(result, { kind: "changed", manifestHash: candidate.manifestHash() });
    assert.equal(readFileSync(path.join(source, "a.ts"), "utf8"), "\uFEFFnew\r\n");
    assert.equal(existsSync(path.join(source, "b.ts")), false);
    assert.equal(readFileSync(path.join(source, "c.ts"), "utf8"), "created");
    assert.equal(readFileSync(path.join(source, "untracked"), "utf8"), "keep");
    assert.equal(integration.previewRestore({ checkpointId: "integration-before:integrate" }).changes.length, 3);
  });
  test("manual source edits and new files block all writes even with a newly obtained preview", () => {
    writeFileSync(path.join(source, "c.ts"), "manual new");
    assert.equal(integration.apply(args()).kind, "conflict");
    assert.equal(readFileSync(path.join(source, "a.ts"), "utf8"), "\uFEFFbase\r\n");
    unlinkSync(path.join(source, "c.ts")); writeFileSync(path.join(source, "a.ts"), "manual");
    assert.equal(integration.apply(args()).kind, "conflict");
    assert.equal(readFileSync(path.join(source, "b.ts"), "utf8"), "deleted");
  });
  test("candidate changes invalidate reviewed integration", () => {
    const request = args(); writeFileSync(path.join(candidate.root, "a.ts"), "candidate changed");
    assert.equal(integration.apply(request).kind, "conflict");
    assert.equal(readFileSync(path.join(source, "a.ts"), "utf8"), "\uFEFFbase\r\n");
  });
  test("partial integration resumes after restart and completed replay never replaces later manual work", () => {
    assert.equal(integration.apply({ ...args(), afterStep: () => { throw new Error("crash"); } }).kind, "partial");
    assert.equal(reopened().reconcile({ commandId: "integrate" }).kind, "changed");
    writeFileSync(path.join(source, "a.ts"), "later manual");
    assert.equal(reopened().apply(args()).kind, "conflict");
    assert.equal(readFileSync(path.join(source, "a.ts"), "utf8"), "later manual");
  });
  test("controlled concurrent edits produce conflict and preserve the before checkpoint", () => {
    const result = integration.apply({ ...args(), afterStep: index => { if (index === 0) writeFileSync(path.join(source, "b.ts"), "concurrent work"); } });
    assert.equal(result.kind, "conflict");
    assert.equal(readFileSync(path.join(source, "b.ts"), "utf8"), "concurrent work");
    assert.equal(reopened().reconcile({ commandId: "integrate" }).kind, "conflict");
    assert.equal(integration.previewRestore({ checkpointId: "integration-before:integrate" }).changes.find(change => change.relativePath === "b.ts")?.after, "deleted");
  });
  test("source restore preserves newer bytes, recovers interruptions and never repeats after later edits", () => {
    integration.apply(args()); writeFileSync(path.join(source, "a.ts"), "newer work");
    const preview = integration.previewRestore({ checkpointId: "integration-before:integrate" });
    assert.notEqual(preview.targetManifestHash, preview.currentManifestHash);
    const request = { restoreCommandId: "restore", checkpointId: "integration-before:integrate", expectedManifestHash: preview.currentManifestHash };
    assert.equal(integration.restore({ ...request, afterStep: () => { throw new Error("crash"); } }).kind, "partial");
    assert.deepEqual(reopened().reconcile({ commandId: "restore" }), { kind: "changed", manifestHash: preview.targetManifestHash });
    assert.equal(integration.previewRestore({ checkpointId: "integration-preserved:restore" }).changes.find(change => change.relativePath === "a.ts")?.after, "newer work");
    writeFileSync(path.join(source, "a.ts"), "after restore manual");
    assert.equal(reopened().restore(request).kind, "conflict");
    assert.equal(readFileSync(path.join(source, "a.ts"), "utf8"), "after restore manual");
    assert.equal(readFileSync(path.join(source, "untracked"), "utf8"), "keep");
  });
  test("source symlink swaps are rejected without writing through links", () => {
    unlinkSync(path.join(source, "a.ts")); symlinkSync(path.join(candidate.root, "a.ts"), path.join(source, "a.ts"));
    assert.throws(() => integration.apply(args()));
    assert.equal(readFileSync(path.join(candidate.root, "a.ts"), "utf8"), "\uFEFFnew\r\n");
  });
});
