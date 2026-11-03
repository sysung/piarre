import { forecastFixture, consentFixture } from "./forecast-fixture.js";
import assert from "node:assert/strict";
import { replay, executionDependenciesReady, type ExecutionAction, type ExecutionPlanDraft, type ProjectEvent, type ProjectSnapshot } from "../../../../packages/core/src/index.js";
import { applyExecutionEvent } from "../../../../packages/core/src/execution.js";
import { renderExecutionControls, renderExecutionDesk, renderExecutionResult, taskExecutionStatus } from "../../src/execution-view.js";

suite("Execution review rendering", () => {
  const hash = "a".repeat(64);
  const events: ProjectEvent[] = [
    { kind: "project-created", projectId: "project", repositoryUri: "file:///tmp/source", name: "Test" },
    { kind: "proposal-created", group: { groupId: "group", goal: "Goal", source: "deterministic-draft", taskIds: ["task"] }, tasks: [{ taskId: "task", groupId: "group", planVersion: 1, state: { kind: "unapproved" }, title: "Fix <script> & policy", requirements: [{ key: "criterion", text: "Require 45 days" }], proposedScope: { included: [], excluded: [] }, checks: [], proposedBudget: { maxAttempts: 1, maxElapsedMinutes: 2, maxTokens: 4000 }, dependsOn: [] }] },
  ];
  const draft: ExecutionPlanDraft = { taskId: "task", objective: "45-day <policy>", criteria: [{ criterionId: "criterion", text: "45 days <required>" }], knowledge: [], files: [{ kind: "existing", fileId: "file-1", relativePath: "a&b.ts", sha256: hash, bytes: 8 }], checks: [{ checkId: "check", argv: ["node", "test.js"], criterionIds: ["criterion"] }], candidateRoot: "/tmp/candidate", sourceRoot: "/tmp/source", controlDirectory: "/tmp/control", captureHash: hash, baselineCheckpoint: { checkpointId: "before-run", manifestHash: hash }, provider: { kind: "codex-readonly-patch", authType: "unknown", requestedModel: "fixture-model" }, forecast: forecastFixture(), accountContext: { observedAt: "2026-11-02T00:00:00.000Z", model: { kind: "resolved-default", model: "fixture-model" }, usage: { kind: "unknown" } }, durationMs: 120000, maxTokens: 4000 };
  let history: ProjectEvent[];
  let project: ProjectSnapshot;
  const send = (action: ExecutionAction): void => {
    history.push({ kind: "execution-recorded", commandId: `event-${String(history.length)}`, action });
    project = replay(history);
  };
  const approve = (): void => {
    send({ kind: "prepare-execution-plan", plan: draft });
    const plan = project.executionPlans[0]; assert.ok(plan);
    send({ kind: "approve-execution", planId: plan.planId, planRevision: plan.recordedAtRevision, runId: "run", spendingConsent: consentFixture(plan, "run"), approvedAt: 1000, expiresAt: 5000, ownerPid: 1, ownerId: "owner" });
  };
  const complete = (outcome: "needs-review" | "failed" = "needs-review", manifestHash = hash): void => {
    approve();
    send({ kind: "request-execution", runId: "run", requestedAt: 1100 });
    send({ kind: "observe-execution-provider", runId: "run", model: "fixture-model", modelProvider: "openai", observedAt: 1101 });
    send({ kind: "bind-execution-thread", runId: "run", threadId: "thread" });
    send({ kind: "bind-execution-turn", runId: "run", threadId: "thread", turnId: "turn" });
    send({ kind: "observe-execution-terminal", runId: "run", threadId: "thread", turnId: "turn", status: "completed", observedAt: 1102 });
    send({ kind: "begin-candidate-apply", runId: "run", observedAt: 1200 });
    send({ kind: "begin-execution-check", runId: "run", checkId: "check", nonce: "nonce", requestedAt: 1300, controlDirectory: "/tmp/check" });
    send({ kind: "bind-check-process", runId: "run", checkId: "check", nonce: "nonce", pid: 2, watchdogPid: 3, startedAt: 1400, controlDirectory: "/tmp/check" });
    send({ kind: "record-execution-check", runId: "run", evidence: { checkId: "check", nonce: "nonce", kind: "passed", termination: "observed", criterionIds: ["criterion"], argv: ["node", "test.js"], exitCode: 0, signal: null, stdout: '<img src=x onerror="bad()">', stderr: "&", manifestHash: hash, observedAt: 1500 } });
    send({ kind: "finish-execution", runId: "run", summary: "Generated <candidate>", outcome, manifestHash });
  };
  setup(() => { history = [...events]; project = replay(history); });
  test("proposal, approval, generation, and unknown cancellation remain distinct", () => {
    assert.equal(taskExecutionStatus(project, "task"), "Proposed · execution not approved");
    approve(); assert.match(taskExecutionStatus(project, "task"), /generation not requested/);
    send({ kind: "request-execution", runId: "run", requestedAt: 1100 });
    assert.match(taskExecutionStatus(project, "task"), /Generating candidate/);
    send({ kind: "observe-execution-provider", runId: "run", model: "fixture-model", modelProvider: "openai", observedAt: 1101 });
    send({ kind: "bind-execution-thread", runId: "run", threadId: "thread" });
    send({ kind: "mark-execution-unknown", runId: "run", reason: "Lost acknowledgment" });
    assert.match(taskExecutionStatus(project, "task"), /stop is not confirmed/);
    const html = renderExecutionControls(project);
    assert.match(html, /Execution lease retained/); assert.match(html, /data-execution-action="reconcile"/); assert.match(html, /data-execution-action="abandon-provider"/);
    assert.doesNotMatch(renderExecutionResult(project, "run"), /restore-candidate/);
  });
  test("exact evidence is escaped and review is separate from acceptance", () => {
    complete();
    const html = renderExecutionResult(project, "run");
    assert.match(html, /Passed scoped checks/); assert.match(html, /Acceptance: unreviewed/);
    assert.match(html, /data-execution-action="apply-accept"/); assert.match(html, /Apply and accept/);
    assert.match(html, /&lt;img src=x onerror=&quot;bad\(\)&quot;&gt;/); assert.doesNotMatch(html, /<img|<script>/);
    assert.match(html, /a&amp;b.ts/); assert.match(html, /soft and not enforced/); assert.match(html, /Cost scenario unknown/);
    assert.match(html, /result:event-/); assert.match(html, /SHA-256/);
  });
  test("check evidence for other bytes cannot mark a criterion passed", () => {
    complete("failed", "b".repeat(64));
    const html = renderExecutionResult(project, "run");
    assert.match(html, /Not tested/); assert.doesNotMatch(html, /Passed scoped checks/);
    assert.doesNotMatch(html, /data-execution-action="apply-accept"/);
  });
  test("new plans make earlier passing evidence historical", () => {
    complete(); send({ kind: "prepare-execution-plan", plan: draft });
    const html = renderExecutionResult(project, "run");
    assert.match(html, /Historical result/); assert.match(html, /Historical evidence: Passed scoped checks/);
    assert.doesNotMatch(html, /data-execution-action="apply-accept"/);
  });
  test("workspace operations keep controls visible after terminal checks", () => {
    complete(); const run = project.executionRuns[0]; assert.ok(run); assert.equal(run.state.kind, "terminal");
    send({ kind: "begin-workspace-operation", runId: "run", request: { kind: "integrate", resultId: run.state.result.resultId, resultRevision: run.state.result.recordedAtRevision, expectedManifestHash: hash, targetManifestHash: hash } });
    assert.match(renderExecutionControls(project), /Workspace operation in progress/);
    assert.doesNotMatch(renderExecutionResult(project, "run"), /data-execution-action="apply-accept"/);
    send({ kind: "mark-workspace-unknown", runId: "run", reason: "Interrupted write" });
    assert.match(renderExecutionControls(project), /Workspace state unknown/);
    const workspace = project.executionRuns[0]?.workspace; assert.equal(workspace?.kind, "unknown");
    send({ kind: "finish-workspace-operation", runId: "run", operationId: workspace.operationId, manifestHash: hash, observedAt: 1700 });
    assert.match(renderExecutionResult(project, "run"), /Accept current result/);
    assert.match(renderExecutionResult(project, "run"), /restore-source/);
    send({ kind: "invalidate-execution-workspace", runId: "run", reason: "Source changed" });
    assert.match(renderExecutionResult(project, "run"), /Historical result/);
    assert.doesNotMatch(renderExecutionResult(project, "run"), /data-execution-action="apply-accept"/);
  });
  test("transitive prerequisite staleness blocks results and new work without releasing active leases", () => {
    complete();
    const completed = project.executionRuns[0]; assert.ok(completed); assert.equal(completed.state.kind, "terminal");
    send({ kind: "begin-workspace-operation", runId: "run", request: { kind: "integrate", resultId: completed.state.result.resultId, resultRevision: completed.state.result.recordedAtRevision, expectedManifestHash: hash, targetManifestHash: hash } });
    const writing = project.executionRuns[0]?.workspace; assert.equal(writing?.kind, "writing");
    send({ kind: "finish-workspace-operation", runId: "run", operationId: writing.operationId, manifestHash: hash, observedAt: 1700 });
    send({ kind: "accept-execution-result", runId: "run", resultId: completed.state.result.resultId, resultRevision: completed.state.result.recordedAtRevision });
    const rootTask = project.tasks[0]; const rootPlan = project.executionPlans[0]; const rootRun = project.executionRuns[0];
    assert.ok(rootTask && rootPlan && rootRun);
    const middlePlan = { ...rootPlan, taskId: "middle", planId: "middle-plan" };
    const leafPlan = { ...rootPlan, taskId: "leaf", planId: "leaf-plan" };
    const chain: ProjectSnapshot = { ...project,
      tasks: [rootTask, { ...rootTask, taskId: "middle", dependsOn: [rootTask.taskId] }, { ...rootTask, taskId: "leaf", dependsOn: ["middle"] }],
      executionPlans: [rootPlan, middlePlan, leafPlan],
      executionRuns: [rootRun, { ...rootRun, runId: "middle-run", grant: { ...rootRun.grant, plan: middlePlan } }, { ...rootRun, runId: "leaf-run", grant: { ...rootRun.grant, plan: leafPlan } }],
    };
    assert.equal(executionDependenciesReady(chain, "leaf"), true);
    const stale: ProjectSnapshot = { ...chain, executionRuns: chain.executionRuns.map(run => run.runId === "run" ? { ...run, reviewFreshness: { kind: "stale", reason: "Manual source edit" } } : run) };
    assert.equal(executionDependenciesReady(stale, "leaf"), false);
    assert.match(renderExecutionResult(stale, "leaf-run"), /Historical result/);
    assert.doesNotMatch(renderExecutionResult(stale, "leaf-run"), /data-execution-action="apply-accept"/);
    const active: ProjectSnapshot = { ...stale, executionRuns: stale.executionRuns.map(run => run.runId === "leaf-run" ? { ...run, acceptance: { kind: "unreviewed" }, workspace: { kind: "not-integrated" }, state: { kind: "generating" } } : run) };
    assert.throws(() => applyExecutionEvent(active, { kind: "execution-recorded", commandId: "stale-apply", action: { kind: "begin-candidate-apply", runId: "leaf-run", observedAt: 2000 } }));
    assert.match(renderExecutionControls(active), /Execution lease retained/);
    const missing = { ...chain, tasks: chain.tasks.filter(task => task.taskId !== rootTask.taskId) };
    assert.equal(executionDependenciesReady(missing, "leaf"), false);
    const cycle = { ...chain, tasks: chain.tasks.map(task => task.taskId === rootTask.taskId ? { ...task, dependsOn: ["leaf"] } : task) };
    assert.equal(executionDependenciesReady(cycle, "leaf"), false);
  });
  test("missing evidence is untested and missing run guides to recorded runs", () => {
    approve(); const html = renderExecutionResult(project, "run");
    assert.match(html, /Not tested/); assert.doesNotMatch(html, /Passed scoped checks/);
    assert.match(renderExecutionResult(project, "missing"), /Open a recorded run/);
    assert.match(renderExecutionDesk(project), /data-execution-action="prepare" data-execution-id="task"/);
  });
});
