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
    assert.equal(candidate.apply({ commandId: `patch:${runId}`, proposal, afterStep: () => { throw new Error("Fixture interruption"); } }).kind, "partial");
    writeFileSync(path.join(candidate.root, "b.txt"), "new manual b");
    send({ kind: "mark-execution-unknown", runId, reason: "Interrupted patch; user must review conflict" });
    coordinator = createCoordinator();
  });
  teardown(() => { coordinator.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true }); });
  test("mixed recovery preserves full scope, supersedes old replay, remains historical, and restores preserved newer work after restart", async () => {
    const inspected = preview(); assert.deepEqual(inspected.states.map(file => file.kind), ["after", "diverged", "before"]);
    const command = { previewId: inspected.previewId, intendedPaths: ["b.txt", "new.txt"], operationId: "mixed" };
    coordinator.recover(command);
    assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "intended b.txt");
    assert.equal(readFileSync(path.join(candidate.root, "new.txt"), "utf8"), "intended new.txt");
    assert.equal(ownsExecutionLease(run()), false); assert.equal(run().reviewFreshness.kind, "stale"); assert.equal(run().acceptance.kind, "unreviewed");
    assert.match(renderExecutionResult(repository.read(), runId), /historical evidence/i);
    assert.equal(candidate.reconcile({ commandId: `patch:${runId}` }).kind, "conflict");
    const version = coordinator.savedVersions(runId).versions.find(version => version.version.versionId === "preserved:mixed");
    assert.equal(version?.kind, "available"); assert.equal(version.images[1]?.content, "new manual b");
    writeFileSync(path.join(candidate.root, "b.txt"), "newer after recovery");
    coordinator.recover(command); assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "newer after recovery", "Duplicate command must not rewrite later edits");
    coordinator.dispose(); repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite")); coordinator = createCoordinator();
    const restored = coordinator.previewRecovery({ runId, selection: { kind: "snapshot", target: "candidate", versionId: "preserved:mixed" } });
    coordinator.recover({ previewId: restored.previewId, intendedPaths: ["b.txt", "new.txt"], operationId: "restore-preserved" });
    assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "new manual b");
    const newer = coordinator.savedVersions(runId).versions.find(version => version.version.versionId === "preserved:restore-preserved");
    assert.equal(newer?.kind, "available"); assert.equal(newer.images[1]?.content, "newer after recovery");
    await coordinator.reconcile(); assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "new manual b");
  });
  test("cancel, stale content, mode and project revisions cannot acquire successor authority", () => {
    const cancelled = preview(); coordinator.cancelRecovery(cancelled.previewId);
    assert.throws(() => coordinator.recover({ previewId: cancelled.previewId, intendedPaths: [], operationId: "cancel" }), /cancelled/);
    const stale = preview(); writeFileSync(path.join(candidate.root, "b.txt"), "changed while native review awaited");
    assert.throws(() => coordinator.recover({ previewId: stale.previewId, intendedPaths: ["b.txt"], operationId: "stale" }), /stale/);
    const revision = preview(); send({ kind: "set-scheduling-paused", paused: true });
    assert.throws(() => coordinator.recover({ previewId: revision.previewId, intendedPaths: [], operationId: "revision" }), /stale/);
    assert.equal(run().recoveries.length, 0); assert.equal(ownsExecutionLease(run()), true);
  });
  test("dirty buffers and foreign local ownership block keep-current as well as replacement", () => {
    dirty = true; const blocked = preview(); assert.match(blocked.blockers.join(" "), /Unsaved/);
    assert.throws(() => coordinator.recover({ previewId: blocked.previewId, intendedPaths: [], operationId: "dirty" }), /Unsaved/);
    dirty = false;
    const oldRun = run(); const inspected = previewRecoveryFiles(oldRun, coordinator.recoverySelection(runId), repository.read().revision);
    const target = prepareRecoveryFiles(oldRun, inspected, [], "foreign-successor");
    send({ kind: "begin-recovery", runId, request: { previewId: inspected.previewId, projectRevision: inspected.projectRevision, selection: inspected.selection, bindingHash: inspected.bindingHash, parentIdentityHash: digest(JSON.stringify(inspected.parentIdentities)), expectedManifestHash: inspected.currentManifestHash, targetManifestHash: imageHash(target), intendedPaths: [], reviewedAt: Date.now(), ownerId: "foreign-live-owner", ownerPid: process.pid } }, "foreign-successor");
    assert.match(preview().blockers.join(" "), /foreign live/i);
    assert.equal(ownsExecutionLease(run()), true);
  });
  test("SQLite successor registration retains one reservation through crash/restart and rejects an old finisher", async () => {
    const before = run(); const inspected = preview(); const target = prepareRecoveryFiles(before, inspected, ["b.txt"], "durable-successor");
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
    assert.equal(candidate.reconcile({ commandId: `patch:${runId}` }).kind, "conflict");
  });
  test("corrupt preservation and relocated parent retain successor ownership and do not touch replacement parent", async () => {
    const inspected = preview(); const target = prepareRecoveryFiles(run(), inspected, ["b.txt"], "corrupt");
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
    const before = lstatSync(path.join(candidate.root, "b.txt")); const inspected = preview();
    coordinator.recover({ previewId: inspected.previewId, intendedPaths: [], operationId: "keep" });
    assert.equal(lstatSync(path.join(candidate.root, "b.txt")).ino, before.ino);
    assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "new manual b");
    assert.equal(run().recoveries[0]?.intendedPaths.length, 0); assert.equal(run().reviewFreshness.kind, "stale");
    writeFileSync(path.join(candidate.root, "b.txt"), "original b");
    await coordinator.reconcile();
    assert.equal(candidate.reconcile({ commandId: `patch:${runId}` }).kind, "conflict");
    assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "original b");
  });
  test("retained live inode bytes can be registered, reviewed and restored while preserving the current work", () => {
    const entry = coordinator.savedVersions(runId).retained.find(entry => entry.kind === "available" && entry.relativePath === "a.txt");
    assert.ok(entry && entry.kind === "available");
    writeFileSync(entry.path, "late retained inode work");
    const selection = coordinator.captureRetained(runId, entry.entryKey);
    const inspected = coordinator.previewRecovery({ runId, selection });
    assert.equal(inspected.intended[0]?.content, "late retained inode work");
    coordinator.recover({ previewId: inspected.previewId, intendedPaths: ["a.txt"], operationId: "restore-live-capture" });
    assert.equal(readFileSync(path.join(candidate.root, "a.txt"), "utf8"), "late retained inode work");
    const preserved = coordinator.savedVersions(runId).versions.find(version => version.version.versionId === "preserved:restore-live-capture");
    assert.equal(preserved?.kind, "available"); assert.equal(preserved.images[0]?.content, "intended a.txt");
    assert.equal(readFileSync(entry.path, "utf8"), "late retained inode work");
  });
  test("mode-only changes and failed durable preservation reject mutation before successor registration", () => {
    const inspected = preview(); chmodSync(path.join(candidate.root, "b.txt"), 0o755);
    assert.throws(() => coordinator.recover({ previewId: inspected.previewId, intendedPaths: ["b.txt"], operationId: "mode-stale" }), /stale/);
    const fresh = preview(); chmodSync(candidate.controlDirectory, 0o500);
    try { assert.throws(() => coordinator.recover({ previewId: fresh.previewId, intendedPaths: ["b.txt"], operationId: "cannot-preserve" })); }
    finally { chmodSync(candidate.controlDirectory, 0o700); }
    assert.equal(run().recoveries.length, 0); assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "new manual b");
  });

  test("partial source recovery keeps candidate and source namespaces separate and preserves untracked scoped work", () => {
    send({ kind: "finish-execution", runId, outcome: "unknown", summary: "Fixture unknown completion", manifestHash: candidate.manifestHash() });
    const target = currentImages(run(), "source").map(image => ({ ...image, content: `source intended ${image.relativePath}`, mode: image.mode ?? 0o600 }));
    writeRecord(candidate.controlDirectory, `integration-checkpoint-${digest("source-fixture")}.json`, target);
    const before = currentImages(run(), "source");
    send({ kind: "begin-workspace-operation", runId, request: { kind: "restore", target: "source", checkpointId: "source-fixture", expectedManifestHash: imageHash(before), targetManifestHash: imageHash(target) } }, "source-partial");
    const integration = new WorkspaceIntegration({ candidate });
    assert.equal(integration.restore({ restoreCommandId: "source-partial", checkpointId: "source-fixture", expectedManifestHash: imageHash(before), afterStep: () => { throw new Error("partial source fixture"); } }).kind, "partial");
    writeFileSync(path.join(source, "b.txt"), "source manual b"); writeFileSync(path.join(source, "new.txt"), "untracked scoped source work");
    send({ kind: "mark-workspace-unknown", runId, reason: "Partial source restore" });
    const inspected = preview(); assert.equal(inspected.selection.target, "source");
    coordinator.recover({ previewId: inspected.previewId, intendedPaths: ["b.txt"], operationId: "source-resolution" });
    assert.equal(readFileSync(path.join(source, "b.txt"), "utf8"), "source intended b.txt");
    assert.equal(readFileSync(path.join(source, "new.txt"), "utf8"), "untracked scoped source work");
    assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "new manual b");
    assert.equal(integration.reconcile({ commandId: "source-partial" }).kind, "conflict");
    assert.throws(() => coordinator.previewRecovery({ runId, selection: { kind: "snapshot", target: "candidate", versionId: "preserved:source-resolution" } }), /not registered/);
    const saved = coordinator.savedVersions(runId).versions.find(version => version.version.versionId === "preserved:source-resolution");
    assert.equal(saved?.kind, "available"); assert.equal(saved.images[1]?.content, "source manual b");
  });

  test("missing current paths remain inspectable as unavailable and cannot authorize mutation", () => {
    renameSync(candidate.root, `${candidate.root}-moved`);
    const inspected = preview();
    assert.ok(inspected.blockers.length); assert.ok(inspected.states.every(state => state.kind === "unavailable"));
    assert.throws(() => coordinator.recover({ previewId: inspected.previewId, intendedPaths: [], operationId: "missing" }));
    assert.ok(coordinator.savedVersions(runId).versions.some(version => version.kind === "available"));
    assert.equal(ownsExecutionLease(run()), true);
  });

});
