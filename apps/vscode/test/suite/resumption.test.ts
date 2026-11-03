import { forecastFixture, consentFixture } from "./forecast-fixture.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { currentKnowledge, currentExecutionPlan, ownsExecutionLease, type ExecutionPlanDraft, type ProjectCommand } from "../../../../packages/core/src/index.js";
import { resumeProject, knowledgeWorkImpact } from "../../../../packages/core/src/resumption.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";

suite("Source-backed project resumption", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  let sequence = 0;
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-resumption-"));
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    repository.open({ repositoryUri: "file:///resumption-fixture", name: "Resumption" });
  });
  teardown(() => { repository.close(); rmSync(directory, { recursive: true, force: true }); });
  const send = (action: ProjectCommand["action"]) => repository.dispatch({ commandId: `resumption-${String(++sequence)}`, projectId: repository.read().projectId, expectedProjectRevision: repository.read().revision, action });
  const statement = (originalStatement: string) => ({ requestId: `statement-${String(++sequence)}`, projectId: repository.read().projectId, contextRevision: repository.read().revision, originalStatement });
  const target = () => { const entry = currentKnowledge(repository.read())[0]; assert.ok(entry); return { projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision }; };

  test("visits persist a canonical revision without writing work events or producing self deltas", () => {
    const initial = repository.read();
    const first = repository.beginVisit();
    assert.equal(first.kind, "first-visit");
    assert.deepEqual(repository.read(), initial);
    assert.equal(resumeProject(initial, first).facts.length, 0);
    repository.recordVisitedRevision(initial.projectId, initial.revision);
    repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    const baseline = repository.beginVisit();
    assert.equal(baseline.kind, "previous-visit");
    assert.deepEqual(repository.read(), initial);
    assert.equal(resumeProject(repository.read(), baseline).facts.filter(fact => fact.category === "change").length, 0);
    assert.throws(() => { repository.recordVisitedRevision("other", initial.revision); });
    assert.throws(() => { repository.recordVisitedRevision(initial.projectId, initial.revision + 1); });
  });

  test("restart reports changes after the last displayed revision, then advances only navigation metadata", () => {
    repository.beginVisit();
    const prior = repository.read();
    repository.recordVisitedRevision(prior.projectId, prior.revision);
    send({ kind: "rename-project", name: "Changed while away" });
    const after = repository.read();
    repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    const visit = repository.beginVisit();
    assert.equal(visit.kind, "previous-visit");
    assert.equal(visit.snapshot.revision, prior.revision);
    assert.ok(resumeProject(repository.read(), visit).facts.some(fact => fact.text.includes("Changed while away")));
    assert.deepEqual(repository.read(), after);
    assert.equal(resumeProject(repository.read(), repository.beginVisit()).facts.filter(fact => fact.category === "change").length, 0);
  });

  test("current first-visit absence differs from unavailable navigation history", () => {
    const project = repository.read();
    assert.match(resumeProject(project, { kind: "first-visit" }).gaps.join(" "), /No prior visit recorded/);
    const database = new DatabaseSync(path.join(directory, "project.sqlite"));
    database.prepare("INSERT INTO project_visit VALUES (1, 999)").run(); database.close();
    const unavailable = repository.beginVisit();
    assert.equal(unavailable.kind, "unavailable");
    assert.match(resumeProject(project, unavailable).gaps.join(" "), /Changes cannot be determined/);
    assert.throws(() => resumeProject(project, { kind: "previous-visit", snapshot: { ...project, projectId: "other" } }));
  });

  test("changes use the prior observed boundary, retain intermediate corrections and exact sources", async () => {
    const prior = repository.read(); repository.beginVisit();
    send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose("Refund receipts") });
    send({ kind: "observe-knowledge", topic: "Refund policy", category: "business", submitted: statement("30 days"), affectedTaskIds: [] });
    send({ kind: "confirm-knowledge", target: target() });
    send({ kind: "correct-knowledge", target: target(), submitted: statement("45 days"), affectedTaskIds: [] });
    send({ kind: "correct-knowledge", target: target(), submitted: statement("60 days"), affectedTaskIds: [] });
    const current = repository.read();
    const brief = resumeProject(current, { kind: "previous-visit", snapshot: prior });
    for (const text of ["30 days", "45 days", "60 days"]) assert.ok(brief.facts.some(fact => fact.category === "change" && fact.text.includes(text)));
    for (const fact of brief.facts.filter(fact => fact.source.kind === "knowledge")) assert.ok(current.knowledge.some(entry => entry.knowledgeId === fact.source.recordId && entry.recordedAtRevision === fact.source.revision && fact.text.includes(entry.topic)));
    assert.equal(brief.facts.filter(fact => fact.category === "accomplishment").length, 0);
    repository.recordVisitedRevision(current.projectId, current.revision);
    repository.recordVisitedRevision(current.projectId, prior.revision);
    repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    assert.equal(resumeProject(repository.read(), repository.beginVisit()).facts.filter(fact => fact.category === "change").length, 0);
  });

  test("removal and rename deltas preserve historical identities without inventing current records", async () => {
    send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose("Old goal") });
    const prior = repository.read(); const proposal = prior.proposals[0]; assert.ok(proposal);
    send({ kind: "delete-proposal", groupId: proposal.groupId }); send({ kind: "rename-project", name: "Renamed" });
    const brief = resumeProject(repository.read(), { kind: "previous-visit", snapshot: prior });
    assert.ok(brief.facts.some(fact => fact.text.startsWith("Removed saved goal") && fact.source.recordId === proposal.groupId && fact.source.revision === proposal.recordedAtRevision));
    assert.ok(brief.facts.some(fact => fact.text.includes("Resumption to Renamed")));
  });

  test("correction exposes exact plan approval/result relationships and preserves unknown writer facts", async () => {
    send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose("Refund receipts") });
    const task = repository.read().tasks[0]; assert.ok(task);
    send({ kind: "observe-knowledge", topic: "Refund policy", category: "business", submitted: statement("30 days"), affectedTaskIds: [task.taskId] });
    send({ kind: "confirm-knowledge", target: target() });
    const hash = "a".repeat(64);
    const plan: ExecutionPlanDraft = { taskId: task.taskId, objective: "Refund window", criteria: [{ criterionId: "days", text: "30 days" }], knowledge: [target()], files: [{ kind: "absent", fileId: "refund", relativePath: "refund.ts" }], checks: [], candidateRoot: "/tmp/candidate", controlDirectory: "/tmp/control", captureHash: hash, baselineCheckpoint: { checkpointId: "before", manifestHash: hash }, sourceRoot: "/tmp/source", provider: { kind: "codex-readonly-patch", authType: "unknown", requestedModel: "fixture-model" }, accountContext: { observedAt: "2026-11-02T00:00:00.000Z", model: { kind: "unknown" }, usage: { kind: "unknown" } }, forecast: forecastFixture(), durationMs: 1000, maxTokens: 100 };
    send({ kind: "prepare-execution-plan", plan });
    const recorded = currentExecutionPlan(repository.read(), task.taskId); assert.ok(recorded);
    send({ kind: "approve-execution", spendingConsent: consentFixture(recorded, "fixture-run"), planId: recorded.planId, planRevision: recorded.recordedAtRevision, runId: "fixture-run", approvedAt: 1000, expiresAt: 1500, ownerPid: 12345, ownerId: "fixture-owner" });
    send({ kind: "request-execution", runId: "fixture-run", requestedAt: 1100 });
    send({ kind: "mark-execution-unknown", runId: "fixture-run", reason: "Fixture lost acknowledgement" });
    const prior = repository.read();
    send({ kind: "correct-knowledge", target: target(), submitted: statement("45 days"), affectedTaskIds: [task.taskId] });
    const current = repository.read(); const impact = knowledgeWorkImpact(current, target().knowledgeId)[0]; assert.ok(impact);
    assert.equal(impact.freshness, "stale");
    assert.deepEqual(impact.plan, recorded);
    assert.equal(impact.runs[0]?.grant.approvalId, prior.executionRuns[0]?.grant.approvalId);
    assert.deepEqual(current.executionRuns[0]?.process, prior.executionRuns[0]?.process);
    assert.equal(current.executionRuns[0]?.state.kind, "unknown");
    assert.ok(current.executionRuns.some(ownsExecutionLease));
    const brief = resumeProject(current, { kind: "previous-visit", snapshot: prior });
    assert.ok(brief.facts.some(fact => fact.text.includes("Writer ownership/reconciliation is separate")));
    assert.ok(brief.facts.some(fact => fact.category === "next" && fact.text.includes("stale")));
    assert.match(brief.gaps.join(" "), /Missing links cannot establish/);
    assert.throws(() => send({ kind: "request-execution", runId: "fixture-run", requestedAt: 1200 }));
  });
});
