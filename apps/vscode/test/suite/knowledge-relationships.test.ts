import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import { validateProjectCommand, currentKnowledge, parseFileSource, relationshipDecision, relationshipKnowledgeCurrent, relationshipText, type KnowledgeRelationshipAction, type ProjectCommand, type RelationshipDraft } from "../../../../packages/core/src/index.js";
import { parseSuppliedReference, sourceCollectionVersion } from "../../../../packages/core/src/supplied-source.js";
import { resolveRecordReference } from "../../../../packages/core/src/inspection.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { ProjectRetrieval } from "../../src/project-retrieval.js";
import { assertSharedFilesCurrent } from "../../src/file-context.js";
import { KnowledgeRelationshipController } from "../../src/knowledge-relationship-controller.js";
import { renderKnowledgeRelationships } from "../../src/knowledge-relationship-view.js";
import { captureCompilerReferences, lookupCompilerReferences } from "../../src/technical-lookup.js";

suite("Exact knowledge source relationships", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  let sequence = 0;
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-relationships-"));
    mkdirSync(path.join(directory, "repo"));
    writeFileSync(path.join(directory, "repo", "refund.ts"), "export const refundDays = 45;\nexport const unrelated = 999;\n");
    writeFileSync(path.join(directory, "repo", "service.tf"), "resource service policy45 {}\n");
    repository = new SqliteProjectRepository(path.join(directory, "state.sqlite"));
    repository.open({ repositoryUri: vscode.Uri.file(path.join(directory, "repo")).toString(), name: "Relationships" });
  });
  teardown(async () => { await vscode.commands.executeCommand("workbench.action.closeAllEditors"); repository.close(); rmSync(directory, { recursive: true, force: true }); });
  const dispatch = (action: ProjectCommand["action"]) => repository.dispatch({ commandId: `relationship-test-${String(++sequence)}`, projectId: repository.read().projectId, expectedProjectRevision: repository.read().revision, action });
  function observe() {
    const project = repository.read();
    dispatch({ kind: "observe-knowledge", topic: "Refund window", category: "business", affectedTaskIds: [], submitted: { requestId: `request-${String(++sequence)}`, projectId: project.projectId, contextRevision: project.revision, originalStatement: "Refunds are permitted for 45 days." } });
    const entry = currentKnowledge(repository.read())[0]; assert.ok(entry);
    return { projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision };
  }
  function capture(file = "refund.ts") {
    const project = repository.read();
    const index = new ProjectRetrieval({ projectId: project.projectId, root: path.join(directory, "repo") });
    try { return parseFileSource(index.captureFile(file, project.revision, 1, 1)); } finally { index.dispose(); }
  }
  function propose(role: RelationshipDraft["role"] = "implementation") {
    const knowledge = observe();
    dispatch({ kind: "propose-knowledge-relationship", draft: { knowledge, role, source: capture(role === "infrastructure-declaration" ? "service.tf" : "refund.ts"), explanation: "I use this exact source for the 45-day policy.", extraction: { kind: "selected-file-excerpt" }, author: { kind: "user" } } });
    const relation = repository.read().knowledgeRelationships.proposals.at(-1); assert.ok(relation);
    return relation;
  }
  function target(relation: ReturnType<typeof propose>) { return { relationshipId: relation.relationshipId, proposalRevision: relation.recordedAtRevision }; }
  test("old histories retain empty relationships and byte-identical source collection versions", () => {
    const project = repository.read();
    assert.deepEqual(project.knowledgeRelationships, { proposals: [], decisions: [] });
    assert.equal(sourceCollectionVersion(project), JSON.stringify({ knowledge: [], proposals: [], tasks: [] }));
    assert.match(renderKnowledgeRelationships(project), /No source relationships recorded/);
  });
  test("SQLite proposal/adoption receipts and restart retain exact knowledge, source bytes, explanation and provenance", () => {
    const relation = propose();
    const project = repository.read();
    assert.equal(relationshipDecision(project, relation.relationshipId), undefined);
    const command = { commandId: `adopt-${String(++sequence)}`, projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "adopt-knowledge-relationship", target: target(relation) } satisfies KnowledgeRelationshipAction };
    assert.equal(repository.dispatch(command).kind, "applied");
    assert.equal(repository.dispatch(command).kind, "duplicate");
    const before = repository.read(); repository.close(); repository = new SqliteProjectRepository(path.join(directory, "state.sqlite"));
    assert.deepEqual(repository.read(), before);
    const reference = { kind: "relationship", projectId: project.projectId, recordId: relation.relationshipId, revision: relation.recordedAtRevision } satisfies import("../../../../packages/core/src/inspection.js").RecordReference;
    assert.deepEqual(parseSuppliedReference(reference), reference);
    const resolved = resolveRecordReference(before, reference); assert.equal(resolved.kind, "resolved");
    { assert.match(resolved.text, /Refunds are permitted for 45 days/); assert.match(resolved.text, /refundDays = 45/); assert.match(resolved.text, /Original explanation: I use/); assert.doesNotMatch(resolved.text, /unrelated = 999/); assertSharedFilesCurrent(before, [{ reference, text: resolved.text }]); }
    assert.match(renderKnowledgeRelationships(before), /Withdraw relationship/);
  });
  test("a correction leaves old adopted links historical, never retargets them, and blocks pending adoption", () => {
    const relation = propose();
    dispatch({ kind: "adopt-knowledge-relationship", target: target(relation) });
    dispatch({ kind: "confirm-knowledge", target: relation.knowledge });
    const confirmed = currentKnowledge(repository.read())[0]; assert.ok(confirmed);
    dispatch({ kind: "propose-knowledge-relationship", draft: { role: relation.role, source: relation.source, explanation: relation.explanation, extraction: relation.extraction, author: relation.author, knowledge: { projectId: confirmed.projectId, knowledgeId: confirmed.knowledgeId, recordedAtRevision: confirmed.recordedAtRevision } } });
    const pending = repository.read().knowledgeRelationships.proposals.at(-1); assert.ok(pending);
    const project = repository.read();
    dispatch({ kind: "correct-knowledge", target: { projectId: project.projectId, knowledgeId: confirmed.knowledgeId, recordedAtRevision: confirmed.recordedAtRevision }, affectedTaskIds: [], submitted: { requestId: "correction", projectId: project.projectId, contextRevision: project.revision, originalStatement: "Refunds now require 60 days." } });
    assert.equal(relationshipKnowledgeCurrent(repository.read(), relation), false);
    assert.equal(repository.read().knowledgeRelationships.proposals[0]?.knowledge.recordedAtRevision, relation.knowledge.recordedAtRevision);
    assert.match(relationshipText(repository.read(), relation), /45 days/);
    assert.match(renderKnowledgeRelationships(repository.read()), /historical knowledge revision/);
    assert.equal(resolveRecordReference(repository.read(), { kind: "relationship", projectId: project.projectId, recordId: relation.relationshipId, revision: relation.recordedAtRevision }).kind, "stale");
    assert.throws(() => dispatch({ kind: "adopt-knowledge-relationship", target: target(pending) }));
  });
  test("stale proposal revision and project revision cannot adopt; withdrawal remains append-only even for stale files", () => {
    const relation = propose("infrastructure-declaration");
    assert.throws(() => dispatch({ kind: "adopt-knowledge-relationship", target: { ...target(relation), proposalRevision: relation.recordedAtRevision - 1 } }));
    const stale = repository.read();
    dispatch({ kind: "rename-project", name: "Changed during review" });
    assert.equal(repository.dispatch({ commandId: "stale-adopt", projectId: stale.projectId, expectedProjectRevision: stale.revision, action: { kind: "adopt-knowledge-relationship", target: target(relation) } }).kind, "stale");
    dispatch({ kind: "adopt-knowledge-relationship", target: target(relation) });
    const adoption = relationshipDecision(repository.read(), relation.relationshipId); assert.ok(adoption);
    writeFileSync(path.join(directory, "repo", "service.tf"), "resource changed {}\n");
    assert.throws(() => { assertSharedFilesCurrent(repository.read(), [relation.source]); });
    assert.throws(() => dispatch({ kind: "withdraw-knowledge-relationship", target: target(relation), adoptionRevision: adoption.recordedAtRevision - 1 }));
    dispatch({ kind: "withdraw-knowledge-relationship", target: target(relation), adoptionRevision: adoption.recordedAtRevision });
    const project = repository.read();
    assert.equal(project.knowledgeRelationships.decisions.length, 2);
    assert.equal(project.knowledgeRelationships.proposals.length, 1);
    assert.equal(relationshipDecision(project, relation.relationshipId)?.kind, "withdrawn");
    assert.match(renderKnowledgeRelationships(project), /Infrastructure links describe declarations/);
    assert.match(renderKnowledgeRelationships(project), /they do not show that tests ran/);
  });
  test("native adoption reviews exact content, rechecks after the modal and never authorizes execution", async () => {
    const relation = propose();
    const descriptor = Object.getOwnPropertyDescriptor(vscode.window, "showWarningMessage"); assert.ok(descriptor);
    let beforeApproval: (() => void) | undefined = () => { writeFileSync(path.join(directory, "repo", "refund.ts"), "changed after review\n"); };
    let detail = "";
    Object.defineProperty(vscode.window, "showWarningMessage", { configurable: true, value: (_message: string, options: vscode.MessageOptions) => { detail = options.detail ?? ""; beforeApproval?.(); return Promise.resolve("Adopt relationship"); } });
    let current = true;
    const controller = new KnowledgeRelationshipController(repository, () => undefined, () => current && vscode.workspace.isTrusted);
    try {
      await assert.rejects(controller.handle("review-relationship", relation.relationshipId));
      assert.deepEqual(repository.read().knowledgeRelationships.decisions, []);
      assert.match(detail, /refundDays = 45/); assert.match(detail, /Current captured bytes/);
      writeFileSync(path.join(directory, "repo", "refund.ts"), "export const refundDays = 45;\nexport const unrelated = 999;\n");
      const fresh = propose();
      beforeApproval = () => { current = false; };
      await controller.handle("review-relationship", fresh.relationshipId);
      assert.deepEqual(repository.read().knowledgeRelationships.decisions, []);
      current = true; beforeApproval = undefined;
      await controller.handle("review-relationship", fresh.relationshipId);
      assert.equal(relationshipDecision(repository.read(), fresh.relationshipId)?.kind, "adopted");
      assert.deepEqual(repository.read().executionRuns, []); assert.deepEqual(repository.read().executionPlans, []);
    } finally { Object.defineProperty(vscode.window, "showWarningMessage", descriptor); }
  });
  test("strict source boundary rejects diffs, invented inference, extra fields, wrong project and unsafe paths", () => {
    const knowledge = observe(); const source = capture();
    const draft: RelationshipDraft = { knowledge, source, role: "symbol", extraction: { kind: "selected-file-excerpt" }, author: { kind: "user" }, explanation: "Exact source" };
    assert.throws(() => parseFileSource({ ...source, reference: { ...source.reference, representation: { kind: "git-diff", baseCommit: "a".repeat(40) } } }));
    assert.throws(() => parseFileSource({ ...source, reference: { ...source.reference, path: "../escape.ts" } }));
    for (const invalidDraft of [{ ...draft, author: { kind: "inferred" } }, { ...draft, extra: true }]) {
      assert.throws(() => validateProjectCommand({ commandId: `invalid-${String(++sequence)}`, projectId: repository.read().projectId, expectedProjectRevision: repository.read().revision, action: { kind: "propose-knowledge-relationship", draft: invalidDraft } }));
    }
    assert.throws(() => dispatch({ kind: "propose-knowledge-relationship", draft: { ...draft, source: { ...source, reference: { ...source.reference, projectId: "other" } } } }));
    assert.deepEqual(repository.read().knowledgeRelationships.proposals, []);
  });
  test("source edits, rename/deletion and unsaved buffers block consequential relationship reuse", async () => {
    const relation = propose(); dispatch({ kind: "adopt-knowledge-relationship", target: target(relation) });
    const project = repository.read();
    const reference = { kind: "relationship", projectId: project.projectId, recordId: relation.relationshipId, revision: relation.recordedAtRevision } satisfies import("../../../../packages/core/src/inspection.js").RecordReference;
    const sources = [{ reference, text: relationshipText(project, relation) }];
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(directory, "repo", "refund.ts")));
    const editor = await vscode.window.showTextDocument(document);
    await editor.edit(builder => { builder.insert(new vscode.Position(0, 0), "// unsaved\n"); });
    assert.throws(() => { assertSharedFilesCurrent(project, sources); }, /Save source/);
    await vscode.commands.executeCommand("workbench.action.files.revert");
    renameSync(path.join(directory, "repo", "refund.ts"), path.join(directory, "repo", "moved.ts"));
    assert.throws(() => { assertSharedFilesCurrent(project, sources); });
    rmSync(path.join(directory, "repo", "moved.ts"));
    assert.throws(() => { assertSharedFilesCurrent(project, sources); });
  });
});

