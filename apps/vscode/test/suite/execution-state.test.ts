import { DatabaseSync } from "node:sqlite";
import { forecastFixture, consentFixture } from "./forecast-fixture.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { currentKnowledge, currentExecutionPlan, planFreshness, ownsExecutionLease, type ExecutionPlanDraft, type ProjectCommand, type CheckEvidence } from "../../../../packages/core/src/index.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";

suite("Durable execution authority and freshness", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  let taskId: string;
  let sequence = 0;
  const hash = "a".repeat(64);
  const send = (action: ProjectCommand["action"]) => repository.dispatch({ commandId: `command-${String(++sequence)}`,
    projectId: repository.read().projectId, expectedProjectRevision: repository.read().revision, action });
  const draft = (): ExecutionPlanDraft => ({ taskId, objective: "Refund window is 45 days", criteria: [{ criterionId: "refund-days", text: "45-day window" }],
    knowledge: currentKnowledge(repository.read()).map(entry => ({ projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision })),
    files: [{ kind: "absent", fileId: "file-1", relativePath: "refunds.ts" }],
    checks: [{ checkId: "refund-check", argv: ["/usr/bin/node", "test.js"], criterionIds: ["refund-days"] }],
    candidateRoot: "/tmp/run-candidate", controlDirectory: "/tmp/capture-control", captureHash: hash, baselineCheckpoint: { checkpointId: "before-run", manifestHash: hash }, sourceRoot: "/tmp/project", provider: { kind: "codex-readonly-patch", authType: "unknown", requestedModel: "fixture-model" }, forecast: forecastFixture(), accountContext: { observedAt: "2026-11-02T00:00:00.000Z", model: { kind: "resolved-default", model: "fixture-model" }, usage: { kind: "unknown" } }, durationMs: 120_000, maxTokens: 4000 });
  const plan = () => { const found = currentExecutionPlan(repository.read(), taskId); if (!found) throw new Error("Missing test plan"); return found; };
  const prepare = () => { send({ kind: "prepare-execution-plan", plan: draft() }); return plan(); };
  const approve = (runId = "run-1") => { const prepared = plan(); return send({ kind: "approve-execution", planId: prepared.planId, planRevision: prepared.recordedAtRevision, runId, spendingConsent: consentFixture(prepared, runId), approvedAt: 1000, expiresAt: 5000, ownerPid: 12345, ownerId: "owner" }); };
  const generating = () => {
    prepare(); approve(); send({ kind: "request-execution", runId: "run-1", requestedAt: 1100 });
    send({ kind: "observe-execution-provider", runId: "run-1", model: "fixture-model", modelProvider: "openai", observedAt: 1101 });
    send({ kind: "bind-execution-thread", runId: "run-1", threadId: "thread" });
    send({ kind: "bind-execution-turn", runId: "run-1", threadId: "thread", turnId: "turn" });
    send({ kind: "observe-execution-terminal", runId: "run-1", threadId: "thread", turnId: "turn", status: "completed", observedAt: 1102 });
  };
  const checking = () => {
    generating(); send({ kind: "begin-candidate-apply", runId: "run-1", observedAt: 2000 });
    send({ kind: "begin-execution-check", runId: "run-1", checkId: "refund-check", nonce: "nonce", requestedAt: 2001, controlDirectory: "/tmp/check-control" });
    send({ kind: "bind-check-process", runId: "run-1", checkId: "refund-check", nonce: "nonce", pid: 123, watchdogPid: 124, startedAt: 2002, controlDirectory: "/tmp/check-control" });
  };
  const evidence = (changes: Partial<CheckEvidence> = {}): CheckEvidence => ({ checkId: "refund-check", nonce: "nonce", kind: "passed", termination: "observed", criterionIds: ["refund-days"], argv: ["/usr/bin/node", "test.js"], exitCode: 0, signal: null, stdout: "passed", stderr: "", manifestHash: hash, observedAt: 3000, ...changes });
  setup(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-execution-"));
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    const project = repository.open({ repositoryUri: "file:///execution-test", name: "Execution test" });
    const proposal = await new GoalInterpreter().propose("Implement refund policy");
    repository.dispatch({ commandId: "proposal", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "propose-tasks", draft: proposal } });
    const first = repository.read().tasks[0]; assert.ok(first); taskId = first.taskId;
  });
  teardown(() => { repository.close(); rmSync(directory, { recursive: true, force: true }); });

  test("historical events migrate once to unknown forecasts and cannot acquire new generation authority", () => {
    prepare(); approve(); repository.close();
    const database = new DatabaseSync(path.join(directory, "project.sqlite"));
    const rows = database.prepare("SELECT revision, payload FROM events ORDER BY revision").all();
    for (const row of rows) {
      assert.ok(typeof row.payload === "string" && typeof row.revision === "number"); const payload: unknown = JSON.parse(row.payload);
      if (typeof payload !== "object" || payload === null || !("action" in payload) || typeof payload.action !== "object" || payload.action === null || !("kind" in payload.action)) continue;
      if (payload.action.kind === "prepare-execution-plan" && "plan" in payload.action && typeof payload.action.plan === "object" && payload.action.plan !== null) Reflect.deleteProperty(payload.action.plan, "forecast");
      if (payload.action.kind === "approve-execution") Reflect.deleteProperty(payload.action, "spendingConsent");
      database.prepare("UPDATE events SET payload = ? WHERE revision = ?").run(JSON.stringify(payload), row.revision);
    }
    database.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    assert.deepEqual(plan().forecast, { kind: "legacy-unknown" }); assert.deepEqual(repository.read().executionRuns[0]?.grant.spendingConsent, { kind: "legacy-unconfirmed" });
    const before = repository.read(); assert.throws(() => send({ kind: "request-execution", runId: "run-1", requestedAt: 1100 }), /Historical spending authority/); assert.deepEqual(repository.read(), before);
    assert.throws(() => send({ kind: "approve-execution", planId: plan().planId, planRevision: plan().recordedAtRevision, runId: "new", approvedAt: 1000, expiresAt: 5000, ownerPid: 1, ownerId: "owner", spendingConsent: { kind: "legacy-unconfirmed" } }));
  });
  test("financial consent cannot be replayed for another forecast, plan revision, route or attempt", () => {
    const prepared = prepare(); const base = consentFixture(prepared, "run-1"); assert.equal(base.kind, "native-uncertain-one-attempt");
    for (const change of [{ forecastId: "other" }, { configurationHash: "b".repeat(64) }, { planRevision: prepared.recordedAtRevision + 1 }, { runId: "other" }, { route: "api" } as const]) {
      assert.throws(() => send({ kind: "approve-execution", planId: prepared.planId, planRevision: prepared.recordedAtRevision, runId: "run-1", approvedAt: 1000, expiresAt: 5000, ownerPid: 1, ownerId: "owner", spendingConsent: { ...base, ...change } }));
    }
    assert.equal(repository.read().executionRuns.length, 0); approve(); assert.equal(repository.read().executionRuns.length, 1);
  });
  test("unknown or changed provider metadata cannot authorize a generation turn", () => {
    prepare(); approve(); send({ kind: "request-execution", runId: "run-1", requestedAt: 1100 });
    assert.throws(() => send({ kind: "bind-execution-thread", runId: "run-1", threadId: "thread" }));
    for (const metadata of [{ model: "other-model", modelProvider: "openai" }, { model: "fixture-model", modelProvider: "other-provider" }]) {
      assert.throws(() => send({ kind: "observe-execution-provider", runId: "run-1", ...metadata, observedAt: 1101 }));
    }
    send({ kind: "set-scheduling-paused", paused: true });
    assert.throws(() => send({ kind: "observe-execution-provider", runId: "run-1", model: "fixture-model", modelProvider: "openai", observedAt: 1101 }));
    assert.equal(repository.read().executionRuns[0]?.providerObservation.kind, "unobserved");
    assert.equal(repository.read().executionRuns.some(ownsExecutionLease), true);
  });
  test("plan changes during thread capability checks block the outbound turn", () => {
    prepare(); approve(); send({ kind: "request-execution", runId: "run-1", requestedAt: 1100 });
    send({ kind: "observe-execution-provider", runId: "run-1", model: "fixture-model", modelProvider: "openai", observedAt: 1101 });
    prepare();
    assert.throws(() => send({ kind: "bind-execution-thread", runId: "run-1", threadId: "stale-thread" }));
    assert.equal(repository.read().executionRuns[0]?.providerTurn.kind, "unacknowledged");
    assert.equal(repository.read().executionRuns.some(ownsExecutionLease), true);
  });
  test("duplicate approval receipts cannot reserve another attempt and retain the historical snapshot", () => {
    const prepared = prepare(); const before = repository.read();
    const command = { commandId: "one-approval", projectId: before.projectId, expectedProjectRevision: before.revision,
      action: { kind: "approve-execution", planId: prepared.planId, planRevision: prepared.recordedAtRevision, runId: "run-1", spendingConsent: consentFixture(prepared, "run-1"), approvedAt: 1000, expiresAt: 5000, ownerPid: 12345, ownerId: "owner" } };
    const applied = repository.dispatch(command); assert.equal(applied.kind, "applied");
    send({ kind: "request-execution", runId: "run-1", requestedAt: 1100 });
    const duplicate = repository.dispatch(command); assert.equal(duplicate.kind, "duplicate");
    assert.deepEqual(duplicate.snapshot, applied.snapshot);
    assert.equal(repository.read().executionRuns.length, 1);
    assert.equal(repository.read().executionRuns[0]?.state.kind, "generating");
  });
  test("one persistent lease survives lost acknowledgment, restart, correction and scheduling pause", () => {
    generating(); send({ kind: "mark-execution-unknown", runId: "run-1", reason: "Lost provider acknowledgment" });
    send({ kind: "set-scheduling-paused", paused: true });
    const before = repository.read(); repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    assert.deepEqual(repository.read(), before);
    assert.equal(repository.read().executionRuns.some(ownsExecutionLease), true);
    assert.throws(() => approve("replacement"));
    send({ kind: "set-scheduling-paused", paused: false });
    assert.throws(() => approve("replacement"));
    assert.throws(() => send({ kind: "begin-candidate-apply", runId: "run-1", observedAt: 2000 }));
  });
  test("two repository connections cannot reserve concurrent runs", () => {
    prepare(); const second = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    try {
      const observed = second.read(); approve();
      const prepared = plan();
      assert.equal(second.dispatch({ commandId: "racing-approval", projectId: observed.projectId, expectedProjectRevision: observed.revision,
        action: { kind: "approve-execution", planId: prepared.planId, planRevision: prepared.recordedAtRevision, runId: "run-2", spendingConsent: consentFixture(prepared, "run-2"), approvedAt: 1000, expiresAt: 5000, ownerPid: 12345, ownerId: "owner" } }).kind, "stale");
    } finally { second.close(); }
  });
  test("expiry and elapsed deadlines block outbound generation and late file application", () => {
    prepare(); approve();
    assert.throws(() => send({ kind: "request-execution", runId: "run-1", requestedAt: 5000 }));
    send({ kind: "request-execution", runId: "run-1", requestedAt: 1100 });
    send({ kind: "observe-execution-provider", runId: "run-1", model: "fixture-model", modelProvider: "openai", observedAt: 1101 });
    send({ kind: "bind-execution-thread", runId: "run-1", threadId: "thread" });
    send({ kind: "bind-execution-turn", runId: "run-1", threadId: "thread", turnId: "turn" });
    send({ kind: "observe-execution-terminal", runId: "run-1", threadId: "thread", turnId: "turn", status: "completed", observedAt: 1102 });
    assert.throws(() => send({ kind: "begin-candidate-apply", runId: "run-1", observedAt: 121000 }));
  });
  test("uncertain process termination retains the lease until actual reconciliation", () => {
    checking();
    send({ kind: "record-execution-check", runId: "run-1", evidence: evidence({ kind: "unknown", termination: "unconfirmed", exitCode: null }) });
    assert.equal(repository.read().executionRuns[0]?.process.kind, "unknown");
    assert.equal(repository.read().executionRuns[0]?.state.kind, "unknown");
    assert.throws(() => send({ kind: "finish-execution", runId: "run-1", summary: "Cannot prove stopped", outcome: "unknown", manifestHash: hash }));
    assert.throws(() => send({ kind: "reconcile-execution-process", runId: "run-1", nonce: "wrong", reason: "Wrong identity", evidence: null }));
    send({ kind: "reconcile-execution-process", runId: "run-1", nonce: "nonce", reason: "Matching process identity observed terminal", evidence: null });
    send({ kind: "finish-execution", runId: "run-1", summary: "Completion unknown", outcome: "unknown", manifestHash: hash });
    assert.equal(repository.read().executionRuns.some(ownsExecutionLease), false);
  });
  for (const invalidEvidence of [evidence({ exitCode: 1 }), evidence({ termination: "unconfirmed" }), evidence({ nonce: "wrong" }), evidence({ criterionIds: ["invented"] }), evidence({ argv: ["/usr/bin/node", "different.js"] }), evidence({ observedAt: 121000 })]) {
    test(`rejects forged or stale passing evidence ${JSON.stringify(invalidEvidence)}`, () => {
      checking(); const before = repository.read();
      assert.throws(() => send({ kind: "record-execution-check", runId: "run-1", evidence: invalidEvidence }));
      assert.deepEqual(repository.read(), before);
    });
  }
  test("completion, current criterion checks and acceptance remain separate", () => {
    checking();
    assert.throws(() => send({ kind: "finish-execution", runId: "run-1", summary: "Too early", outcome: "needs-review", manifestHash: hash }));
    send({ kind: "record-execution-check", runId: "run-1", evidence: evidence() });
    assert.throws(() => send({ kind: "finish-execution", runId: "run-1", summary: "Wrong bytes", outcome: "needs-review", manifestHash: "b".repeat(64) }));
    send({ kind: "finish-execution", runId: "run-1", summary: "Current check passed", outcome: "needs-review", manifestHash: hash });
    const run = repository.read().executionRuns[0]; assert.ok(run); assert.equal(run.acceptance.kind, "unreviewed");
    assert.equal(run.state.kind, "terminal");
    const result = run.state.result;
    assert.throws(() => send({ kind: "accept-execution-result", runId: run.runId, resultId: result.resultId, resultRevision: result.recordedAtRevision - 1 }));
    assert.throws(() => send({ kind: "accept-execution-result", runId: run.runId, resultId: result.resultId, resultRevision: result.recordedAtRevision }));
    send({ kind: "begin-workspace-operation", runId: run.runId, request: { kind: "integrate", resultId: result.resultId, resultRevision: result.recordedAtRevision, expectedManifestHash: "b".repeat(64), targetManifestHash: hash } });
    const writing = repository.read().executionRuns[0]?.workspace; assert.equal(writing?.kind, "writing");
    assert.ok(writing); assert.equal(writing.kind, "writing");
    assert.throws(() => send({ kind: "finish-workspace-operation", runId: run.runId, operationId: writing.operationId, manifestHash: "c".repeat(64), observedAt: 4000 }));
    send({ kind: "finish-workspace-operation", runId: run.runId, operationId: writing.operationId, manifestHash: hash, observedAt: 4000 });
    send({ kind: "accept-execution-result", runId: run.runId, resultId: result.resultId, resultRevision: result.recordedAtRevision });
    assert.equal(repository.read().executionRuns[0]?.acceptance.kind, "accepted");
  });
  test("a new plan invalidates old result authority while preserving its historical check", () => {
    checking(); send({ kind: "record-execution-check", runId: "run-1", evidence: evidence() });
    send({ kind: "finish-execution", runId: "run-1", summary: "Historical", outcome: "needs-review", manifestHash: hash });
    const oldPlan = plan(); prepare(); assert.equal(planFreshness(repository.read(), oldPlan), "stale");
    const run = repository.read().executionRuns[0]; assert.ok(run); assert.equal(run.state.kind, "terminal");
    const result = run.state.result;
    assert.throws(() => send({ kind: "accept-execution-result", runId: run.runId, resultId: result.resultId, resultRevision: result.recordedAtRevision }));
    assert.equal(repository.read().executionRuns[0]?.evidence.length, 1);
  });
  test("knowledge corrections invalidate plan authority but cannot release an uncertain run", () => {
    const snapshot = repository.read();
    send({ kind: "observe-knowledge", topic: "Refund window", category: "business", submitted: { projectId: snapshot.projectId, requestId: "knowledge", contextRevision: snapshot.revision, originalStatement: "30 days" }, affectedTaskIds: [taskId] });
    let entry = currentKnowledge(repository.read())[0]; assert.ok(entry);
    send({ kind: "confirm-knowledge", target: { projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision } });
    generating(); const oldPlan = plan();
    send({ kind: "mark-execution-unknown", runId: "run-1", reason: "Provider disconnected" });
    entry = currentKnowledge(repository.read())[0]; assert.ok(entry);
    send({ kind: "correct-knowledge", target: { projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision }, submitted: { projectId: entry.projectId, requestId: "correction", contextRevision: repository.read().revision, originalStatement: "45 days" }, affectedTaskIds: [taskId] });
    assert.equal(planFreshness(repository.read(), oldPlan), "stale");
    assert.equal(repository.read().executionRuns.some(ownsExecutionLease), true);
    const groupId = repository.read().tasks.find(task => task.taskId === taskId)?.groupId; assert.ok(groupId);
    assert.throws(() => send({ kind: "delete-proposal", groupId }));
    prepare(); assert.equal(planFreshness(repository.read(), plan()), "current");
    assert.throws(() => approve("new-run"));
  });
  test("partial source operations retain a lease and restore invalidates earlier acceptance", () => {
    checking(); send({ kind: "record-execution-check", runId: "run-1", evidence: evidence() });
    send({ kind: "finish-execution", runId: "run-1", summary: "Ready", outcome: "needs-review", manifestHash: hash });
    const run = repository.read().executionRuns[0]; assert.ok(run); assert.equal(run.state.kind, "terminal"); const result = run.state.result;
    send({ kind: "begin-workspace-operation", runId: run.runId, request: { kind: "integrate", resultId: result.resultId, resultRevision: result.recordedAtRevision, expectedManifestHash: "b".repeat(64), targetManifestHash: hash } });
    const writing = repository.read().executionRuns[0]?.workspace; assert.ok(writing); assert.equal(writing.kind, "writing");
    send({ kind: "mark-workspace-unknown", runId: run.runId, reason: "Partial write" });
    assert.equal(repository.read().executionRuns.some(ownsExecutionLease), true);
    prepare(); assert.throws(() => approve("blocked-replacement"));
    send({ kind: "abandon-workspace-operation", runId: run.runId, operationId: writing.operationId, observedManifestHash: "c".repeat(64), reason: "Owned journal returned conflict; partial bytes preserved, no writer remains" });
    assert.equal(repository.read().executionRuns.some(ownsExecutionLease), false);
    send({ kind: "begin-workspace-operation", runId: run.runId, request: { kind: "restore", target: "source", checkpointId: "before", expectedManifestHash: "c".repeat(64), targetManifestHash: "b".repeat(64) } });
    const restoring = repository.read().executionRuns[0]?.workspace; assert.ok(restoring); assert.equal(restoring.kind, "writing");
    send({ kind: "finish-workspace-operation", runId: run.runId, operationId: restoring.operationId, manifestHash: "b".repeat(64), observedAt: 5000 });
    assert.equal(repository.read().executionRuns[0]?.reviewFreshness.kind, "stale");
    assert.throws(() => send({ kind: "accept-execution-result", runId: run.runId, resultId: result.resultId, resultRevision: result.recordedAtRevision }));
  });

  test("unknown authority fields and corrupt command shapes do not append history", () => {
    const before = repository.read();
    assert.throws(() => repository.dispatch({ commandId: "forged", projectId: before.projectId, expectedProjectRevision: before.revision,
      action: { kind: "prepare-execution-plan", plan: { ...draft(), approved: true } } }));
    assert.deepEqual(repository.read(), before);
  });
});
