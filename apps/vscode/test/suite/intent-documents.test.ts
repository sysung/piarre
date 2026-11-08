import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { IntentDocuments } from "../../src/intent-documents.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { currentKnowledge } from "../../../../packages/core/src/index.js";
import { intentDocumentPath, renderIntentMarkdown, type IntentRecord } from "../../../../packages/core/src/intent-document.js";

suite("Repository intent review and handoff", () => {
  let directory: string;
  let workspace: string;
  let repository: SqliteProjectRepository;
  let documents: IntentDocuments;
  const record = (statement = "Refunds expire after 30 days."): IntentRecord => ({ id: "refund", topic: "Refund window", category: "business", author: "Agent proposal",
    statement, rationale: "Recorded product decision", scope: "Customer refunds", sources: "Owner's reviewed planning note", linkedTaskIds: [], openQuestions: "Unknown" });
  const save = (value = record()): string => {
    const relative = intentDocumentPath(value.id);
    mkdirSync(path.join(workspace, "docs/project-intent"), { recursive: true });
    writeFileSync(path.join(workspace, relative), renderIntentMarkdown(value));
    return relative;
  };
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-intent-files-"));
    workspace = path.join(directory, "workspace"); mkdirSync(workspace);
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    repository.open({ name: "Intent fixture", repositoryUri: pathToFileURL(workspace).href });
    documents = new IntentDocuments(repository);
  });
  teardown(() => { repository.close(); rmSync(directory, { recursive: true, force: true }); });

  test("saved proposals do not adopt and exact review survives restart without coding effects", () => {
    const relative = save();
    assert.equal(documents.inspect(relative).kind, "valid");
    assert.equal(repository.read().knowledge.length, 0);
    const reviewed = documents.preview(relative);
    const after = documents.adopt(reviewed.reviewId);
    assert.equal(currentKnowledge(after)[0]?.standing.kind, "confirmed");
    assert.equal(currentKnowledge(after)[0]?.content.sources[0]?.kind, "intent-document");
    assert.deepEqual(documents.adopt(reviewed.reviewId), after);
    assert.equal(after.executionRuns.length, 0); assert.equal(after.tasks.length, 0);
    repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    documents = new IntentDocuments(repository);
    assert.deepEqual(repository.read(), after);
    assert.match(documents.handoff(), /Refunds expire after 30 days/);
    assert.match(documents.handoff(), /Agent proposal/);
    assert.match(documents.handoff(), /not live project state or execution approval/);
    assert.match(readFileSync(documents.exportHandoff(), "utf8"), /Captured project revision: 2/);
  });

  test("pending replacement is visible but cannot replace the accepted handoff version", () => {
    const relative = save(); documents.adopt(documents.preview(relative).reviewId);
    save(record("Refunds expire after 45 days."));
    const inspection = documents.inspect(relative);
    assert.equal(inspection.kind === "valid" && inspection.state, "pending");
    const handoff = documents.handoff();
    assert.match(handoff, /Refunds expire after 30 days/);
    assert.match(handoff, /NOT replaced/);
    assert.match(handoff, /Refunds expire after 45 days/);
    assert.match(currentKnowledge(repository.read())[0]?.content.text ?? "", /30 days/);
  });

  test("changed bytes, cancellation and stale project review cannot adopt", () => {
    const relative = save(); const first = documents.preview(relative);
    save(record("Refunds expire after 45 days."));
    assert.throws(() => documents.adopt(first.reviewId), /changed during review/);
    const cancelled = documents.preview(relative); documents.cancel(cancelled.reviewId);
    assert.throws(() => documents.adopt(cancelled.reviewId), /Review is unavailable/);
    const stale = documents.preview(relative); const project = repository.read();
    repository.dispatch({ commandId: "rename", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "rename-project", name: "Changed project" } });
    assert.throws(() => documents.adopt(stale.reviewId), /changed during review/);
    assert.equal(repository.read().knowledge.length, 0);
  });

  test("missing or altered accepted snapshot blocks a current handoff", () => {
    const relative = save(); const review = documents.preview(relative); documents.adopt(review.reviewId);
    const snapshot = path.join(workspace, `.piarre/accepted/${review.document.sha256}.md`);
    writeFileSync(snapshot, "Altered accepted content");
    assert.throws(() => documents.handoff(), /missing or changed/);
    rmSync(snapshot);
    assert.throws(() => documents.handoff());
    assert.equal(repository.read().revision, 2);
  });

  test("forged status, wrong filename and symbolic links remain unavailable", () => {
    const relative = save();
    writeFileSync(path.join(workspace, relative), renderIntentMarkdown(record()).replace("Category: business", "Category: business\nStatus: accepted"));
    assert.equal(documents.inspect(relative).kind, "unavailable");
    assert.throws(() => documents.preview(relative));
    save();
    writeFileSync(path.join(workspace, "docs/project-intent/copy.md"), renderIntentMarkdown(record()));
    assert.equal(documents.inspect("docs/project-intent/copy.md").kind, "unavailable");
    rmSync(path.join(workspace, relative));
    const outside = path.join(directory, "outside.md"); writeFileSync(outside, renderIntentMarkdown(record()));
    symlinkSync(outside, path.join(workspace, relative));
    assert.equal(documents.inspect(relative).kind, "unavailable");
    assert.equal(repository.read().knowledge.length, 0);
  });

  test("legacy export preserves original identity and never overwrites a document", () => {
    const project = repository.read();
    repository.dispatch({ commandId: "legacy", projectId: project.projectId, expectedProjectRevision: project.revision,
      action: { kind: "observe-knowledge", topic: "Legacy policy", category: "business", affectedTaskIds: [],
        submitted: { projectId: project.projectId, contextRevision: project.revision, requestId: "original-owner-statement", originalStatement: "Keep unrelated files intact." } } });
    const entry = currentKnowledge(repository.read())[0]; assert.ok(entry);
    const file = documents.exportRecord(entry.knowledgeId);
    const bytes = readFileSync(file, "utf8");
    assert.match(bytes, /Id: knowledge:legacy/);
    assert.match(bytes, /original-owner-statement/);
    assert.equal(repository.read().revision, 2);
    assert.throws(() => documents.exportRecord(entry.knowledgeId), /EEXIST/);
    assert.equal(readFileSync(file, "utf8"), bytes);
  });
});
