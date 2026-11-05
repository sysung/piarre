import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { portableContextPath } from "../../../packages/core/src/context-path.js";
import { currentKnowledge, parseFileSource, relationshipDecision, relationshipKnowledgeCurrent, relationshipSources, relationshipText, type CapturedFileSource, type KnowledgeRelationshipAction, type ProjectSnapshot, type RelationshipExtraction, type RelationshipRole } from "../../../packages/core/src/index.js";
import { ProjectRetrieval } from "./project-retrieval.js";
import { captureCompilerReferences } from "./technical-lookup.js";
import { assertSharedFilesCurrent } from "./file-context.js";
import type { SqliteProjectRepository } from "./sqlite-project-repository.js";

export type RelationshipOperation = "prepare-relationship" | "review-relationship" | "withdraw-relationship" | "check-relationship";
export class KnowledgeRelationshipController {
  constructor(private readonly repository: SqliteProjectRepository, private readonly update: (project: ProjectSnapshot) => void, private readonly isCurrent: () => boolean) {}
  async handle(kind: RelationshipOperation, id?: string): Promise<void> {
    if (!this.isCurrent()) return;
    if (kind === "prepare-relationship") { await this.prepare(id); return; }
    const project = this.repository.read();
    const relationship = project.knowledgeRelationships.proposals.find(item => item.relationshipId === id);
    if (!relationship) return;
    const target = { relationshipId: relationship.relationshipId, proposalRevision: relationship.recordedAtRevision };
    const decision = relationshipDecision(project, relationship.relationshipId);
    if (kind === "withdraw-relationship") {
      if (decision?.kind !== "adopted") return;
      const approved = await vscode.window.showWarningMessage("Withdraw this exact relationship?", { modal: true, detail: `${relationshipText(project, relationship)}\n\nWithdrawal retains all original evidence and decisions. Stale files do not prevent withdrawal.` }, "Withdraw relationship");
      if (approved === "Withdraw relationship") this.apply(project, { kind: "withdraw-knowledge-relationship", target, adoptionRevision: decision.recordedAtRevision });
      return;
    }
    let fileStatus = "Current captured bytes";
    try { assertSharedFilesCurrent(project, relationshipSources(relationship)); }
    catch { fileStatus = "Stale or unavailable source evidence. Save buffers and recapture; adoption and consequential use are blocked."; }
    const currentKnowledgeVersion = relationshipKnowledgeCurrent(project, relationship);
    const detail = `${relationshipText(project, relationship)}\n\n${relationship.extraction.kind === "compiler-reference" ? `Saved compiler origin ${relationship.extraction.origin.reference.path}:${String(relationship.extraction.origin.reference.startLine)} (${relationship.extraction.origin.reference.contentHash})\n${relationship.extraction.origin.text}\n\n` : ""}File status: ${fileStatus}\nKnowledge: ${currentKnowledgeVersion ? "current exact revision" : "historical; correction does not retarget this link"}\nAdoption: ${decision?.kind ?? "proposed only"}. This user assertion does not confirm knowledge or authorize execution.`;
    if (kind === "check-relationship" || decision || !currentKnowledgeVersion || fileStatus !== "Current captured bytes") {
      await vscode.window.showInformationMessage("Recorded relationship evidence", { modal: true, detail }); return;
    }
    const approved = await vscode.window.showWarningMessage("Adopt this exact proposed relationship?", { modal: true, detail }, "Adopt relationship");
    if (approved !== "Adopt relationship" || !this.isCurrent()) return;
    assertSharedFilesCurrent(this.repository.read(), relationshipSources(relationship));
    this.apply(project, { kind: "adopt-knowledge-relationship", target });
  }
  private async prepare(id?: string): Promise<void> {
    const project = this.repository.read();
    const knowledge = currentKnowledge(project).find(item => item.knowledgeId === id);
    if (!knowledge) return;
    const route = await vscode.window.showQuickPick(["Active saved file selection", "Compiler references for active saved symbol"], { title: "Capture a bounded source for this knowledge revision", ignoreFocusOut: true });
    if (!route || !this.isCurrent()) return;
    let source: CapturedFileSource;
    let extraction: RelationshipExtraction;
    if (route === "Compiler references for active saved symbol") {
      const captured = await captureCompilerReferences(project);
      if (captured.kind !== "captured" || !captured.sources.length) { await vscode.window.showWarningMessage(captured.kind === "unavailable" ? captured.reason : "No compiler reference locations were returned. Coverage remains incomplete."); return; }
      const selected = await vscode.window.showQuickPick(captured.sources.map(item => ({ label: `${item.reference.path}:${String(item.reference.startLine)}-${String(item.reference.endLine)}`, description: item.text.slice(0, 120), source: item })), { title: "Choose one exact compiler location", ignoreFocusOut: true });
      if (!selected || !this.isCurrent()) return;
      source = selected.source; extraction = { kind: "compiler-reference", origin: captured.origin };
    } else {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.uri.scheme !== "file" || editor.document.isDirty) throw new Error("Select a saved file excerpt first");
      const index = new ProjectRetrieval({ projectId: project.projectId, root: fileURLToPath(project.repositoryUri) });
      try { source = parseFileSource(index.captureFile(portableContextPath(path.relative(fileURLToPath(project.repositoryUri), editor.document.uri.fsPath), path.sep), project.revision, editor.selection.start.line + 1,
        editor.selection.end.character === 0 && editor.selection.end.line > editor.selection.start.line ? editor.selection.end.line : editor.selection.end.line + 1)); }
      finally { index.dispose(); }
      extraction = { kind: "selected-file-excerpt" };
    }
    const roles: readonly RelationshipRole[] = ["implementation", "module", "symbol", "infrastructure-declaration", "supporting-evidence"];
    const selectedRole = await vscode.window.showQuickPick(roles.map(role => ({ label: role, role })), { title: "Your assertion about this source", ignoreFocusOut: true });
    if (!selectedRole || !this.isCurrent()) return;
    const explanation = await vscode.window.showInputBox({ prompt: "Explain why this exact source relates to the recorded knowledge. Your original wording is retained; static source does not establish runtime behavior.", ignoreFocusOut: true, validateInput: value => value.trim() && value.length <= 10_000 ? undefined : "Enter 1 to 10,000 characters." });
    if (explanation === undefined || !this.isCurrent()) return;
    assertSharedFilesCurrent(this.repository.read(), extraction.kind === "compiler-reference" ? [source, extraction.origin] : [source]);
    this.apply(project, { kind: "propose-knowledge-relationship", draft: { knowledge: { projectId: project.projectId, knowledgeId: knowledge.knowledgeId, recordedAtRevision: knowledge.recordedAtRevision }, role: selectedRole.role, source, extraction, explanation, author: { kind: "user" } } });
  }
  private apply(project: ProjectSnapshot, action: KnowledgeRelationshipAction): void {
    if (!this.isCurrent()) return;
    const result = this.repository.dispatch({ commandId: randomUUID(), projectId: project.projectId, expectedProjectRevision: project.revision, action });
    if (result.kind === "applied") this.update(result.snapshot);
    else void vscode.window.showWarningMessage("The project changed during relationship review. Inspect the exact revision and try again.");
  }
}
