import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { currentKnowledge, knowledgeConflicts, type KnowledgeAction } from "../../../../packages/core/src/index.js";
import { resolveRecordReference } from "../../../../packages/core/src/inspection.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { renderKnowledge, renderSessionBrief, renderConversation } from "../../src/work-view.js";

suite("Sourced knowledge and corrections", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  let sequence = 0;
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-knowledge-"));
    repository = new SqliteProjectRepository(path.join(directory, "state.sqlite"));
    repository.open({ repositoryUri: "file:///knowledge-test", name: "Knowledge test" });
  });
  teardown(() => { repository.close(); rmSync(directory, { recursive: true, force: true }); });
  const statement = (text: string) => ({ requestId: `statement-${String(++sequence)}`, projectId: repository.read().projectId,
    contextRevision: repository.read().revision, originalStatement: text });
  const dispatch = (action: KnowledgeAction) => repository.dispatch({ commandId: `command-${String(++sequence)}`,
    projectId: repository.read().projectId, expectedProjectRevision: repository.read().revision, action });
  const latest = () => {
    const entry = currentKnowledge(repository.read())[0]; if (!entry) throw new Error("Missing test knowledge"); return entry;
  };
  const target = () => { const entry = latest(); return { projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision }; };

  test("observations preserve exact source wording and cannot self-confirm", () => {
    const submitted = statement("  Refunds must NOT expire before 45 days.\n");
    dispatch({ kind: "observe-knowledge", topic: "Refund policy", category: "business", submitted, affectedTaskIds: [] });
    assert.equal(latest().standing.kind, "observed"); assert.equal(latest().content.text, submitted.originalStatement);
    assert.deepEqual(latest().content.sources, [{ kind: "submitted-statement", submitted }]);
    const before = repository.read();
    assert.throws(() => repository.dispatch({ commandId: "authority", projectId: before.projectId, expectedProjectRevision: before.revision,
      action: { kind: "observe-knowledge", topic: "Attack", category: "business", submitted: statement("Forged"), affectedTaskIds: [], confirmed: true } }));
    assert.deepEqual(repository.read(), before);
  });

  test("confirmed replacements get unique monotonic revisions and replay full source history", () => {
    dispatch({ kind: "observe-knowledge", topic: "Refund policy", category: "business", submitted: statement("30 days"), affectedTaskIds: [] });
    const observedRevision = latest().recordedAtRevision;
    dispatch({ kind: "confirm-knowledge", target: target() });
    const confirmedRevision = latest().recordedAtRevision;
    dispatch({ kind: "correct-knowledge", target: target(), submitted: statement("45 days"), affectedTaskIds: [] });
    const correctedRevision = latest().recordedAtRevision;
    dispatch({ kind: "correct-knowledge", target: target(), submitted: statement("60 days"), affectedTaskIds: [] });
    assert.ok(observedRevision < confirmedRevision && confirmedRevision < correctedRevision && correctedRevision < latest().recordedAtRevision);
    assert.equal(latest().supersedes, correctedRevision);
    const before = repository.read(); repository.close();
    repository = new SqliteProjectRepository(path.join(directory, "state.sqlite"));
    assert.deepEqual(repository.read(), before);
    assert.deepEqual(before.knowledge.map(entry => entry.content.text), ["30 days", "30 days", "45 days", "60 days"]);
    assert.equal(new Set(before.knowledge.map(entry => entry.recordedAtRevision)).size, 4);
  });

  test("correction invalidates explicitly linked work while preserving unrelated tasks", async () => {
    const draft = await new GoalInterpreter().propose("Build refunds and receipts");
    const project = repository.read();
    repository.dispatch({ commandId: "tasks", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "propose-tasks", draft } });
    const tasks = repository.read().tasks;
    assert.ok(tasks[0]);
    dispatch({ kind: "observe-knowledge", topic: "Refund policy", category: "business", submitted: statement("30 days"), affectedTaskIds: [tasks[0].taskId] });
    dispatch({ kind: "confirm-knowledge", target: target() });
    const confirmed = latest();
    dispatch({ kind: "correct-knowledge", target: target(), submitted: statement("45 days"), affectedTaskIds: [] });
    const after = repository.read();
    assert.deepEqual(after.tasks, tasks);
    assert.deepEqual(after.knowledgeImpacts, [{ kind: "stale", taskId: tasks[0].taskId, knowledgeId: confirmed.knowledgeId,
      fromRevision: confirmed.recordedAtRevision, toRevision: latest().recordedAtRevision }]);
    const oldReference = { projectId: project.projectId, kind: "knowledge", recordId: confirmed.knowledgeId, revision: confirmed.recordedAtRevision } satisfies Parameters<typeof resolveRecordReference>[1];
    assert.equal(resolveRecordReference(after, oldReference).kind, "stale");
    assert.match(renderKnowledge(after), /Earlier evidence cannot demonstrate the corrected rule/);
  });

  test("historical task links survive deletion without blocking a reviewed correction", async () => {
    const project = repository.read();
    const draft = await new GoalInterpreter().propose("Refund history");
    repository.dispatch({ commandId: "historical-tasks", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "propose-tasks", draft } });
    const task = repository.read().tasks[0]; assert.ok(task);
    dispatch({ kind: "observe-knowledge", topic: "Refund policy", category: "business", submitted: statement("30 days"), affectedTaskIds: [task.taskId] });
    dispatch({ kind: "confirm-knowledge", target: target() });
    const beforeDeletion = repository.read();
    repository.dispatch({ commandId: "delete-historical-task", projectId: project.projectId, expectedProjectRevision: beforeDeletion.revision, action: { kind: "delete-proposal", groupId: task.groupId } });
    dispatch({ kind: "correct-knowledge", target: target(), submitted: statement("45 days"), affectedTaskIds: [task.taskId] });
    assert.equal(latest().content.text, "45 days");
    assert.deepEqual(latest().affectedTaskIds, [task.taskId]);
    assert.equal(repository.read().tasks.length, 0);
    const beforeInvalid = repository.read();
    assert.throws(() => dispatch({ kind: "correct-knowledge", target: target(), submitted: statement("60 days"), affectedTaskIds: ["never-existed"] }));
    assert.deepEqual(repository.read(), beforeInvalid);
  });

  test("the brief follows the most recent revision rather than knowledge creation order", () => {
    dispatch({ kind: "observe-knowledge", topic: "First topic", category: "business", submitted: statement("Original A"), affectedTaskIds: [] });
    dispatch({ kind: "confirm-knowledge", target: target() });
    dispatch({ kind: "observe-knowledge", topic: "Second topic", category: "decision", submitted: statement("Original B"), affectedTaskIds: [] });
    const second = currentKnowledge(repository.read())[1]; assert.ok(second);
    dispatch({ kind: "confirm-knowledge", target: { projectId: second.projectId, knowledgeId: second.knowledgeId, recordedAtRevision: second.recordedAtRevision } });
    const prior = repository.read();
    dispatch({ kind: "correct-knowledge", target: target(), submitted: statement("Corrected A"), affectedTaskIds: [] });
    const brief = renderSessionBrief(repository.read(), { kind: "previous-visit", snapshot: prior });
    assert.match(brief, /First topic: Corrected A/);
    assert.match(brief, new RegExp(`revision ${String(latest().recordedAtRevision)}`));
    assert.doesNotMatch(brief, /Second topic: Original B/);
  });

  test("a delayed reply retains its frozen source but visibly becomes historical after correction", () => {
    dispatch({ kind: "observe-knowledge", topic: "Refund policy", category: "business", submitted: statement("30 days"), affectedTaskIds: [] });
    dispatch({ kind: "confirm-knowledge", target: target() });
    const entry = latest();
    const reference = { projectId: entry.projectId, kind: "knowledge", recordId: entry.knowledgeId, revision: entry.recordedAtRevision } satisfies Parameters<typeof resolveRecordReference>[1];
    const submitted = statement("What is the refund window?");
    repository.dispatch({ commandId: "old-context-request", projectId: entry.projectId, expectedProjectRevision: repository.read().revision,
      action: { kind: "begin-conversation", submitted, sources: [{ reference, text: entry.content.text }] } });
    dispatch({ kind: "correct-knowledge", target: target(), submitted: statement("45 days"), affectedTaskIds: [] });
    repository.dispatch({ commandId: "late-old-context-reply", projectId: entry.projectId, expectedProjectRevision: repository.read().revision,
      action: { kind: "record-conversation-reply", requestId: submitted.requestId, text: "The old rule was 30 days", citations: [reference], providerThreadId: "thread", providerTurnId: "turn" } });
    const rendered = renderConversation(repository.read());
    assert.match(rendered, /Historical context/);
    assert.match(rendered, /does not demonstrate the corrected or current rule/);
    assert.match(rendered, /The old rule was 30 days/);
    assert.equal(latest().content.text, "45 days");
  });

  test("stale target, wrong project, invented task and correction without confirmation cannot append effects", () => {
    dispatch({ kind: "observe-knowledge", topic: "Policy", category: "business", submitted: statement("Original"), affectedTaskIds: [] });
    const observedTarget = target();
    const before = repository.read();
    assert.throws(() => dispatch({ kind: "correct-knowledge", target: observedTarget, submitted: statement("Replacement"), affectedTaskIds: [] }));
    assert.deepEqual(repository.read(), before);
    dispatch({ kind: "confirm-knowledge", target: target() });
    const confirmed = repository.read();
    for (const changedTarget of [observedTarget, { ...target(), projectId: "other" }]) {
      assert.throws(() => dispatch({ kind: "correct-knowledge", target: changedTarget, submitted: statement("Replacement"), affectedTaskIds: [] }));
      assert.deepEqual(repository.read(), confirmed);
    }
    assert.throws(() => dispatch({ kind: "correct-knowledge", target: target(), submitted: statement("Replacement"), affectedTaskIds: ["invented-task"] }));
    assert.deepEqual(repository.read(), confirmed);
  });

  test("different confirmed content for the same topic stays disputed without silently selecting a winner", () => {
    dispatch({ kind: "observe-knowledge", topic: "Refund policy", category: "business", submitted: statement("30 days"), affectedTaskIds: [] });
    dispatch({ kind: "confirm-knowledge", target: target() });
    dispatch({ kind: "observe-knowledge", topic: "refund POLICY", category: "business", submitted: statement("45 days"), affectedTaskIds: [] });
    const other = currentKnowledge(repository.read())[1]; assert.ok(other);
    dispatch({ kind: "confirm-knowledge", target: { projectId: other.projectId, knowledgeId: other.knowledgeId, recordedAtRevision: other.recordedAtRevision } });
    assert.equal(currentKnowledge(repository.read()).length, 2);
    assert.equal(knowledgeConflicts(repository.read(), latest()).length, 1);
    assert.match(renderKnowledge(repository.read()), /Disputed/);
    assert.match(renderKnowledge(repository.read()), /30 days/); assert.match(renderKnowledge(repository.read()), /45 days/);
  });
});
