import { knowledgeWorkImpact } from "../../../packages/core/src/resumption.js";
import { fileURLToPath } from "node:url";
import { lookupProjectSources, type RetrievalResult } from "./project-retrieval.js";
import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { currentKnowledge, knowledgeConflicts, type KnowledgeAction, type ProjectSnapshot, type RecordedKnowledge } from "../../../packages/core/src/index.js";
import type { SqliteProjectRepository } from "./sqlite-project-repository.js";

export class KnowledgeController {
  private busy = false;
  private disposed = false;
  constructor(private readonly repository: SqliteProjectRepository, private readonly update: (project: ProjectSnapshot) => void, private readonly publishLookup?: (projectId: string, result: RetrievalResult) => void) {}

  async handle(kind: "observe-business" | "observe-decision" | "confirm-knowledge" | "correct-knowledge" | "lookup-project", knowledgeId?: string): Promise<void> {
    if (this.busy || !this.isCurrent()) return;
    this.busy = true;
    try {
      const initial = this.repository.read();
      const entry = currentKnowledge(initial).find(item => item.knowledgeId === knowledgeId);
      if (kind === "lookup-project") await this.lookup();
      else if (kind === "observe-business" || kind === "observe-decision") await this.observe(kind === "observe-business" ? "business" : "decision");
      else if (entry) await this.review(entry, kind === "correct-knowledge");
    } catch {
      if (this.isCurrent()) await vscode.window.showWarningMessage("The knowledge operation could not be saved. Review the latest project state before trying again.");
    } finally { this.busy = false; }
  }

  private async lookup(): Promise<void> {
    const query = await vscode.window.showInputBox({ prompt: "Look up exact identifiers or words in project sources and recorded knowledge", ignoreFocusOut: true,
      validateInput: value => value.trim() && value.length <= 1000 ? undefined : "Enter 1 to 1,000 characters." });
    if (query === undefined || !this.isCurrent()) return;
    const project = this.repository.read();
    const result = lookupProjectSources({ query, projectId: project.projectId, root: fileURLToPath(project.repositoryUri),
      readRecords: () => currentKnowledge(this.repository.read()).map(entry => ({ projectId: entry.projectId, recordId: entry.knowledgeId,
        revision: entry.recordedAtRevision, text: `${entry.topic}\n${entry.content.text}`, category: entry.category, standing: entry.standing.kind })) });
    this.publishLookup?.(project.projectId, result);
  }

  private apply(project: ProjectSnapshot, action: KnowledgeAction): void {
    if (!this.isCurrent()) return;
    const result = this.repository.dispatch({ commandId: randomUUID(), projectId: project.projectId,
      expectedProjectRevision: project.revision, action });
    if (result.kind === "applied") this.update(result.snapshot);
    else void vscode.window.showWarningMessage("The project changed during review. Inspect it and try the knowledge operation again.");
  }

  private async observe(category: "business" | "decision"): Promise<void> {
    const topic = await vscode.window.showInputBox({ prompt: "Knowledge topic (use the same topic for conflicting versions)", ignoreFocusOut: true, validateInput: value => value.trim() && value.length <= 200 ? undefined : "Enter a topic of 1 to 200 characters." });
    if (topic === undefined || !this.isCurrent()) return;
    const text = await vscode.window.showInputBox({ prompt: category === "business" ? "Business knowledge to record as an unconfirmed observation" : "Technical decision and its recorded rationale (unconfirmed)", ignoreFocusOut: true,
      validateInput: value => value.trim() && value.length <= 10_000 ? undefined : "Enter 1 to 10,000 characters." });
    if (text === undefined || !this.isCurrent()) return;
    const project = this.repository.read();
    const choices = project.tasks.map(task => ({ label: task.title, description: task.taskId, taskId: task.taskId }));
    const selected = choices.length ? await vscode.window.showQuickPick(choices, { canPickMany: true, ignoreFocusOut: true,
      placeHolder: "Link affected tasks. These are explicit links; missing links do not prove unaffected work." }) : [];
    if (selected === undefined || !this.isCurrent()) return;
    this.apply(project, { kind: "observe-knowledge", topic, category, affectedTaskIds: selected.map(item => item.taskId),
      submitted: { requestId: randomUUID(), projectId: project.projectId, contextRevision: project.revision, originalStatement: text } });
  }

  private async review(entry: RecordedKnowledge, correcting: boolean): Promise<void> {
    if (correcting !== (entry.standing.kind === "confirmed")) return;
    const text = correcting ? await vscode.window.showInputBox({ prompt: "Correct the confirmed record. Original wording and history will be retained.", value: entry.content.text, ignoreFocusOut: true,
      validateInput: value => value.trim() && value.length <= 10_000 ? undefined : "Enter 1 to 10,000 characters." }) : entry.content.text;
    if (text === undefined || !this.isCurrent()) return;
    const project = this.repository.read();
    const current = currentKnowledge(project).find(item => item.knowledgeId === entry.knowledgeId);
    if (current?.recordedAtRevision !== entry.recordedAtRevision) return;
    const affected = entry.affectedTaskIds.map(id => project.tasks.find(task => task.taskId === id)?.title ?? id);
    const conflicts = knowledgeConflicts(project, { ...entry, standing: { kind: "confirmed", confirmationCommandId: "preview-only" } });
    const impact = knowledgeWorkImpact(project, entry.knowledgeId).map(item => `Plan ${item.plan.planId} @${String(item.plan.recordedAtRevision)}; ${item.runs.map(run => `approval ${run.grant.approvalId}, run ${run.runId} (${run.state.kind}; process ${run.process.kind}; workspace ${run.workspace.kind})${run.state.kind === "terminal" ? `, result ${run.state.result.resultId} @${String(run.state.result.recordedAtRevision)}, ${String(run.state.result.checks.length)} historical check records` : ""}`).join("; ") || "no approval/result recorded"}`).join("\n");
    const label = correcting ? "Approve correction" : "Confirm knowledge";
    const approved = await vscode.window.showWarningMessage(`${label}: ${entry.topic}?`, { modal: true,
      detail: `${correcting ? `Previous (revision ${String(entry.recordedAtRevision)}):\n${entry.content.text}\n\nReplacement` : "Record"}:\n${text}\n\n${correcting ? "Linked plans and their future approvals/evidence become stale" : "Explicitly linked tasks"}: ${affected.join(", ") || "None recorded"}. Missing links cannot establish complete impact.\n\n${correcting ? `Recorded plan/approval/result impact:\n${impact || "No recorded execution relationships"}\nUnknown writers retain ownership and require reconciliation. Unrelated records are preserved.\n\n` : ""}${conflicts.length ? "Different confirmed records for this topic remain disputed; this action will not silently choose one.\n\n" : ""}This does not approve coding work, release a writer, or verify a claim.` }, label);
    if (approved !== label || !this.isCurrent()) return;
    const target = { projectId: project.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision };
    this.apply(project, correcting ? { kind: "correct-knowledge", target, affectedTaskIds: entry.affectedTaskIds,
      submitted: { requestId: randomUUID(), projectId: project.projectId, contextRevision: project.revision, originalStatement: text } }
      : { kind: "confirm-knowledge", target });
  }

  private isCurrent(): boolean { return !this.disposed && vscode.workspace.isTrusted; }

  dispose(): void { this.disposed = true; }
}
