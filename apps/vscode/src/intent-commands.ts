import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as vscode from "vscode";
import { currentKnowledge, type ProjectSnapshot } from "../../../packages/core/src/index.js";
import { intentDocumentPath } from "../../../packages/core/src/intent-document.js";
import { IntentDocuments } from "./intent-documents.js";
import type { SqliteProjectRepository } from "./sqlite-project-repository.js";

const trusted = (): boolean => vscode.workspace.isTrusted;

export function registerIntentCommands(
  readRepository: () => SqliteProjectRepository | undefined,
  publish: (project: ProjectSnapshot) => void,
): vscode.Disposable {
  let owner: SqliteProjectRepository | undefined;
  let documents: IntentDocuments | undefined;
  let busy = false;
  const run = (operation: (repository: SqliteProjectRepository, service: IntentDocuments, current: () => boolean) => Promise<void>) => async () => {
    if (busy || !trusted()) return;
    busy = true;
    try {
      if (!readRepository()) await vscode.commands.executeCommand("piarre.open");
      const repository = readRepository();
      if (!repository || !trusted()) return;
      if (owner !== repository) { owner = repository; documents = new IntentDocuments(repository); }
      const service = documents;
      if (!service) return;
      await operation(repository, service, () => readRepository() === repository && trusted());
    } catch (error) {
      await vscode.window.showWarningMessage(`Piarre intent documents: ${error instanceof Error ? error.message : "Operation could not finish."}`);
    } finally { busy = false; }
  };
  const create = vscode.commands.registerCommand("piarre.createIntentDocument", run(async (repository, service, current) => {
    const topic = await vscode.window.showInputBox({ title: "Propose project intent", prompt: "Name one requirement or decision", validateInput: value => value.trim() && value.length <= 200 ? undefined : "Enter 1 to 200 characters." });
    if (!topic || !current()) return;
    const category = await vscode.window.showQuickPick([{ label: "Business requirement", category: "business" as const }, { label: "Technical decision", category: "decision" as const }], { title: "Record category" });
    if (!category || !current()) return;
    const file = service.createDraft({ id: `intent-${randomUUID()}`, topic, category: category.category });
    await vscode.window.showTextDocument(vscode.Uri.file(file));
    publish(repository.read());
  }));
  const review = vscode.commands.registerCommand("piarre.reviewIntentDocument", (recordId: unknown) => run(async (repository, service, current) => {
    let relative = typeof recordId === "string" ? intentDocumentPath(recordId) : undefined;
    if (!relative) {
      const choices = service.list().map(item => item.kind === "valid"
        ? { label: item.record.topic, description: item.state, detail: item.document.path, relative: item.document.path }
        : { label: item.path, description: "Unavailable", detail: item.reason, relative: item.path });
      const selected = await vscode.window.showQuickPick(choices, { title: "Review one intent document", placeHolder: "Create a document first if none are available." });
      if (!selected || !current()) return;
      relative = selected.relative;
    }
    const absolute = path.join(fileURLToPath(repository.read().repositoryUri), relative);
    const dirty = () => vscode.workspace.textDocuments.some(document => document.uri.scheme === "file" && document.uri.fsPath === absolute && document.isDirty);
    if (dirty()) throw new Error("Save the intent document before reviewing its exact version.");
    const prepared = service.preview(relative);
    try {
      const before = await vscode.workspace.openTextDocument({ language: "markdown", content: prepared.previous });
      const after = await vscode.workspace.openTextDocument({ language: "markdown", content: prepared.document.markdown });
      await vscode.commands.executeCommand("vscode.diff", before.uri, after.uri, `Review intent: ${prepared.record.topic}`);
      if (!current()) return;
      const choice = await vscode.window.showWarningMessage(`Adopt this version of ${prepared.record.topic}?`, { modal: true,
        detail: `The open diff shows the exact old and proposed Markdown.\n\n${prepared.document.markdown}\n\nSHA-256: ${prepared.document.sha256}\n\nLinked tasks: ${prepared.affectedTaskIds.join(", ") || "None recorded"}. Revision-bound plans may need review after adoption. Missing links do not establish complete impact. Authorship and source labels are recorded claims; adoption is your review of this version, not independent verification or coding approval.` }, "Adopt reviewed version");
      if (choice !== "Adopt reviewed version" || !current()) return;
      if (dirty()) throw new Error("The editor changed during review. Save and review again.");
      publish(service.adopt(prepared.reviewId));
    } finally { service.cancel(prepared.reviewId); }
  })());
  const exportRecord = vscode.commands.registerCommand("piarre.exportIntentRecord", run(async (repository, service, current) => {
    const selected = await vscode.window.showQuickPick(currentKnowledge(repository.read()).map(entry => ({ label: entry.topic, description: entry.standing.kind, knowledgeId: entry.knowledgeId })), { title: "Export existing knowledge as an unreviewed document" });
    if (!selected || !current()) return;
    const choice = await vscode.window.showWarningMessage("Create a draft from this recorded knowledge?", { modal: true,
      detail: "Preserves the original knowledge ID and source references. Existing files will never be overwritten. This does not adopt the document or change project history." }, "Create document draft");
    if (choice !== "Create document draft" || !current()) return;
    await vscode.window.showTextDocument(vscode.Uri.file(service.exportRecord(selected.knowledgeId)));
  }));
  const handoff = vscode.commands.registerCommand("piarre.exportIntentHandoff", run(async (_repository, service, current) => {
    const text = service.handoff();
    const preview = await vscode.workspace.openTextDocument({ language: "markdown", content: text });
    await vscode.window.showTextDocument(preview);
    const choice = await vscode.window.showInformationMessage("Save this resumption snapshot for your coding agent?", { modal: true,
      detail: "The preview preserves accepted versions, pending changes and recorded gaps. A new file will be created under .piarre/handoffs. It is a snapshot, not live state, and grants no execution permission." }, "Save handoff snapshot");
    if (choice !== "Save handoff snapshot" || !current()) return;
    if (service.handoff() !== text) throw new Error("Context changed during handoff review. Export it again.");
    await vscode.window.showTextDocument(vscode.Uri.file(service.exportHandoff()));
  }));
  return vscode.Disposable.from(create, review, exportRecord, handoff);
}
