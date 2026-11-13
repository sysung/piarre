import { forecastFixture, consentFixture } from "./forecast-fixture.js";
import assert from "node:assert/strict";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ownsExecutionLease, type ExecutionPlanDraft, type ProjectCommand } from "../../../../packages/core/src/index.js";
import { activeRecovery } from "../../../../packages/core/src/recovery.js";
import { parsePatchProposal } from "../../../../packages/core/src/execution-patch.js";
import { CandidateWorkspace } from "../../src/candidate-workspace.js";
import { digest, imageHash, readRecord, writeRecord } from "../../src/candidate-journal.js";
import { ExecutionCoordinator } from "../../src/execution-coordinator.js";
import { publicationParents } from "../../src/scoped-publication.js";
import { imageChanges } from "../../src/candidate-journal.js";
import { WorkspaceIntegration } from "../../src/workspace-integration.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { currentImages, prepareRecoveryFiles, previewRecoveryFiles } from "../../src/recovery-files.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { renderExecutionResult } from "../../src/execution-view.js";

suite("Reviewed recovery with actual SQLite and filesystem", () => {
  let directory: string; let source: string; let storage: string; let repository: SqliteProjectRepository;
  let candidate: CandidateWorkspace; let coordinator: ExecutionCoordinator; let dirty: boolean; let sequence: number;
  const runId = "run:recovery";
  const run = () => { const found = repository.read().executionRuns.find(run => run.runId === runId); assert.ok(found); return found; };
  const send = (action: ProjectCommand["action"], commandId = `fixture-${String(++sequence)}`) => {
    const project = repository.read(); return repository.dispatch({ commandId, projectId: project.projectId, expectedProjectRevision: project.revision, action });
  };
  const createCoordinator = () => new ExecutionCoordinator({ repository, storageDirectory: storage, createClient: () => { throw new Error("Recovery must never connect to a provider"); }, publish: () => undefined, hasDirtyDocuments: () => dirty });
  const preview = () => coordinator.previewRecovery({ runId, selection: coordinator.recoverySelection(runId) });
  setup(async () => {
    sequence = 0; dirty = false;
    directory = realpathSync(mkdtempSync(path.join(tmpdir(), "piarre-recovery-")));
    source = path.join(directory, "source"); storage = path.join(directory, "storage"); mkdirSync(source); mkdirSync(storage);
    writeFileSync(path.join(source, "a.txt"), "original a\r\n"); writeFileSync(path.join(source, "b.txt"), "original b");
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite")); repository.open({ repositoryUri: pathToFileURL(source).href, name: "Recovery fixture" });
    send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose("Update scoped text") });
    const task = repository.read().tasks[0]; assert.ok(task);
    candidate = CandidateWorkspace.capture({ repositoryRoot: source, storageDirectory: storage, relativePaths: ["a.txt", "b.txt", "new.txt"] });
    const draft: ExecutionPlanDraft = { taskId: task.taskId, objective: "Fixture interrupted scoped patch", criteria: [{ criterionId: "text", text: "Scoped text" }], knowledge: [], files: candidate.files.map(file => file.baseline), checks: [], candidateRoot: candidate.root, controlDirectory: candidate.controlDirectory, captureHash: candidate.captureHash,
      baselineCheckpoint: candidate.checkpoint({ checkpointId: "baseline" }), sourceRoot: source, provider: { kind: "codex-readonly-patch", authType: "unknown", requestedModel: "fixture" }, accountContext: { observedAt: new Date().toISOString(), model: { kind: "unknown" }, usage: { kind: "unknown" } }, forecast: forecastFixture(), durationMs: 120_000, maxTokens: 1000 };
    send({ kind: "prepare-execution-plan", plan: draft }); const plan = repository.read().executionPlans[0]; assert.ok(plan);
    send({ kind: "approve-execution", spendingConsent: consentFixture(plan, runId), planId: plan.planId, planRevision: plan.recordedAtRevision, runId, approvedAt: 1000, expiresAt: 120_000, ownerId: "departed-fixture-owner", ownerPid: 2147483647 });
    const proposal = parsePatchProposal({ files: plan.files, value: { summary: "Fixture partial write", operations: candidate.files.map(file => ({ fileId: file.baseline.fileId, content: `intended ${file.baseline.relativePath}` })) } });
    assert.equal((await candidate.apply({ commandId: `patch:${runId}`, proposal, afterStep: () => { throw new Error("Fixture interruption"); } })).kind, "partial");
    writeFileSync(path.join(candidate.root, "b.txt"), "new manual b");
    send({ kind: "mark-execution-unknown", runId, reason: "Interrupted patch; user must review conflict" });
    coordinator = createCoordinator();
  });
  teardown(() => { coordinator.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true }); });
  test("mixed recovery preserves full scope, supersedes old replay, remains historical, and restores preserved newer work after restart", async () => {
    const inspected = await preview(); assert.deepEqual(inspected.states.map(file => file.kind), ["after", "diverged", "before"]);
    const command = { previewId: inspected.previewId, intendedPaths: ["b.txt", "new.txt"], operationId: "mixed" };
    await coordinator.recover(command);
    assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "intended b.txt");
    assert.equal(readFileSync(path.join(candidate.root, "new.txt"), "utf8"), "intended new.txt");
    assert.equal(ownsExecutionLease(run()), false); assert.equal(run().reviewFreshness.kind, "stale"); assert.equal(run().acceptance.kind, "unreviewed");
    assert.match(renderExecutionResult(repository.read(), runId), /historical evidence/i);
    assert.equal((await candidate.reconcile({ commandId: `patch:${runId}` })).kind, "conflict");
    const version = coordinator.savedVersions(runId).versions.find(version => version.version.versionId === "preserved:mixed");
    assert.equal(version?.kind, "available"); assert.equal(version.images[1]?.content, "new manual b");
    writeFileSync(path.join(candidate.root, "b.txt"), "newer after recovery");
    await coordinator.recover(command); assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "newer after recovery", "Duplicate command must not rewrite later edits");
    coordinator.dispose(); repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite")); coordinator = createCoordinator();
    const restored = await coordinator.previewRecovery({ runId, selection: { kind: "snapshot", target: "candidate", versionId: "preserved:mixed" } });
    await coordinator.recover({ previewId: restored.previewId, intendedPaths: ["b.txt", "new.txt"], operationId: "restore-preserved" });
    assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "new manual b");
    const newer = coordinator.savedVersions(runId).versions.find(version => version.version.versionId === "preserved:restore-preserved");
    assert.equal(newer?.kind, "available"); assert.equal(newer.images[1]?.content, "newer after recovery");
    await coordinator.reconcile(); assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "new manual b");
  });
  test("cancel, stale content, mode and project revisions cannot acquire successor authority", async () => {
    const cancelled = await preview(); coordinator.cancelRecovery(cancelled.previewId);
    await assert.rejects(() => coordinator.recover({ previewId: cancelled.previewId, intendedPaths: [], operationId: "cancel" }), /cancelled/);
    const stale = await preview(); writeFileSync(path.join(candidate.root, "b.txt"), "changed while native review awaited");
    await assert.rejects(() => coordinator.recover({ previewId: stale.previewId, intendedPaths: ["b.txt"], operationId: "stale" }), /stale/);
    const revision = await preview(); send({ kind: "set-scheduling-paused", paused: true });
    await assert.rejects(() => coordinator.recover({ previewId: revision.previewId, intendedPaths: [], operationId: "revision" }), /stale/);
    assert.equal(run().recoveries.length, 0); assert.equal(ownsExecutionLease(run()), true);
  });
  test("dirty buffers and foreign local ownership block keep-current as well as replacement", async () => {
    dirty = true; const blocked = await preview(); assert.match(blocked.blockers.join(" "), /Unsaved/);
    await assert.rejects(() => coordinator.recover({ previewId: blocked.previewId, intendedPaths: [], operationId: "dirty" }), /Unsaved/);
    dirty = false;
    const oldRun = run(); const inspected = await previewRecoveryFiles(oldRun, coordinator.recoverySelection(runId), repository.read().revision);
    const target = prepareRecoveryFiles(oldRun, inspected, [], "foreign-successor");
    send({ kind: "begin-recovery", runId, request: { previewId: inspected.previewId, projectRevision: inspected.projectRevision, selection: inspected.selection, bindingHash: inspected.bindingHash, parentIdentityHash: digest(JSON.stringify(inspected.parentIdentities)), expectedManifestHash: inspected.currentManifestHash, targetManifestHash: imageHash(target), intendedPaths: [], reviewedAt: Date.now(), ownerId: "foreign-live-owner", ownerPid: process.pid } }, "foreign-successor");
    assert.match((await preview()).blockers.join(" "), /foreign live/i);
    assert.equal(ownsExecutionLease(run()), true);
  });
  test("SQLite successor registration retains one reservation through crash/restart and rejects an old finisher", async () => {
    const before = run(); const inspected = await preview(); const target = prepareRecoveryFiles(before, inspected, ["b.txt"], "durable-successor");
    const second = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    try {
      const staleProject = second.read();
      send({ kind: "begin-recovery", runId, request: { previewId: inspected.previewId, projectRevision: inspected.projectRevision, selection: inspected.selection, bindingHash: inspected.bindingHash, parentIdentityHash: digest(JSON.stringify(inspected.parentIdentities)), expectedManifestHash: inspected.currentManifestHash, targetManifestHash: imageHash(target), intendedPaths: ["b.txt"], reviewedAt: Date.now(), ownerId: "departed-successor", ownerPid: 2147483647 } }, "durable-successor");
      assert.equal(second.read().executionRuns.filter(ownsExecutionLease).length, 1);
      assert.equal(second.dispatch({ commandId: "racing-command", projectId: staleProject.projectId, expectedProjectRevision: staleProject.revision, action: { kind: "set-scheduling-paused", paused: true } }).kind, "stale");
      assert.throws(() => send({ kind: "finish-workspace-operation", runId, operationId: `patch:${runId}`, manifestHash: imageHash(target), observedAt: Date.now() }));
    } finally { second.close(); }
    coordinator.dispose(); repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite")); coordinator = createCoordinator();
    await coordinator.reconcile(); assert.equal(activeRecovery(run()), undefined); assert.equal(ownsExecutionLease(run()), false);
    assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "intended b.txt");
    assert.equal((await candidate.reconcile({ commandId: `patch:${runId}` })).kind, "conflict");
  });
  test("corrupt preservation and relocated parent retain successor ownership and do not touch replacement parent", async () => {
    const inspected = await preview(); const target = prepareRecoveryFiles(run(), inspected, ["b.txt"], "corrupt");
    send({ kind: "begin-recovery", runId, request: { previewId: inspected.previewId, projectRevision: inspected.projectRevision, selection: inspected.selection, bindingHash: inspected.bindingHash, parentIdentityHash: digest(JSON.stringify(inspected.parentIdentities)), expectedManifestHash: inspected.currentManifestHash, targetManifestHash: imageHash(target), intendedPaths: ["b.txt"], reviewedAt: Date.now(), ownerId: "departed", ownerPid: 2147483647 } }, "corrupt");
    const filename = `recovery-before-${digest("corrupt")}.json`; const original = readRecord(candidate.controlDirectory, filename);
    writeRecord(candidate.controlDirectory, filename, [{ relativePath: "outside", content: "forged", mode: 0o600 }]);
    await coordinator.reconcile(); assert.equal(activeRecovery(run())?.state.kind, "unknown"); assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "new manual b");
    writeRecord(candidate.controlDirectory, filename, original);
    renameSync(candidate.root, `${candidate.root}-moved`); mkdirSync(candidate.root); writeFileSync(path.join(candidate.root, "b.txt"), "replacement parent work");
    await coordinator.reconcile(); assert.equal(activeRecovery(run())?.state.kind, "unknown"); assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "replacement parent work");
    const versions = coordinator.savedVersions(runId); assert.ok(versions.versions.some(version => version.version.versionId === "preserved:corrupt" && version.kind === "available"));
    assert.ok(versions.retained.length > 0, "Retained original inode discovery does not reopen the candidate root");
  });
  test("keep-current makes no inode replacement, registers all files, and cannot revive the original journal", async () => {
    const before = lstatSync(path.join(candidate.root, "b.txt")); const inspected = await preview();
    await coordinator.recover({ previewId: inspected.previewId, intendedPaths: [], operationId: "keep" });
    assert.equal(lstatSync(path.join(candidate.root, "b.txt")).ino, before.ino);
    assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "new manual b");
    assert.equal(run().recoveries[0]?.intendedPaths.length, 0); assert.equal(run().reviewFreshness.kind, "stale");
    writeFileSync(path.join(candidate.root, "b.txt"), "original b");
    await coordinator.reconcile();
    assert.equal((await candidate.reconcile({ commandId: `patch:${runId}` })).kind, "conflict");
    assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "original b");
  });
  test("retained live inode bytes can be registered, reviewed and restored while preserving the current work", async () => {
    const entry = coordinator.savedVersions(runId).retained.find(entry => entry.kind === "available" && entry.relativePath === "a.txt");
    assert.ok(entry && entry.kind === "available");
    writeFileSync(entry.path, "late retained inode work");
    const selection = coordinator.captureRetained(runId, entry.entryKey);
    const inspected = await coordinator.previewRecovery({ runId, selection });
    assert.equal(inspected.intended[0]?.content, "late retained inode work");
    await coordinator.recover({ previewId: inspected.previewId, intendedPaths: ["a.txt"], operationId: "restore-live-capture" });
    assert.equal(readFileSync(path.join(candidate.root, "a.txt"), "utf8"), "late retained inode work");
    const preserved = coordinator.savedVersions(runId).versions.find(version => version.version.versionId === "preserved:restore-live-capture");
    assert.equal(preserved?.kind, "available"); assert.equal(preserved.images[0]?.content, "intended a.txt");
    assert.equal(readFileSync(entry.path, "utf8"), "late retained inode work");
  });
  test("mode-only changes and failed durable preservation reject mutation before successor registration", async () => {
    const inspected = await preview(); chmodSync(path.join(candidate.root, "b.txt"), 0o755);
    await assert.rejects(() => coordinator.recover({ previewId: inspected.previewId, intendedPaths: ["b.txt"], operationId: "mode-stale" }), /stale/);
    const fresh = await preview(); chmodSync(candidate.controlDirectory, 0o500);
    try { await assert.rejects(() => coordinator.recover({ previewId: fresh.previewId, intendedPaths: ["b.txt"], operationId: "cannot-preserve" })); }
    finally { chmodSync(candidate.controlDirectory, 0o700); }
    assert.equal(run().recoveries.length, 0); assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "new manual b");
  });

  test("a second coordinator cannot replay while the actual workspace writer awaits native publication", async () => {
    send({ kind: "finish-execution", runId, outcome: "unknown", summary: "Fixture completion", manifestHash: candidate.manifestHash() });
    const before = currentImages(run(), "source");
    const target = before.map(image => ({ ...image, content: `reviewed ${image.relativePath}`, mode: image.mode ?? 0o600 }));
    writeRecord(candidate.controlDirectory, `integration-checkpoint-${digest("writer-target")}.json`, target);
    const operation = coordinator.restore({ runId, target: "source", checkpointId: "writer-target", expectedManifestHash: imageHash(before), targetManifestHash: imageHash(target), operationId: "live-workspace-writer" });
    const pending = run().workspace; assert.equal(pending.kind, "writing"); assert.equal(pending.request.writer?.ownerPid, process.pid);
    assert.notEqual(pending.request.writer.ownerId, run().ownerId, "Workspace writer differs from the departed generation owner");
    const peer = createCoordinator();
    try {
      await peer.reconcile();
      assert.equal(run().workspace.kind, "writing");
      assert.equal(readFileSync(path.join(source, "b.txt"), "utf8"), "original b");
      assert.equal(ownsExecutionLease(run()), true);
      assert.equal((await operation).workspace.kind, "restored");
    } finally { peer.dispose(); }
  });
  test("a replacement cannot replay a departed owner's source journal while retired reconciliation is pending", async () => {
    send({ kind: "finish-execution", runId, outcome: "unknown", summary: "Fixture completion", manifestHash: candidate.manifestHash() });
    const before = currentImages(run(), "source");
    const target = before.map(image => ({ ...image, content: `reviewed ${image.relativePath}`, mode: image.mode ?? 0o600 }));
    const parentIdentityHash = digest(JSON.stringify(imageChanges(before, target).map(change => publicationParents(source, change.relativePath))));
    const operationId = "retired-replay";
    writeRecord(candidate.controlDirectory, `integration-checkpoint-${digest(operationId)}.json`, target);
    send({ kind: "begin-workspace-operation", runId, request: { kind: "restore", target: "source", checkpointId: operationId, expectedManifestHash: imageHash(before), targetManifestHash: imageHash(target), parentIdentityHash } }, operationId);
    assert.equal((await new WorkspaceIntegration({ candidate }).restore({ restoreCommandId: operationId, checkpointId: operationId, expectedManifestHash: imageHash(before), parentIdentityHash, afterStep: () => { throw new Error("Fixture interruption"); } })).kind, "partial");
    let start = () => {};
    let release = () => {};
    const entered = new Promise<void>(resolve => { start = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called with its integration receiver and restored in finally
    const { reconcile } = WorkspaceIntegration.prototype;
    let replays = 0;
    WorkspaceIntegration.prototype.reconcile = async function (input) {
      if (++replays === 1) { start(); await gate; }
      return reconcile.call(this, input);
    };
    const opening = coordinator.reconcile();
    try {
      await entered;
      coordinator.dispose();
      repository.close();
      repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
      coordinator = createCoordinator();
      await coordinator.reconcile();
      assert.equal(replays, 1, "the replacement cannot start the same replay before the first operation settles");
      assert.equal(readFileSync(path.join(source, "b.txt"), "utf8"), "original b");
      assert.ok(ownsExecutionLease(run()));
      release();
      await opening;
      await coordinator.reconcile();
      assert.equal(readFileSync(path.join(source, "b.txt"), "utf8"), "reviewed b.txt");
      assert.equal(run().workspace.kind, "restored");
    } finally {
      release();
      await opening;
      WorkspaceIntegration.prototype.reconcile = reconcile;
    }
  });
  test("restart reconciliation binds a partial source journal to SQLite before any further write", async () => {
    send({ kind: "finish-execution", runId, outcome: "unknown", summary: "Fixture completion", manifestHash: candidate.manifestHash() });
    const before = currentImages(run(), "source");
    const target = before.map(image => ({ ...image, content: `reviewed ${image.relativePath}`, mode: image.mode ?? 0o600 }));
    const parentIdentityHash = digest(JSON.stringify(imageChanges(before, target).map(change => publicationParents(source, change.relativePath))));
    writeRecord(candidate.controlDirectory, `integration-checkpoint-${digest("approved-target")}.json`, target);
    send({ kind: "begin-workspace-operation", runId, request: { kind: "restore", target: "source", checkpointId: "approved-target", expectedManifestHash: imageHash(before), targetManifestHash: imageHash(target), parentIdentityHash } }, "approved-source");
    assert.equal((await new WorkspaceIntegration({ candidate }).restore({ restoreCommandId: "approved-source", checkpointId: "approved-target", expectedManifestHash: imageHash(before), parentIdentityHash, afterStep: () => { throw new Error("restart"); } })).kind, "partial");
    const name = `integration-journal-${digest("approved-source")}.json`;
    const journal = readRecord(candidate.controlDirectory, name); assert.ok(typeof journal === "object" && journal !== null && "changes" in journal && Array.isArray(journal.changes));
    journal.changes[1] = { relativePath: "b.txt", before: "original b", after: "UNAPPROVED", beforeMode: 0o644, afterMode: 0o644 };
    writeRecord(candidate.controlDirectory, name, journal);
    coordinator.dispose(); repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite")); coordinator = createCoordinator();
    await coordinator.reconcile();
    assert.equal(readFileSync(path.join(source, "b.txt"), "utf8"), "original b");
    assert.equal(run().workspace.kind, "unknown"); assert.equal(ownsExecutionLease(run()), true);
  });
  test("partial source recovery keeps candidate and source namespaces separate and preserves untracked scoped work", async () => {
    send({ kind: "finish-execution", runId, outcome: "unknown", summary: "Fixture unknown completion", manifestHash: candidate.manifestHash() });
    const target = currentImages(run(), "source").map(image => ({ ...image, content: `source intended ${image.relativePath}`, mode: image.mode ?? 0o600 }));
    writeRecord(candidate.controlDirectory, `integration-checkpoint-${digest("source-fixture")}.json`, target);
    const before = currentImages(run(), "source");
    send({ kind: "begin-workspace-operation", runId, request: { kind: "restore", target: "source", checkpointId: "source-fixture", expectedManifestHash: imageHash(before), targetManifestHash: imageHash(target) } }, "source-partial");
    const integration = new WorkspaceIntegration({ candidate });
    assert.equal((await integration.restore({ restoreCommandId: "source-partial", checkpointId: "source-fixture", expectedManifestHash: imageHash(before), afterStep: () => { throw new Error("partial source fixture"); } })).kind, "partial");
    writeFileSync(path.join(source, "b.txt"), "source manual b"); writeFileSync(path.join(source, "new.txt"), "untracked scoped source work");
    send({ kind: "mark-workspace-unknown", runId, reason: "Partial source restore" });
    const inspected = await preview(); assert.equal(inspected.selection.target, "source");
    await coordinator.recover({ previewId: inspected.previewId, intendedPaths: ["b.txt"], operationId: "source-resolution" });
    assert.equal(readFileSync(path.join(source, "b.txt"), "utf8"), "source intended b.txt");
    assert.equal(readFileSync(path.join(source, "new.txt"), "utf8"), "untracked scoped source work");
    assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "new manual b");
    assert.equal((await integration.reconcile({ commandId: "source-partial" })).kind, "conflict");
    await assert.rejects(() => coordinator.previewRecovery({ runId, selection: { kind: "snapshot", target: "candidate", versionId: "preserved:source-resolution" } }), /not registered/);
    const saved = coordinator.savedVersions(runId).versions.find(version => version.version.versionId === "preserved:source-resolution");
    assert.equal(saved?.kind, "available"); assert.equal(saved.images[1]?.content, "source manual b");
  });

  test("missing current paths remain inspectable as unavailable and cannot authorize mutation", async () => {
    renameSync(candidate.root, `${candidate.root}-moved`);
    const inspected = await preview();
    assert.ok(inspected.blockers.length); assert.ok(inspected.states.every(state => state.kind === "unavailable"));
    await assert.rejects(() => coordinator.recover({ previewId: inspected.previewId, intendedPaths: [], operationId: "missing" }));
    assert.ok(coordinator.savedVersions(runId).versions.some(version => version.kind === "available"));
    assert.equal(ownsExecutionLease(run()), true);
  });

});
