import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ProjectCommand } from "../../../../packages/core/src/index.js";
import { parsePatchProposal } from "../../../../packages/core/src/execution-patch.js";
import { digest } from "../../src/candidate-journal.js";
import { publicationParents } from "../../src/scoped-publication.js";
import { CandidateWorkspace } from "../../src/candidate-workspace.js";
import { ExecutionCoordinator } from "../../src/execution-coordinator.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { WorkspaceIntegration } from "../../src/workspace-integration.js";
import { forecastFixture, consentFixture } from "./forecast-fixture.js";

export async function resultFixture(integrated = true) {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "piarre-result-review-")));
  const source = path.join(directory, "source"); const storage = path.join(directory, "storage"); mkdirSync(source); mkdirSync(storage);
  writeFileSync(path.join(source, "review.txt"), "original\n");
  const databasePath = path.join(directory, "project.sqlite");
  let repository = new SqliteProjectRepository(databasePath);
  repository.open({ repositoryUri: pathToFileURL(source).href, name: "Result review fixture" });
  let sequence = 0;
  const send = (action: ProjectCommand["action"], commandId = `fixture-${String(++sequence)}`) => {
    const project = repository.read();
    assert.equal(repository.dispatch({ commandId, projectId: project.projectId, expectedProjectRevision: project.revision, action }).kind, "applied");
  };
  send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose("Review scoped files") });
  const task = repository.read().tasks[0]; assert.ok(task);
  const candidate = CandidateWorkspace.capture({ repositoryRoot: source, storageDirectory: storage, relativePaths: ["review.txt"] });
  const check = { checkId: "content", argv: ["/usr/bin/true"] as const, criterionIds: ["content"] };
  send({ kind: "prepare-execution-plan", plan: { taskId: task.taskId, objective: "Review new content", criteria: [{ criterionId: "content", text: "New content" }], knowledge: [], files: candidate.files.map(file => file.baseline), checks: [check], candidateRoot: candidate.root, controlDirectory: candidate.controlDirectory, captureHash: candidate.captureHash, baselineCheckpoint: candidate.checkpoint({ checkpointId: "baseline" }), sourceRoot: source, provider: { kind: "codex-readonly-patch", authType: "unknown", requestedModel: "fixture" }, accountContext: { observedAt: new Date(1000).toISOString(), model: { kind: "unknown" }, usage: { kind: "unknown" } }, forecast: forecastFixture(), durationMs: 120_000, maxTokens: 1000 } });
  const plan = repository.read().executionPlans[0]; assert.ok(plan); const runId = "run:result-review";
  send({ kind: "approve-execution", spendingConsent: consentFixture(plan, runId), planId: plan.planId, planRevision: plan.recordedAtRevision, runId, ownerPid: 2147483647, ownerId: "departed-host", approvedAt: 1000, expiresAt: 120_000 });
  send({ kind: "request-execution", runId, requestedAt: 1000 });
  send({ kind: "observe-execution-provider", runId, model: "fixture", modelProvider: "openai", observedAt: 1001 });
  send({ kind: "bind-execution-thread", runId, threadId: "thread" });
  send({ kind: "bind-execution-turn", runId, threadId: "thread", turnId: "turn" });
  send({ kind: "observe-execution-terminal", runId, threadId: "thread", turnId: "turn", status: "completed", observedAt: 1002 });
  send({ kind: "begin-candidate-apply", runId, observedAt: 2000 });
  await candidate.apply({ commandId: `patch:${runId}`, proposal: parsePatchProposal({ files: plan.files, value: { summary: "New content", operations: [{ fileId: candidate.files[0]?.baseline.fileId, content: "reviewed\n" }] } }) });
  send({ kind: "begin-execution-check", runId, checkId: check.checkId, nonce: "check-nonce", requestedAt: 2001, controlDirectory: path.join(directory, "check") });
  send({ kind: "bind-check-process", runId, checkId: check.checkId, nonce: "check-nonce", pid: 123, watchdogPid: 124, startedAt: 2002, controlDirectory: path.join(directory, "check") });
  send({ kind: "record-execution-check", runId, evidence: { ...check, nonce: "check-nonce", termination: "observed", kind: "passed", exitCode: 0, signal: null, stdout: "passed", stderr: "", manifestHash: candidate.manifestHash(), observedAt: 3000 } });
  send({ kind: "finish-execution", runId, summary: "New content checked", outcome: "needs-review", manifestHash: candidate.manifestHash() });
  if (integrated) {
    const run = repository.read().executionRuns[0]; assert.ok(run?.state.kind === "terminal");
    const integration = new WorkspaceIntegration({ candidate }); const preview = integration.preview();
    const parentIdentityHash = digest(JSON.stringify(preview.changes.map(change => publicationParents(candidate.sourceRoot, change.relativePath))));
    send({ kind: "begin-workspace-operation", runId, request: { kind: "integrate", parentIdentityHash, resultId: run.state.result.resultId, resultRevision: run.state.result.recordedAtRevision, expectedManifestHash: preview.sourceManifestHash, targetManifestHash: preview.currentCandidateHash } }, "original-integration");
    const publication = await integration.apply({ commandId: "original-integration", parentIdentityHash, expectedSourceManifestHash: preview.sourceManifestHash, expectedCandidateManifestHash: preview.currentCandidateHash });
    assert.equal(publication.kind, "changed");
    repository.close(); repository = new SqliteProjectRepository(databasePath);
  }
  const dirty = { value: false };
  const control = new ExecutionCoordinator({ hasDirtyDocuments: () => dirty.value, repository, storageDirectory: storage, createClient: () => { throw new Error("Review cannot call a provider"); }, publish: () => {} });
  if (integrated) await control.reconcile();
  return { dirty, directory, source, storage, databasePath, repository, candidate, control, runId, send,
    dispose: () => { control.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true }); } };
}
