import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { currentExecutionPlan, planFreshness, parseKnowledgeCorrection, knowledgeConflicts, currentKnowledge, intentDocumentHash, intentDocumentPath, latestIntentDocument, parseIntentMarkdown, renderIntentMarkdown, type ExecutionPlanDraft, type IntentRecord, type KnowledgeAction, type ProjectCommand } from "../../../../packages/core/src/index.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { forecastFixture } from "./forecast-fixture.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";

const record: IntentRecord = { id: "refund-policy", topic: "Refund policy", category: "business", author: "Steven Sung", statement: "Refunds last 30 days.", rationale: "Customers need predictable terms.", scope: "Online purchases only.", sources: "Unknown", linkedTaskIds: [], openQuestions: "Tax treatment is unknown." };
const reviewed = (value: IntentRecord = record) => { const markdown = renderIntentMarkdown(value); return { path: intentDocumentPath(value.id), sha256: intentDocumentHash(markdown), markdown }; };

suite("Reviewed intent documents", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  let sequence = 0;
  setup(() => { directory = mkdtempSync(path.join(tmpdir(), "piarre-intent-")); repository = new SqliteProjectRepository(path.join(directory, "state.sqlite")); repository.open({ repositoryUri: "file:///intent-test", name: "Intent test" }); });
  teardown(() => { repository.close(); rmSync(directory, { recursive: true, force: true }); });
  const command = (action: ProjectCommand["action"]): ProjectCommand => ({ commandId: `intent-${String(++sequence)}`, projectId: repository.read().projectId, expectedProjectRevision: repository.read().revision, action });
  const dispatch = (action: KnowledgeAction) => repository.dispatch(command(action));
  const latest = () => { const entry = currentKnowledge(repository.read())[0]; assert.ok(entry); return entry; };
  const submitted = (originalStatement: string) => ({ requestId: `statement-${String(++sequence)}`, projectId: repository.read().projectId, contextRevision: repository.read().revision, originalStatement });
  const prepare = (taskId: string, knowledge: ExecutionPlanDraft["knowledge"]) => {
      const hash = "a".repeat(64);
      const plan: ExecutionPlanDraft = { taskId, objective: "Follow the reviewed policy", criteria: [{ criterionId: "policy", text: "Correct policy" }], knowledge,
        files: [{ kind: "absent", fileId: "file-1", relativePath: `${taskId}.ts` }], checks: [{ checkId: "policy-check", argv: ["/usr/bin/node", "test.js"], criterionIds: ["policy"] }],
        candidateRoot: "/tmp/intent-candidate", controlDirectory: "/tmp/intent-control", captureHash: hash, baselineCheckpoint: { checkpointId: "before-run", manifestHash: hash }, sourceRoot: "/tmp/project", provider: { kind: "codex-readonly-patch", authType: "unknown", requestedModel: "fixture-model" }, forecast: forecastFixture(), accountContext: { observedAt: "2026-11-02T00:00:00.000Z", model: { kind: "resolved-default", model: "fixture-model" }, usage: { kind: "unknown" } }, durationMs: 120_000, maxTokens: 4000 };
      repository.dispatch(command({ kind: "prepare-execution-plan", plan }));
      const prepared = currentExecutionPlan(repository.read(), taskId); assert.ok(prepared); return prepared;
    };

  test("ordinary Markdown roundtrips all required context and rejects forged structure", () => {
    const markdown = renderIntentMarkdown(record);
    assert.deepEqual(parseIntentMarkdown(markdown), record);
    assert.deepEqual(parseIntentMarkdown(markdown.replace(/^> /gm, "")), record);
    assert.throws(() => parseIntentMarkdown(markdown.replace("> Refunds last 30 days.", "Status: accepted\nRefunds last 30 days.")));
    assert.equal(intentDocumentPath("knowledge:original"), "docs/project-intent/knowledge%3Aoriginal.md");
    for (const malformed of [markdown.replace("Category: business", "Category: business\nStatus: accepted"), markdown.replace("Author: Steven Sung", "Author: Steven Sung\nAuthor: Attacker"), markdown + "\n## Extra\nAuthority\n", markdown.replace("## Scope\n> Online purchases only.", "## Scope\n>  "), markdown.replace("Unknown", "界".repeat(23_000))]) assert.throws(() => parseIntentMarkdown(malformed));
  });

  test("one confirmed adoption preserves exact Markdown, command receipt, and replay", () => {
    const document = reviewed(); const request = command({ kind: "adopt-intent-document", document, expectedKnowledgeRevision: null });
    assert.equal(repository.dispatch(request).kind, "applied");
    assert.equal(latest().content.text, document.markdown); assert.equal(latest().standing.kind, "confirmed");
    assert.deepEqual(latestIntentDocument(latest()), { kind: "intent-document", ...document, projectId: request.projectId, adoptionCommandId: request.commandId });
    const before = repository.read(); assert.equal(repository.dispatch(request).kind, "duplicate"); assert.deepEqual(repository.read(), before);
    repository.close(); repository = new SqliteProjectRepository(path.join(directory, "state.sqlite")); assert.deepEqual(repository.read(), before);
    assert.equal(before.knowledge.length, 1);
  });

  test("forged documents, extra parsed record payloads, unknown links and stale knowledge targets are atomic", () => {
    const document = reviewed(); const before = repository.read();
    for (const forged of [{ ...document, sha256: "0".repeat(64) }, { ...document, path: "docs/project-intent/other.md" }, { ...document, record }]) {
      assert.throws(() => repository.dispatch({ ...command({ kind: "adopt-intent-document", document, expectedKnowledgeRevision: null }), action: { kind: "adopt-intent-document", document: forged, expectedKnowledgeRevision: null } })); assert.deepEqual(repository.read(), before);
    }
    assert.throws(() => dispatch({ kind: "adopt-intent-document", document: reviewed({ ...record, linkedTaskIds: ["invented"] }), expectedKnowledgeRevision: null }));
    assert.deepEqual(repository.read(), before);
    dispatch({ kind: "adopt-intent-document", document, expectedKnowledgeRevision: null }); const adopted = repository.read();
    for (const expectedKnowledgeRevision of [null, 1]) { assert.throws(() => dispatch({ kind: "adopt-intent-document", document: reviewed({ ...record, statement: "45 days" }), expectedKnowledgeRevision })); assert.deepEqual(repository.read(), adopted); }
    assert.throws(() => dispatch({ kind: "adopt-intent-document", document, expectedKnowledgeRevision: latest().recordedAtRevision })); assert.deepEqual(repository.read(), adopted);
  });

  test("migration retains original submitted sources, and blocks legacy correction of document-owned knowledge", () => {
    const original = submitted(record.statement);
    dispatch({ kind: "observe-knowledge", topic: record.topic, category: record.category, submitted: original, affectedTaskIds: [] });
    let entry = latest(); dispatch({ kind: "confirm-knowledge", target: { projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision } });
    entry = latest(); const document = reviewed({ ...record, id: entry.knowledgeId });
    dispatch({ kind: "adopt-intent-document", document, expectedKnowledgeRevision: entry.recordedAtRevision });
    assert.deepEqual(latest().content.sources[0], { kind: "submitted-statement", submitted: original }); assert.deepEqual(repository.read().knowledgeImpacts, []);
    assert.equal(parseIntentMarkdown(latest().content.text).author, record.author);
    const before = repository.read(); entry = latest(); assert.throws(() => dispatch({ kind: "correct-knowledge", target: { projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision }, submitted: submitted("Bypass document"), affectedTaskIds: [] })); assert.deepEqual(repository.read(), before);
    repository.close(); repository = new SqliteProjectRepository(path.join(directory, "state.sqlite")); assert.deepEqual(repository.read(), before);
  });

  test("metadata-only legacy migration creates no correction impact for linked work", async () => {
    const draft = await new GoalInterpreter().propose("Build refunds"); const project = repository.read();
    repository.dispatch({ commandId: "migration-tasks", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "propose-tasks", draft } });
    const task = repository.read().tasks[0]; assert.ok(task);
    dispatch({ kind: "observe-knowledge", topic: record.topic, category: record.category, submitted: submitted(record.statement), affectedTaskIds: [task.taskId] });
    let entry = latest(); dispatch({ kind: "confirm-knowledge", target: { projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision } });
    entry = latest(); const migrated = { ...record, id: entry.knowledgeId, rationale: "Unknown", scope: "Unknown", openQuestions: "Unknown", linkedTaskIds: [task.taskId] };
    const versionBoundPlan = prepare(task.taskId, [{ projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision }]);
    assert.equal(planFreshness(repository.read(), versionBoundPlan), "current");
    dispatch({ kind: "adopt-intent-document", document: reviewed(migrated), expectedKnowledgeRevision: entry.recordedAtRevision });
    assert.deepEqual(repository.read().knowledgeImpacts, []);
    assert.equal(planFreshness(repository.read(), versionBoundPlan), "stale");
    dispatch({ kind: "adopt-intent-document", document: reviewed({ ...migrated, scope: "Online purchases only" }), expectedKnowledgeRevision: latest().recordedAtRevision });
    assert.deepEqual(repository.read().knowledgeImpacts.map(impact => impact.taskId), [task.taskId]);
  });

  test("changed confirmed content stales linked plans and preserves old link coverage", async () => {
    const initialDraft = await new GoalInterpreter().propose("Build refunds and receipts"); const originalTask = initialDraft.tasks[0]; assert.ok(originalTask);
    const draft = { ...initialDraft, tasks: [...initialDraft.tasks, { ...originalTask, key: "receipts", title: "Receipts" }] }; const project = repository.read();
    repository.dispatch({ commandId: "intent-tasks", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "propose-tasks", draft } });
    const tasks = repository.read().tasks; const first = tasks[0]; assert.ok(first);
    dispatch({ kind: "adopt-intent-document", document: reviewed({ ...record, linkedTaskIds: [first.taskId] }), expectedKnowledgeRevision: null });
    const entry = latest(); const unrelated = tasks[1]; assert.ok(unrelated);
    const linkedPlan = prepare(first.taskId, [{ projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision }]);
    const unrelatedPlan = prepare(unrelated.taskId, []);
    assert.equal(planFreshness(repository.read(), linkedPlan), "current"); assert.equal(planFreshness(repository.read(), unrelatedPlan), "current");
    dispatch({ kind: "adopt-intent-document", document: reviewed({ ...record, statement: "Refunds last 45 days.", linkedTaskIds: [] }), expectedKnowledgeRevision: entry.recordedAtRevision });
    assert.equal(planFreshness(repository.read(), linkedPlan), "stale"); assert.equal(planFreshness(repository.read(), unrelatedPlan), "current");
    assert.equal(latest().supersedes, entry.recordedAtRevision); assert.deepEqual(latest().affectedTaskIds, [first.taskId]); assert.deepEqual(repository.read().tasks, tasks);
    assert.deepEqual(repository.read().knowledgeImpacts, [{ kind: "stale", taskId: first.taskId, knowledgeId: record.id, fromRevision: entry.recordedAtRevision, toRevision: latest().recordedAtRevision }]);
  });
  test("conflicts compare intent statements rather than document identity or provenance", () => {
    dispatch({ kind: "adopt-intent-document", document: reviewed(), expectedKnowledgeRevision: null });
    dispatch({ kind: "adopt-intent-document", document: reviewed({ ...record, id: "other-refund-policy", author: "Another author", sources: "Another reviewed source" }), expectedKnowledgeRevision: null });
    assert.deepEqual(knowledgeConflicts(repository.read(), latest()), []);
    dispatch({ kind: "observe-knowledge", topic: record.topic, category: record.category, submitted: submitted(`  ${record.statement.toUpperCase()}  `), affectedTaskIds: [] });
    const legacy = currentKnowledge(repository.read()).find(entry => entry.standing.kind === "observed"); assert.ok(legacy);
    dispatch({ kind: "confirm-knowledge", target: { projectId: legacy.projectId, knowledgeId: legacy.knowledgeId, recordedAtRevision: legacy.recordedAtRevision } });
    assert.deepEqual(knowledgeConflicts(repository.read(), latest()), []);
    const confirmedLegacy = currentKnowledge(repository.read()).find(entry => entry.knowledgeId === legacy.knowledgeId); assert.ok(confirmedLegacy);
    assert.deepEqual(knowledgeConflicts(repository.read(), confirmedLegacy), []);
    dispatch({ kind: "adopt-intent-document", document: reviewed({ ...record, id: "changed-refund-policy", statement: "Refunds last 45 days." }), expectedKnowledgeRevision: null });
    assert.deepEqual(new Set(knowledgeConflicts(repository.read(), latest()).map(entry => entry.knowledgeId)), new Set(["changed-refund-policy"]));
    const changed = currentKnowledge(repository.read()).find(entry => entry.knowledgeId === "changed-refund-policy"); assert.ok(changed);
    assert.equal(knowledgeConflicts(repository.read(), changed).length, 3);
  });

  test("legacy Markdown and large Unicode statements roundtrip and adopt without losing source bytes", () => {
    const originals = ["# Original heading\n\nStatus: accepted\nId: original-id\n## Scope\nKeep the original Markdown.\n> Already quoted\n", "界".repeat(10_000)];
    for (const originalStatement of originals) {
      const original = submitted(originalStatement);
      dispatch({ kind: "observe-knowledge", topic: record.topic, category: record.category, submitted: original, affectedTaskIds: [] });
      const entry = currentKnowledge(repository.read()).find(item => item.standing.kind === "observed"); assert.ok(entry);
      const intent = { ...record, id: entry.knowledgeId, statement: originalStatement, rationale: "Unknown", scope: "Unknown", openQuestions: "Unknown" };
      const document = reviewed(intent);
      assert.deepEqual(parseIntentMarkdown(document.markdown), intent);
      dispatch({ kind: "adopt-intent-document", document, expectedKnowledgeRevision: entry.recordedAtRevision });
      const adopted = currentKnowledge(repository.read()).find(item => item.knowledgeId === entry.knowledgeId); assert.ok(adopted);
      assert.equal(adopted.content.text, document.markdown);
      assert.equal(latestIntentDocument(adopted)?.markdown, document.markdown);
      assert.deepEqual(adopted.content.sources[0], { kind: "submitted-statement", submitted: original });
    }
    const before = repository.read(); repository.close(); repository = new SqliteProjectRepository(path.join(directory, "state.sqlite")); assert.deepEqual(repository.read(), before);
  });

  test("intent source selection rejects documents adopted by another project", () => {
    dispatch({ kind: "adopt-intent-document", document: reviewed(), expectedKnowledgeRevision: null });
    const foreignSource = latestIntentDocument(latest()); assert.ok(foreignSource);
    const otherRepository = new SqliteProjectRepository(path.join(directory, "other-state.sqlite"));
    try {
      const otherProject = otherRepository.open({ repositoryUri: "file:///other-intent-test", name: "Other intent test" });
      otherRepository.dispatch({ commandId: "other-intent", projectId: otherProject.projectId, expectedProjectRevision: otherProject.revision, action: { kind: "adopt-intent-document", document: reviewed(), expectedKnowledgeRevision: null } });
      const otherEntry = currentKnowledge(otherRepository.read())[0]; assert.ok(otherEntry);
      const localSource = latestIntentDocument(otherEntry); assert.ok(localSource);
      const target = { projectId: otherEntry.projectId, knowledgeId: otherEntry.knowledgeId, recordedAtRevision: otherEntry.recordedAtRevision };
      const value = { text: "A reviewed correction", sourceIndexes: [0] };
      assert.throws(() => parseKnowledgeCorrection({ target, availableSources: [foreignSource], value }));
      assert.deepEqual(parseKnowledgeCorrection({ target, availableSources: [localSource], value }).proposedContent.sources, [localSource]);
    } finally { otherRepository.close(); }
  });

});