suite("Native compiler relationship captures", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  let provider: vscode.Disposable;
  let respond: () => vscode.ProviderResult<vscode.Location[]>;
  let origin: vscode.TextDocument;
  let target: vscode.Uri;
  setup(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-compiler-relationships-"));
    writeFileSync(path.join(directory, "origin.md"), "policy45\n");
    writeFileSync(path.join(directory, "target.md"), "policy45 implementation\n");
    repository = new SqliteProjectRepository(path.join(directory, "state.sqlite"));
    repository.open({ repositoryUri: vscode.Uri.file(directory).toString(), name: "Compiler captures" });
    target = vscode.Uri.file(path.join(directory, "target.md"));
    origin = await vscode.languages.setTextDocumentLanguage(await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(directory, "origin.md"))), "plaintext");
    await vscode.window.showTextDocument(origin);
    respond = () => [new vscode.Location(target, new vscode.Range(0, 0, 0, 8))];
    provider = vscode.languages.registerReferenceProvider({ language: "plaintext", scheme: "file", pattern: new vscode.RelativePattern(directory, "origin.md") }, { provideReferences: () => respond() });
  });
  teardown(async () => { provider.dispose(); await vscode.commands.executeCommand("workbench.action.closeAllEditors"); repository.close(); rmSync(directory, { recursive: true, force: true }); });
  test("actual language provider preserves saved origin, exact returned bytes and static coverage", async () => {
    const capture = await captureCompilerReferences(repository.read()); assert.equal(capture.kind, "captured", JSON.stringify(capture));
    
    assert.equal(capture.origin.reference.path, "origin.md"); assert.equal(capture.origin.text, "policy45\n");
    assert.equal(capture.sources[0]?.reference.path, "target.md"); assert.equal(capture.sources[0].text, "policy45 implementation\n");
    assert.match(capture.coverage.limitation, /not business rationale/);
    assert.equal((await lookupCompilerReferences(repository.read())).kind, "matched");
  });
  test("missing results, over-limit and timed-out providers yield no captures", async () => {
    respond = () => undefined;
    const empty = await captureCompilerReferences(repository.read()); assert.equal(empty.kind, "captured");
    assert.deepEqual(empty.sources, []);
    assert.equal((await lookupCompilerReferences(repository.read())).kind, "no-match");
    respond = () => Array.from({ length: 21 }, (_value, index) => new vscode.Location(target, new vscode.Range(index, 0, index, 1)));
    assert.equal((await captureCompilerReferences(repository.read())).kind, "unavailable");
    respond = () => new Promise(() => undefined);
    assert.equal((await captureCompilerReferences(repository.read(), 10)).kind, "unavailable");
  });
  test("unsaved active and target documents cannot stand for captured disk evidence", async () => {
    const editor = await vscode.window.showTextDocument(origin);
    await editor.edit(builder => { builder.insert(new vscode.Position(0, 0), "dirty "); });
    assert.equal((await captureCompilerReferences(repository.read())).kind, "unavailable");
    await vscode.commands.executeCommand("workbench.action.files.revert");
    const targetEditor = await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(target));
    await targetEditor.edit(builder => { builder.insert(new vscode.Position(0, 0), "dirty "); });
    await vscode.window.showTextDocument(origin);
    assert.equal((await captureCompilerReferences(repository.read())).kind, "unavailable");
    await vscode.window.showTextDocument(targetEditor.document); await vscode.commands.executeCommand("workbench.action.files.revert");
  });
  test("out-of-root locations and disk origin mutation during provider execution fail closed", async () => {
    respond = () => [new vscode.Location(vscode.Uri.file(path.join(directory, "..", "outside.txt")), new vscode.Range(0, 0, 0, 1))];
    assert.equal((await captureCompilerReferences(repository.read())).kind, "unavailable");
    respond = () => { writeFileSync(path.join(directory, "origin.md"), "changed while provider ran\n"); return [new vscode.Location(target, new vscode.Range(0, 0, 0, 1))]; };
    assert.equal((await captureCompilerReferences(repository.read())).kind, "unavailable");
  });
});
