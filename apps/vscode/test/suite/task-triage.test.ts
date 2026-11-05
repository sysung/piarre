import { forecastFixture, consentFixture } from "./forecast-fixture.js";
import { renderTaskTriage, renderExecutionDesk } from "../../src/execution-view.js";
import { parseExecutionMessage } from "../../src/execution-actions.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { currentTaskTriage, taskTriageRevision, orderedTriageTasks, executionDependenciesReady, validateProjectCommand, planFreshness, ownsExecutionLease, type ExecutionPlanDraft, type ProjectCommand, type TaskTriageValue } from "../../../../packages/core/src/index.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";

suite("Canonical reversible task triage", () => {
  let directory: string, repository: SqliteProjectRepository, taskId: string;
  let sequence = 0;
  const send = (action: ProjectCommand["action"], commandId = `triage-${String(++sequence)}`) => repository.dispatch({ commandId, projectId: repository.read().projectId, expectedProjectRevision: repository.read().revision, action });
  const deferred: TaskTriageValue = { priority: "high", disposition: { kind: "deferred", reason: "Wait for policy review" } };
  const propose = (desired: TaskTriageValue = deferred) => {
    send({ kind: "propose-task-triage", taskId, basedOnTriageRevision: taskTriageRevision(repository.read(), taskId), desired, rationale: "User chose the next order", origin: { kind: "user" } });
    const proposal = repository.read().taskTriage.proposals.at(-1); assert.ok(proposal); return proposal;
  };
  const adopt = (proposal = propose()) => send({ kind: "adopt-task-triage", proposalId: proposal.proposalId, proposalRevision: proposal.recordedAtRevision, triageRevision: taskTriageRevision(repository.read(), taskId) });
  const draft = (): ExecutionPlanDraft => ({ taskId, objective: "Bounded policy", criteria: [{ criterionId: "policy", text: "Policy check" }], knowledge: [], files: [{ kind: "absent", fileId: "policy-file", relativePath: "policy.ts" }], checks: [{ checkId: "policy-check", argv: ["/usr/bin/node", "test.js"], criterionIds: ["policy"] }], candidateRoot: "/tmp/triage-candidate", controlDirectory: "/tmp/triage-control", sourceRoot: "/tmp/triage-source", captureHash: "a".repeat(64), baselineCheckpoint: { checkpointId: "before", manifestHash: "a".repeat(64) }, provider: { kind: "codex-readonly-patch", authType: "unknown", requestedModel: "fixture-model" }, forecast: forecastFixture(), accountContext: { observedAt: "2026-11-02T00:00:00.000Z", model: { kind: "resolved-default", model: "fixture-model" }, usage: { kind: "unknown" } }, durationMs: 120000, maxTokens: 4000 });
  const prepare = () => { send({ kind: "prepare-execution-plan", plan: draft() }); const plan = repository.read().executionPlans.at(-1); assert.ok(plan); return plan; };
  const approve = () => { const plan = prepare(); send({ kind: "approve-execution", planId: plan.planId, planRevision: plan.recordedAtRevision, runId: "run", approvedAt: 1000, expiresAt: 5000, ownerPid: 12345, ownerId: "owner", spendingConsent: consentFixture(plan, "run") }); };
  setup(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-triage-")); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    repository.open({ repositoryUri: "file:///triage-test", name: "Triage" }); send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose("Implement policy") });
    const task = repository.read().tasks[0]; assert.ok(task); taskId = task.taskId;
  });
  teardown(() => { repository.close(); rmSync(directory, { recursive: true, force: true }); });
  test("legacy tasks default to normal and available without modifying proposal payloads", () => {
    assert.deepEqual(currentTaskTriage(repository.read(), taskId), { priority: "normal", disposition: { kind: "available" } });
    assert.equal(taskTriageRevision(repository.read(), taskId), null); assert.equal(executionDependenciesReady(repository.read(), taskId), true);
    const task = repository.read().tasks[0]; assert.ok(task); assert.equal("priority" in task, false);
  });
  test("proposal is inert, exact adoption survives restart, duplicate receipt and reversal preserve history", () => {
    const tasks = repository.read().tasks; const proposal = propose();
    assert.equal(currentTaskTriage(repository.read(), taskId).disposition.kind, "available");
    const before = repository.read(); const command: ProjectCommand = { commandId: "adoption", projectId: before.projectId, expectedProjectRevision: before.revision, action: { kind: "adopt-task-triage", proposalId: proposal.proposalId, proposalRevision: proposal.recordedAtRevision, triageRevision: null } };
    assert.equal(repository.dispatch(command).kind, "applied"); assert.equal(repository.dispatch(command).kind, "duplicate");
    repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    assert.deepEqual(currentTaskTriage(repository.read(), taskId), deferred); assert.equal(executionDependenciesReady(repository.read(), taskId), false);
    const decision = repository.read().taskTriage.decisions.at(-1); assert.ok(decision);
    send({ kind: "reverse-task-triage", taskId, decisionId: decision.decisionId, triageRevision: decision.recordedAtRevision });
    assert.equal(currentTaskTriage(repository.read(), taskId).disposition.kind, "available"); assert.deepEqual(repository.read().tasks, tasks);
    assert.equal(repository.read().taskTriage.decisions.length, 2); assert.equal(repository.read().executionRuns.length, 0);
    assert.throws(() => send({ kind: "reverse-task-triage", taskId, decisionId: decision.decisionId, triageRevision: decision.recordedAtRevision }));
  });
  test("stale proposal, revision mismatch, malformed origin and deleted task cannot change triage", () => {
    const old = propose(); adopt(propose({ priority: "low", disposition: { kind: "available" } }));
    assert.throws(() => adopt(old)); const fresh = propose();
    assert.throws(() => send({ kind: "adopt-task-triage", proposalId: fresh.proposalId, proposalRevision: fresh.recordedAtRevision + 1, triageRevision: taskTriageRevision(repository.read(), taskId) }));
    const project = repository.read(); assert.throws(() => validateProjectCommand({ commandId: "forged", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "propose-task-triage", taskId, basedOnTriageRevision: null, desired: deferred, rationale: "x", origin: { kind: "inferred" } } }));
    const task = project.tasks[0]; assert.ok(task); send({ kind: "delete-proposal", groupId: task.groupId }); assert.throws(() => adopt(fresh));
    assert.equal(repository.read().taskTriage.proposals.length, 3);
  });
  test("ordering is stable, available before deferred, priority never bypasses dependencies", () => {
    const tasks = repository.read().tasks; adopt();
    const ordered = orderedTriageTasks(repository.read()); assert.equal(ordered.at(-1)?.taskId, taskId);
    assert.equal(executionDependenciesReady(repository.read(), taskId), false);
    assert.equal(ordered.length, tasks.length);
  });
  test("deferral blocks preparation and old approval, and reversing requires a fresh plan", () => {
    const plan = prepare(); adopt(); const project = repository.read();
    assert.throws(() => prepare());
    assert.throws(() => send({ kind: "approve-execution", planId: plan.planId, planRevision: plan.recordedAtRevision, runId: "forbidden", approvedAt: 1000, expiresAt: 5000, ownerPid: 1, ownerId: "owner", spendingConsent: consentFixture(plan, "forbidden") }));
    const decision = project.taskTriage.decisions.at(-1); assert.ok(decision);
    send({ kind: "reverse-task-triage", taskId, decisionId: decision.decisionId, triageRevision: decision.recordedAtRevision });
    assert.equal(planFreshness(repository.read(), plan), "stale"); assert.equal(repository.read().executionRuns.length, 0);
    assert.equal(executionDependenciesReady(repository.read(), taskId), true); assert.equal(planFreshness(repository.read(), prepare()), "current");
  });
  test("active and unknown writers reject deferral and preserve owned lease, while priority is harmless", () => {
    approve(); const before = repository.read().executionRuns;
    const proposal = propose(); assert.throws(() => adopt(proposal), /Stop and reconcile/); assert.deepEqual(repository.read().executionRuns, before);
    adopt(propose({ priority: "high", disposition: { kind: "available" } }));
    const plan = repository.read().executionPlans[0]; assert.ok(plan); assert.equal(planFreshness(repository.read(), plan), "current");
    send({ kind: "mark-execution-unknown", runId: "run", reason: "Lost provider connection" });
    const unknown = repository.read().executionRuns; assert.throws(() => adopt(), /Stop and reconcile/);
    assert.deepEqual(repository.read().executionRuns, unknown); assert.ok(unknown[0]); assert.equal(ownsExecutionLease(unknown[0]), true);
  });
  test("reversing an availability adoption cannot defer an owned writer", () => {
    adopt(); adopt(propose({ priority: "normal", disposition: { kind: "available" } })); approve();
    const decision = repository.read().taskTriage.decisions.at(-1); assert.ok(decision);
    assert.throws(() => send({ kind: "reverse-task-triage", taskId, decisionId: decision.decisionId, triageRevision: decision.recordedAtRevision }), /Stop and reconcile/);
    assert.equal(currentTaskTriage(repository.read(), taskId).disposition.kind, "available");
  });
  test("task controls expose exact proposals, escape text and use existing execution messages", () => {
    const proposal = propose({ priority: "low", disposition: { kind: "deferred", reason: "<script>hold</script>" } });
    const rendered = renderTaskTriage(repository.read(), taskId);
    assert.ok(rendered.includes("&lt;script&gt;hold&lt;/script&gt;")); assert.ok(rendered.includes(`data-execution-id="${proposal.proposalId}"`));
    for (const action of ["triage", "adopt-triage", "reverse-triage"]) {
      assert.deepEqual(parseExecutionMessage({ kind: "execution", action, id: taskId }), { kind: "execution", action, id: taskId });
      assert.equal(parseExecutionMessage({ kind: "execution", action, id: taskId, unreviewed: true }), undefined);
    }
    adopt(proposal); const desk = renderExecutionDesk(repository.read());
    assert.ok(desk.includes('data-execution-action="reverse-triage"')); assert.ok(!renderTaskTriage(repository.read(), taskId).includes('data-execution-action="adopt-triage"'));
    assert.ok(!desk.includes(`data-execution-action="prepare" data-execution-id="${taskId}"`));
  });

  test("high priority cannot bypass a prerequisite and deferral leaves unrelated ordering stable", () => {
    const template = repository.read().tasks[0]; assert.ok(template);
    const base = { title: "Related work", requirements: template.requirements, proposedScope: template.proposedScope, checks: template.checks, proposedBudget: template.proposedBudget };
    send({ kind: "propose-tasks", draft: { goal: "Dependency fixture", source: "deterministic-draft", tasks: [
      { ...base, key: "dependency", dependsOn: [] }, { ...base, key: "dependent", dependsOn: ["dependency"] }, { ...base, key: "peer", dependsOn: [] },
    ] } });
    const group = repository.read().proposals.at(-1); assert.ok(group);
    const [dependency, dependent, peer] = repository.read().tasks.filter(task => task.groupId === group.groupId);
    assert.ok(dependency && dependent && peer);
    taskId = dependent.taskId; adopt(propose({ priority: "high", disposition: { kind: "available" } }));
    assert.equal(orderedTriageTasks(repository.read())[0]?.taskId, dependent.taskId);
    assert.equal(executionDependenciesReady(repository.read(), dependent.taskId), false);
    taskId = dependency.taskId; adopt();
    assert.equal(executionDependenciesReady(repository.read(), dependent.taskId), false);
    assert.equal(executionDependenciesReady(repository.read(), peer.taskId), true);
    assert.deepEqual(orderedTriageTasks(repository.read()).map(task => task.taskId), [dependent.taskId, template.taskId, peer.taskId, dependency.taskId]);
    assert.deepEqual(repository.read().executionRuns, []);
  });

});
