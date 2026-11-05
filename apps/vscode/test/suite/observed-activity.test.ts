import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ProjectCommand, ProjectEvent, ProjectSnapshot } from "../../../../packages/core/src/index.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { activityMilestone, renderActivity } from "../../src/observed-activity.js";

suite("Observed Activity history", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  let databasePath: string;
  const dispatch = (action: ProjectCommand["action"]): ProjectSnapshot => {
    const project = repository.read();
    const result = repository.dispatch({ commandId: `event-${String(project.revision)}`, projectId: project.projectId, expectedProjectRevision: project.revision, action });
    assert.equal(result.kind, "applied"); return result.snapshot;
  };
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-activity-")); databasePath = path.join(directory, "project.sqlite");
    repository = new SqliteProjectRepository(databasePath); repository.open({ repositoryUri: "file:///activity", name: "Activity" });
  });
  teardown(() => { repository.close(); rmSync(directory, { recursive: true, force: true }); });

  test("SQL pages select sparse milestones in revision order, survive append/reopen, and never write history or visits", () => {
    const expected = [1];
    for (let index = 0; index < 47; index++) {
      dispatch({ kind: "set-explanation-preference", preference: "brief" });
      expected.push(dispatch({ kind: "rename-project", name: `Name ${String(index)}` }).revision);
    }
    const direct = new DatabaseSync(databasePath);
    try {
      const before = direct.prepare("SELECT (SELECT count(*) FROM events) events, (SELECT count(*) FROM commands) commands, (SELECT count(*) FROM project_visit) visits").get();
      const first = repository.readActivityEvents({ limit: 20 });
      assert.deepEqual(first.entries.map(entry => entry.revision), [...expected].reverse().slice(0, 20));
      assert.equal(first.nextBeforeRevision, first.entries.at(-1)?.revision);
      const cursor = first.nextBeforeRevision; assert.ok(cursor);
      const older = repository.readActivityEvents({ beforeRevision: cursor, limit: 20 });
      assert.deepEqual(older.entries.map(entry => entry.revision), [...expected].reverse().slice(20, 40));
      const lastCursor = older.nextBeforeRevision; assert.ok(lastCursor);
      const last = repository.readActivityEvents({ beforeRevision: lastCursor, limit: 20 });
      assert.deepEqual(last.entries.map(entry => entry.revision), [...expected].reverse().slice(40));
      assert.equal(last.nextBeforeRevision, null);
      assert.deepEqual(direct.prepare("SELECT (SELECT count(*) FROM events) events, (SELECT count(*) FROM commands) commands, (SELECT count(*) FROM project_visit) visits").get(), before);
      dispatch({ kind: "rename-project", name: "Appended newer event" });
      repository.close(); repository = new SqliteProjectRepository(databasePath);
      assert.deepEqual(repository.readActivityEvents({ beforeRevision: cursor, limit: 20 }), older);
      assert.equal(repository.readActivityEvents({ limit: 20 }).entries[0]?.revision, repository.read().revision);
      assert.deepEqual(repository.readActivityEvents({ beforeRevision: 1, limit: 20 }), { entries: [], nextBeforeRevision: null });
    } finally { direct.close(); }
  });

  test("LIMIT is applied in SQLite before parsing and paging rejects invalid bounds", () => {
    dispatch({ kind: "rename-project", name: "Second" }); dispatch({ kind: "rename-project", name: "Third" });
    const direct = new DatabaseSync(databasePath);
    try { direct.prepare("UPDATE events SET schema_version = 99 WHERE revision = 1").run(); } finally { direct.close(); }
    assert.deepEqual(repository.readActivityEvents({ limit: 1 }).entries.map(entry => entry.revision), [3]);
    assert.throws(() => repository.readActivityEvents({ beforeRevision: 2, limit: 1 }), /Invalid activity history/);
    for (const limit of [0, 51, 1.5, NaN]) assert.throws(() => repository.readActivityEvents({ limit }), /Invalid activity page/);
    for (const beforeRevision of [0, -1, 1.5, Infinity]) assert.throws(() => repository.readActivityEvents({ limit: 20, beforeRevision }), /Invalid activity page/);
  });

  test("allowlisted milestones retain exact identity and uncertainty without raw payloads or submitted text", () => {
    const project = repository.read();
    const privateText = "PRIVATE statement and source payload <script>unsafe</script>";
    const events: readonly ProjectEvent[] = [
      { kind: "conversation-started", submitted: { requestId: "request", projectId: project.projectId, contextRevision: 1, originalStatement: privateText }, sources: [] },
      { kind: "conversation-replied", requestId: "request", text: privateText, citations: [], providerThreadId: "thread", providerTurnId: "turn" },
      { kind: "conversation-ended", requestId: "request", outcome: "unknown", reason: privateText },
      { kind: "execution-recorded", commandId: "stop", action: { kind: "mark-execution-unknown", runId: "run-unknown", reason: privateText } },
      { kind: "execution-recorded", commandId: "finish", action: { kind: "finish-execution", runId: "run-failed", outcome: "failed", summary: privateText, manifestHash: "a".repeat(64) } },
      { kind: "coordination-recorded", commandId: "stop-assignment", action: { kind: "coordinate", operation: "stop", groupId: "group", assignmentId: "worker", observedAt: 1 } },
      { kind: "task-triage-recorded", commandId: "triage", action: { kind: "propose-task-triage", taskId: "task", basedOnTriageRevision: null, desired: { priority: "high", disposition: { kind: "deferred", reason: privateText } }, rationale: privateText, origin: { kind: "user" } } },
      { kind: "task-triage-recorded", commandId: "adopt", action: { kind: "adopt-task-triage", proposalId: "triage-proposal:triage", proposalRevision: 9, triageRevision: null } },
      { kind: "knowledge-relationship-recorded", commandId: "withdraw", action: { kind: "withdraw-knowledge-relationship", target: { relationshipId: "relationship:source", proposalRevision: 2 }, adoptionRevision: 3 } },
    ];
    const entries = events.map((event, index) => { const entry = activityMilestone(event, index + 2); assert.ok(entry); return entry; });
    const html = renderActivity(project, { entries, nextBeforeRevision: null });
    assert.doesNotMatch(JSON.stringify(entries), /PRIVATE|payload|unsafe/);
    assert.doesNotMatch(html, /PRIVATE|<script>/);
    assert.match(html, /unknown · reconciliation required/);
    assert.match(html, /completion not established/);
    assert.match(html, /acceptance is separate · failed/);
    assert.match(html, /Historical or missing/);
    assert.match(html, /Task triage adopted by user · no execution approval/);
    assert.match(html, /Knowledge relationship withdrawn · history retained/);
    assert.match(html, /triage-proposal:triage · project revision 9/);
    assert.match(html, /run-unknown · project revision 5/);
    assert.equal(activityMilestone({ kind: "reflection-recorded", commandId: "preference", action: { kind: "set-explanation-preference", preference: "brief" } }, 9), undefined);
  });

  test("removed proposals and corrected knowledge keep historical identities without a current navigation claim", () => {
    dispatch({ kind: "propose-tasks", draft: { source: "deterministic-draft", goal: "Original proposal", tasks: [{ key: "one", title: "One task", requirements: [{ key: "r", text: "Preserve behavior" }], proposedScope: { included: ["one.txt"], excluded: [] }, checks: [{ key: "c", requirementKeys: ["r"], description: "Inspect behavior" }], dependsOn: [], proposedBudget: { maxTokens: 1000, maxElapsedMinutes: 1, maxAttempts: 1 } }] } });
    const proposal = repository.read().proposals[0]; assert.ok(proposal);
    const saved = repository.readActivityEvents({ limit: 20 });
    assert.match(renderActivity(repository.read(), saved), /Open current task and proposal/);
    dispatch({ kind: "delete-proposal", groupId: proposal.groupId });
    const html = renderActivity(repository.read(), saved);
    assert.match(html, /Historical or missing · removed from current work/);
    assert.doesNotMatch(html, /data-open-goal/);
    const project = repository.read();
    dispatch({ kind: "observe-knowledge", topic: "Refunds", category: "business", submitted: { requestId: "refund", projectId: project.projectId, contextRevision: project.revision, originalStatement: "30 days" }, affectedTaskIds: [] });
    let knowledge = repository.read().knowledge[0]; assert.ok(knowledge);
    dispatch({ kind: "confirm-knowledge", target: { projectId: project.projectId, knowledgeId: knowledge.knowledgeId, recordedAtRevision: knowledge.recordedAtRevision } });
    knowledge = repository.read().knowledge.at(-1); assert.ok(knowledge);
    dispatch({ kind: "correct-knowledge", target: { projectId: project.projectId, knowledgeId: knowledge.knowledgeId, recordedAtRevision: knowledge.recordedAtRevision }, submitted: { requestId: "refund-correction", projectId: project.projectId, contextRevision: repository.read().revision, originalStatement: "45 days" }, affectedTaskIds: [] });
    const corrected = renderActivity(repository.read(), repository.readActivityEvents({ limit: 20 }));
    assert.match(corrected, /Historical source · current knowledge is revision/);
    assert.match(corrected, /Exact current record · confirmed/);
  });
});
