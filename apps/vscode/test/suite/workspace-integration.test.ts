import assert from "node:assert/strict";
import { chmodSync, statSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parsePatchProposal } from "../../../../packages/core/src/execution-patch.js";
import { CandidateWorkspace } from "../../src/candidate-workspace.js";
import { digest, readRecord, writeRecord } from "../../src/candidate-journal.js";
import { publicationParents } from "../../src/scoped-publication.js";
import { WorkspaceIntegration } from "../../src/workspace-integration.js";

suite("Reviewed source integration", function () {
  this.timeout(30_000); // Real native subprocesses and durable filesystem round trips.
  let directory: string;
  let source: string;
  let storage: string;
  let candidate: CandidateWorkspace;
  let integration: WorkspaceIntegration;
  setup(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-integration-")); source = path.join(directory, "source"); storage = path.join(directory, "storage");
    mkdirSync(source); mkdirSync(storage);
    writeFileSync(path.join(source, "a.ts"), "\uFEFFbase\r\n"); writeFileSync(path.join(source, "b.ts"), "deleted"); writeFileSync(path.join(source, "untracked"), "keep");
    candidate = CandidateWorkspace.capture({ repositoryRoot: source, relativePaths: ["a.ts", "b.ts", "c.ts"], storageDirectory: storage });
    await candidate.apply({ commandId: "candidate", proposal: parsePatchProposal({ files: candidate.files.map(file => file.baseline), value: { summary: "change", operations: candidate.files.map(file => ({ fileId: file.baseline.fileId, content: file.baseline.relativePath === "a.ts" ? "\uFEFFnew\r\n" : file.baseline.relativePath === "b.ts" ? null : "created" })) } }) });
    integration = new WorkspaceIntegration({ candidate });
  });
  teardown(() => { rmSync(directory, { recursive: true, force: true }); });
  const args = () => {
    const preview = integration.preview();
    return { commandId: "integrate", expectedSourceManifestHash: preview.sourceManifestHash, expectedCandidateManifestHash: preview.currentCandidateHash, parentIdentityHash: digest(JSON.stringify(preview.changes.map(change => publicationParents(source, change.relativePath)))) };
  };
  const authority = (request: ReturnType<typeof args>) => ({ expectedManifestHash: request.expectedSourceManifestHash, targetManifestHash: request.expectedCandidateManifestHash, parentIdentityHash: request.parentIdentityHash });
  const reopened = () => new WorkspaceIntegration({ candidate: CandidateWorkspace.reopen({ controlDirectory: candidate.controlDirectory, storageDirectory: storage, expectedCaptureHash: candidate.captureHash }) });
  test("executable permissions survive capture, integration, restore and preserved recovery", async () => {
    const script = path.join(source, "run.sh"); writeFileSync(script, "#!/bin/sh\necho before\n"); chmodSync(script, 0o755);
    const executable = CandidateWorkspace.capture({ repositoryRoot: source, storageDirectory: storage, relativePaths: ["run.sh"] });
    const file = executable.files[0]; assert.ok(file);
    assert.equal(statSync(path.join(executable.root, "run.sh")).mode & 0o777, 0o755);
    await executable.apply({ commandId: "patch", proposal: parsePatchProposal({ files: [file.baseline], value: { summary: "edit", operations: [{ fileId: file.baseline.fileId, content: "#!/bin/sh\necho after\n" }] } }) });
    const reviewed = new WorkspaceIntegration({ candidate: executable }); const preview = reviewed.preview();
    assert.equal((await reviewed.apply({ commandId: "integrate", expectedSourceManifestHash: preview.sourceManifestHash, expectedCandidateManifestHash: preview.currentCandidateHash })).kind, "changed");
    assert.equal(statSync(script).mode & 0o777, 0o755);
    chmodSync(script, 0o700);
    const restore = reviewed.previewRestore({ checkpointId: "integration-before:integrate" });
    assert.equal((await reviewed.restore({ restoreCommandId: "restore", checkpointId: "integration-before:integrate", expectedManifestHash: restore.currentManifestHash })).kind, "changed");
    assert.equal(statSync(script).mode & 0o777, 0o755);
    assert.equal(readFileSync(script, "utf8"), "#!/bin/sh\necho before\n");
    const preserved = reviewed.previewRestore({ checkpointId: "integration-preserved:restore" });
    assert.equal((await reviewed.restore({ restoreCommandId: "recover", checkpointId: "integration-preserved:restore", expectedManifestHash: preserved.currentManifestHash })).kind, "changed");
    assert.equal(statSync(script).mode & 0o777, 0o700);
    assert.equal(readFileSync(script, "utf8"), "#!/bin/sh\necho after\n");
  });
  test("mode-only manual changes invalidate source and candidate review", async () => {
    const reviewed = args(); const hash = candidate.manifestHash();
    chmodSync(path.join(candidate.root, "a.ts"), 0o755);
    assert.notEqual(candidate.manifestHash(), hash);
    assert.equal((await integration.apply(reviewed)).kind, "conflict");
    chmodSync(path.join(source, "a.ts"), 0o755);
    assert.equal(candidate.inspectOriginal().kind, "changed");
    assert.equal((await integration.apply(args())).kind, "conflict");
  });
  test("reviewed create/replace/delete reaches exact candidate hash while preserving unrelated files", async () => {
    const request = args();
    assert.equal(readFileSync(path.join(source, "a.ts"), "utf8"), "\uFEFFbase\r\n");
    const result = await integration.apply(request);
    assert.deepEqual(result, { kind: "changed", manifestHash: candidate.manifestHash() });
    assert.equal(readFileSync(path.join(source, "a.ts"), "utf8"), "\uFEFFnew\r\n");
    assert.equal(existsSync(path.join(source, "b.ts")), false);
    assert.equal(readFileSync(path.join(source, "c.ts"), "utf8"), "created");
    assert.equal(readFileSync(path.join(source, "untracked"), "utf8"), "keep");
    assert.equal(integration.previewRestore({ checkpointId: "integration-before:integrate" }).changes.length, 3);
  });
  test("manual source edits and new files block all writes even with a newly obtained preview", async () => {
    writeFileSync(path.join(source, "c.ts"), "manual new");
    assert.equal((await integration.apply(args())).kind, "conflict");
    assert.equal(readFileSync(path.join(source, "a.ts"), "utf8"), "\uFEFFbase\r\n");
    unlinkSync(path.join(source, "c.ts")); writeFileSync(path.join(source, "a.ts"), "manual");
    assert.equal((await integration.apply(args())).kind, "conflict");
    assert.equal(readFileSync(path.join(source, "b.ts"), "utf8"), "deleted");
  });
  test("candidate changes invalidate reviewed integration", async () => {
    const request = args(); writeFileSync(path.join(candidate.root, "a.ts"), "candidate changed");
    assert.equal((await integration.apply(request)).kind, "conflict");
    assert.equal(readFileSync(path.join(source, "a.ts"), "utf8"), "\uFEFFbase\r\n");
  });
  test("partial integration resumes after restart and completed replay never replaces later manual work", async () => {
    const request = args();
    assert.equal((await integration.apply({ ...request, afterStep: () => { throw new Error("crash"); } })).kind, "partial");
    assert.equal((await reopened().reconcile({ commandId: "integrate", authority: authority(request) })).kind, "changed");
    writeFileSync(path.join(source, "a.ts"), "later manual");
    assert.equal((await reopened().apply(args())).kind, "conflict");
    assert.equal(readFileSync(path.join(source, "a.ts"), "utf8"), "later manual");
  });
  for (const corruption of ["after-image", "target-companion", "parent-identities"] as const) test(`partial integration rejects corrupt ${corruption} before touching the second file`, async () => {
    const request = args();
    assert.equal((await integration.apply({ ...request, afterStep: () => { throw new Error("simulated restart"); } })).kind, "partial");
    assert.equal(readFileSync(path.join(source, "b.ts"), "utf8"), "deleted");
    const filename = `integration-journal-${digest(request.commandId)}.json`;
    const journal = readRecord(candidate.controlDirectory, filename);
    assert.ok(typeof journal === "object" && journal !== null && "changes" in journal && Array.isArray(journal.changes) && "parents" in journal && Array.isArray(journal.parents));
    if (corruption === "parent-identities") journal.parents[1] = [[0, 0]];
    else {
      journal.changes[1] = { relativePath: "b.ts", before: "deleted", after: "UNAPPROVED JOURNAL CONTENT", beforeMode: 0o644, afterMode: 0o644 };
      if (corruption === "target-companion") {
        const targetName = `integration-target-${digest(request.commandId)}.json`;
        const target = readRecord(candidate.controlDirectory, targetName); assert.ok(Array.isArray(target));
        target[1] = { relativePath: "b.ts", content: "UNAPPROVED JOURNAL CONTENT", mode: 0o644 };
        writeRecord(candidate.controlDirectory, targetName, target);
      }
    }
    writeRecord(candidate.controlDirectory, filename, journal);
    assert.equal((await reopened().reconcile({ commandId: request.commandId, authority: authority(request) })).kind, "conflict");
    assert.equal(readFileSync(path.join(source, "b.ts"), "utf8"), "deleted");
    assert.equal(existsSync(path.join(source, "c.ts")), false);
  });
  test("controlled concurrent edits produce conflict and preserve the before checkpoint", async () => {
    const result = await integration.apply({ ...args(), afterStep: index => { if (index === 0) writeFileSync(path.join(source, "b.ts"), "concurrent work"); } });
    assert.equal(result.kind, "conflict");
    assert.equal(readFileSync(path.join(source, "b.ts"), "utf8"), "concurrent work");
    assert.equal((await reopened().reconcile({ commandId: "integrate" })).kind, "conflict");
    assert.equal(integration.previewRestore({ checkpointId: "integration-before:integrate" }).changes.find(change => change.relativePath === "b.ts")?.after, "deleted");
  });
  test("source restore preserves newer bytes, recovers interruptions and never repeats after later edits", async () => {
    await integration.apply(args()); writeFileSync(path.join(source, "a.ts"), "newer work");
    const preview = integration.previewRestore({ checkpointId: "integration-before:integrate" });
    assert.notEqual(preview.targetManifestHash, preview.currentManifestHash);
    const request = { restoreCommandId: "restore", checkpointId: "integration-before:integrate", expectedManifestHash: preview.currentManifestHash, parentIdentityHash: digest(JSON.stringify(preview.changes.map(change => publicationParents(source, change.relativePath)))) };
    assert.equal((await integration.restore({ ...request, afterStep: () => { throw new Error("crash"); } })).kind, "partial");
    assert.deepEqual(await reopened().reconcile({ commandId: "restore", authority: { expectedManifestHash: request.expectedManifestHash, targetManifestHash: preview.targetManifestHash, parentIdentityHash: request.parentIdentityHash } }), { kind: "changed", manifestHash: preview.targetManifestHash });
    assert.equal(integration.previewRestore({ checkpointId: "integration-preserved:restore" }).changes.find(change => change.relativePath === "a.ts")?.after, "newer work");
    writeFileSync(path.join(source, "a.ts"), "after restore manual");
    assert.equal((await reopened().restore(request)).kind, "conflict");
    assert.equal(readFileSync(path.join(source, "a.ts"), "utf8"), "after restore manual");
    assert.equal(readFileSync(path.join(source, "untracked"), "utf8"), "keep");
  });
  test("source symlink swaps are rejected without writing through links", async () => {
    unlinkSync(path.join(source, "a.ts")); symlinkSync(path.join(candidate.root, "a.ts"), path.join(source, "a.ts"));
    await assert.rejects(async () => { await integration.apply(args()); });
    assert.equal(readFileSync(path.join(candidate.root, "a.ts"), "utf8"), "\uFEFFnew\r\n");
  });
});
