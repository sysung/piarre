import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ExecutionCoordinator } from "../../src/execution-coordinator.js";
import { CandidateCheckRunner } from "../../src/candidate-check-runner.js";
import type { CodexConversationClient } from "../../src/codex-conversation-client.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { ownsExecutionLease } from "../../../../packages/core/src/index.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";

const nodeExecutable = process.env.PIARRE_TEST_NODE ?? process.execPath;
type Client = Pick<CodexConversationClient, "connect" | "readExecutionContext" | "proposePatch" | "interrupt" | "dispose">;
suite("Execution coordinator actual backend", () => {
  let directory: string; let source: string; let storage: string; let repository: SqliteProjectRepository; let taskId: string;
  let requests: number; let dirty: boolean; let loseAcknowledgment: boolean;
  const createClient = (): Client => ({
    connect: () => Promise.resolve({ kind: "ready", authType: "unknown" }),
    readExecutionContext: () => Promise.resolve({ observedAt: new Date().toISOString(), model: { kind: "resolved-default", model: "fixture-model" }, usage: { kind: "unknown" }, taskForecast: { kind: "unknown" } }),
    proposePatch: input => {
      requests++; input.onThreadMetadata?.({ model: "fixture-model", modelProvider: "openai" }); input.onThreadStarted?.("fixture-thread");
      if (loseAcknowledgment) throw new Error("Fixture lost acknowledgment");
      input.onTurnStarted?.("fixture-thread", "fixture-turn");
      const prompt: unknown = JSON.parse(input.prompt);
      assert.ok(typeof prompt === "object" && prompt !== null && "files" in prompt && Array.isArray(prompt.files));
      const first: unknown = prompt.files[0]; assert.ok(typeof first === "object" && first !== null && "baseline" in first);
      const baseline = first.baseline; assert.ok(typeof baseline === "object" && baseline !== null && "fileId" in baseline && typeof baseline.fileId === "string");
      return Promise.resolve({ status: "completed", threadId: "fixture-thread", turnId: "fixture-turn", output: { summary: "Change refund window to 45 days", operations: [{ fileId: baseline.fileId, content: "45\n" }] } });
    }, interrupt: () => Promise.resolve(), dispose: () => undefined,
  });
  const coordinator = () => new ExecutionCoordinator({ repository, storageDirectory: storage, createClient, publish: () => undefined, hasDirtyDocuments: () => dirty });
  const prepare = () => coordinator().prepare({ taskId, relativePaths: ["refund.txt"], objective: "Set refund window to 45 days", criteria: [{ criterionId: "days", text: "Window is 45 days" }], checks: [{ checkId: "value", argv: [nodeExecutable, "-e", "require('node:assert/strict').equal(require('node:fs').readFileSync('refund.txt','utf8'),'45\\n')"], criterionIds: ["days"] }] });
  setup(async () => {
    requests = 0; dirty = false; loseAcknowledgment = false;
    directory = mkdtempSync(path.join(tmpdir(), "piarre-coordinator-")); source = path.join(directory, "source"); storage = path.join(directory, "storage"); mkdirSync(source); mkdirSync(storage);
    writeFileSync(path.join(source, "refund.txt"), "30\n"); writeFileSync(path.join(source, "private.txt"), "private undisclosed");
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite")); const project = repository.open({ repositoryUri: pathToFileURL(source).href, name: "Fixture" });
    const draft = await new GoalInterpreter().propose("Implement refund policy"); repository.dispatch({ commandId: "proposal", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "propose-tasks", draft } });
    const first = repository.read().tasks[0]; assert.ok(first); taskId = first.taskId;
  });
  teardown(() => { repository.close(); rmSync(directory, { recursive: true, force: true }); });
  test("missing default model requires an explicit selection before persisting approval scope", async () => {
    const control = new ExecutionCoordinator({ repository, storageDirectory: storage, publish: () => undefined,
      createClient: () => ({ ...createClient(), readExecutionContext: () => Promise.resolve({ observedAt: new Date().toISOString(), model: { kind: "unknown" }, usage: { kind: "unknown" }, taskForecast: { kind: "unknown" } }) }) });
    const input: Parameters<ExecutionCoordinator["prepare"]>[0] = { taskId, relativePaths: ["refund.txt"], objective: "45 days", criteria: [{ criterionId: "days", text: "45 days" }], checks: [{ checkId: "value", argv: [nodeExecutable, "--version"], criterionIds: ["days"] }] };
    await assert.rejects(control.prepare(input), /explicit coding model/);
    assert.equal(repository.read().executionPlans.length, 0); assert.equal(requests, 0);
    const prepared = await control.prepare({ ...input, requestedModel: "fixture-model" });
    assert.equal(prepared.plan.provider.requestedModel, "fixture-model");
    assert.equal(prepared.plan.accountContext.model.kind, "unknown");
    assert.equal(requests, 0);
  });
  test("provider model mismatch is recorded without starting a turn or applying source", async () => {
    const { plan } = await prepare(); let turnStarted = false;
    const control = new ExecutionCoordinator({ repository, storageDirectory: storage, publish: () => undefined,
      createClient: () => ({ ...createClient(), proposePatch: input => {
        input.onThreadMetadata?.({ model: "different-model", modelProvider: "openai" });
        turnStarted = true; return Promise.reject(new Error("Generation must not start"));
      } }) });
    const run = await control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "mismatch" });
    assert.equal(turnStarted, false); assert.equal(run.providerObservation.kind, "unobserved");
    assert.equal(run.state.kind, "terminal"); assert.match(run.state.result.summary, /differs from the approved plan/);
    assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n");
  });
  test("preparation generates nothing; manual edits and dirty buffers block approval", async () => {
    const prepared = await prepare(); assert.equal(requests, 0);
    dirty = true;
    await assert.rejects(coordinator().approveAndRun({ planId: prepared.plan.planId, planRevision: prepared.plan.recordedAtRevision, approvalId: "dirty" }), /dirty/);
    dirty = false; writeFileSync(path.join(source, "refund.txt"), "manual edit");
    await assert.rejects(coordinator().approveAndRun({ planId: prepared.plan.planId, planRevision: prepared.plan.recordedAtRevision, approvalId: "manual" }), /changed/);
    assert.equal(requests, 0); assert.equal(repository.read().executionRuns.length, 0);
  });
  test("lost acknowledgment retains ownership across restart and blocks replacement requests", async () => {
    const { plan } = await prepare(); loseAcknowledgment = true;
    const input = { planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "lost" };
    const control = coordinator(); const run = await control.approveAndRun(input);
    assert.equal(requests, 1); assert.equal(run.state.kind, "unknown");
    assert.equal(ownsExecutionLease(run), true);
    assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n");
    control.dispose(); repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    const recovered = coordinator(); await recovered.reconcile();
    assert.equal(repository.read().executionRuns[0]?.state.kind, "unknown");
    await recovered.approveAndRun(input); assert.equal(requests, 1);
    await assert.rejects(recovered.approveAndRun({ ...input, approvalId: "replacement" }));
    assert.equal(requests, 1);
    await assert.rejects(recovered.approveAndRun({ ...input, planRevision: 1 }), /conflicts/);
    const resolved = recovered.abandonProvider({ runId: run.runId, reason: "Explicit fixture review acknowledges possible continuing provider usage." });
    assert.equal(resolved.providerOutcome.kind, "abandoned"); assert.equal(resolved.state.kind, "terminal");
    assert.equal(resolved.state.result.outcome, "unknown"); assert.equal(ownsExecutionLease(resolved), false);
    assert.match(resolved.state.result.summary, /Remote activity and charges may continue/);
    assert.throws(() => recovered.abandonProvider({ runId: run.runId, reason: "Repeated consent" }));
    const replacement = await recovered.approveAndRun({ ...input, approvalId: "explicit-replacement" });
    assert.equal(requests, 2); assert.equal(replacement.state.kind, "unknown");
  });
  test("real sandbox checks gate review, integration preserves source until approval, restore protects newer bytes", async function () {
    if ((await new CandidateCheckRunner().capability()).kind === "unsupported") { this.skip(); return; }
    const control = coordinator(); const { plan } = await control.prepare({ taskId, relativePaths: ["refund.txt"], objective: "45 days", criteria: [{ criterionId: "days", text: "45 days" }], checks: [{ checkId: "value", argv: [nodeExecutable, "-e", "require('node:assert/strict').equal(require('node:fs').readFileSync('refund.txt','utf8'),'45\\n')"], criterionIds: ["days"] }] });
    const input = { planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "approved" };
    const run = await control.approveAndRun(input); assert.equal(run.state.kind, "terminal");
    assert.equal(run.state.result.outcome, "needs-review"); assert.equal(run.evidence[0]?.kind, "passed");
    assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n"); assert.equal(control.inspection({ runId: run.runId }).diff.length, 1);
    await control.approveAndRun(input); assert.equal(requests, 1);
    const review = { runId: run.runId, resultId: run.state.result.resultId, resultRevision: run.state.result.recordedAtRevision, operationId: "apply" };
    assert.equal((await control.applyAndAccept(review)).acceptance.kind, "accepted"); assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "45\n");
    writeFileSync(path.join(source, "refund.txt"), "new manual work");
    await control.applyAndAccept(review); assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "new manual work");
    const preview = control.previewRestore({ runId: run.runId, target: "source", checkpointId: "integration-before:apply" });
    const restored = control.restore({ runId: run.runId, target: "source", checkpointId: "integration-before:apply", expectedManifestHash: preview.currentManifestHash, targetManifestHash: preview.targetManifestHash, operationId: "restore" });
    assert.equal(restored.reviewFreshness.kind, "stale"); assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n");
    assert.equal(readFileSync(path.join(source, "private.txt"), "utf8"), "private undisclosed");
  });
  test("stop reaches the real running watchdog and records interruption without passing evidence", async function () {
    if ((await new CandidateCheckRunner().capability()).kind === "unsupported") { this.skip(); return; }
    let requestedStop = false;
    const control = new ExecutionCoordinator({ repository, storageDirectory: storage, createClient,
      publish: snapshot => {
        const running = snapshot.executionRuns.find(run => run.process.kind === "running");
        if (running && !requestedStop) { requestedStop = true; queueMicrotask(() => { void control.stop({ runId: running.runId }); }); }
      } });
    const { plan } = await control.prepare({ taskId, relativePaths: ["refund.txt"], objective: "45 days", durationMs: 5000,
      criteria: [{ criterionId: "days", text: "45 days" }], checks: [{ checkId: "wait", argv: [nodeExecutable, "-e", "setTimeout(()=>{},30000)"], criterionIds: ["days"] }] });
    const run = await control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "stop" });
    assert.equal(requestedStop, true); assert.equal(run.state.kind, "terminal");
    assert.equal(run.state.result.outcome, "failed"); assert.equal(run.evidence[0]?.kind, "failed");
    assert.equal(run.evidence[0].termination, "observed"); assert.equal(run.process.kind, "none");
    assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n");
  });
  test("candidate edits after a real passing check invalidate review and block integration", async function () {
    if ((await new CandidateCheckRunner().capability()).kind === "unsupported") { this.skip(); return; }
    const control = coordinator(); const { plan } = await prepare();
    const run = await control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "stale" });
    assert.equal(run.state.kind, "terminal"); assert.equal(run.state.result.outcome, "needs-review");
    writeFileSync(path.join(control.candidateForRun(run.runId).root, "refund.txt"), "unverified manual candidate edit");
    control.refreshWorkspaceFreshness();
    assert.equal(repository.read().executionRuns[0]?.reviewFreshness.kind, "stale");
    await assert.rejects(control.applyAndAccept({ runId: run.runId, resultId: run.state.result.resultId, resultRevision: run.state.result.recordedAtRevision, operationId: "stale-apply" }), /changed/);
    assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n");
  });
  test("disposal persists uncertain ownership and late provider rejection does not access a closed database", async () => {
    const { plan } = await prepare();
    let rejectTurn: (error: Error) => void = () => undefined;
    let started: () => void = () => undefined;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const pending = new Promise<never>((_, reject) => { rejectTurn = reject; });
    const control = new ExecutionCoordinator({ repository, storageDirectory: storage, publish: () => undefined,
      createClient: () => ({ ...createClient(), proposePatch: input => { input.onThreadMetadata?.({ model: "fixture-model", modelProvider: "openai" }); input.onThreadStarted?.("pending-thread"); started(); return pending; }, dispose: () => { rejectTurn(new Error("Disposed provider")); } }) });
    const completion = control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "disposing" });
    await ready; control.dispose();
    const before = repository.read(); assert.equal(before.executionRuns[0]?.state.kind, "unknown");
    repository.close();
    const run = await completion; assert.equal(run.state.kind, "unknown");
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    assert.deepEqual(repository.read(), before);
    await coordinator().reconcile();
    assert.equal(repository.read().executionRuns[0]?.state.kind, "unknown");
    assert.equal(repository.read().executionRuns.some(ownsExecutionLease), true);
    assert.equal(requests, 0);
  });
  test("pause survives restart and blocks a prepared approval", async () => {
    const { plan } = await prepare(); await coordinator().stopAll(); repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    assert.equal(repository.read().schedulingPaused, true);
    await assert.rejects(coordinator().approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "paused" })); assert.equal(requests, 0);
    coordinator().resume(); assert.equal(repository.read().schedulingPaused, false);
  });
});
