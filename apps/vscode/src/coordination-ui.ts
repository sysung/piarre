import { selectSharedFiles } from "./source-sharing.js";
import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import type { ProjectSnapshot } from "../../../packages/core/src/index.js";
import { CoordinationController } from "./coordination-controller.js";
import type { CoordinationMessage } from "./coordination-actions.js";
export class CoordinationUi {
  private dialogOpen = false;
  constructor(private readonly controller: CoordinationController, private readonly read: () => ProjectSnapshot, private readonly returnToParent: (groupId: string) => void = () => undefined) {}
  async handle(message: CoordinationMessage): Promise<void> {
    if (message.action === "stop" && message.id && message.assignmentId) {
      try { await this.controller.stop(message.id, message.assignmentId); }
      catch { await vscode.window.showErrorMessage("Stop could not be recorded for this assignment. Inspect its latest observation; termination is unconfirmed."); }
      return;
    }
    if (this.dialogOpen) return;
    this.dialogOpen = true;
    try {
      if (message.action === "review-unknown" && message.id && message.assignmentId) {
        const worker = this.read().coordination.groups.find(group => group.groupId === message.id)?.assignments.find(worker => worker.assignmentId === message.assignmentId);
        if (!worker || worker.state.kind !== "terminal" || worker.state.outcome !== "unknown") return;
        if (await vscode.window.showWarningMessage("Review unconfirmed remote activity", { modal: true, detail: `${worker.state.observation}\nThis acknowledges your review before approving further spending. It does not confirm termination, restore a lost result, undo charges or retry this assignment.` }, "Acknowledge unknown completion and usage") === "Acknowledge unknown completion and usage") this.controller.reviewUnknown(message.id, message.assignmentId);
      } else if (message.action === "compare" && message.id) {
        const verdict = await vscode.window.showQuickPick(["agreement", "disagreement", "mixed"] satisfies ("agreement" | "disagreement" | "mixed")[], { title: "Compare the sourced findings (your assessment, not verification)" });
        if (verdict !== "agreement" && verdict !== "disagreement" && verdict !== "mixed") return;
        const explanation = await vscode.window.showInputBox({ title: "Explain which findings agree or disagree and why", prompt: "The comparison links all completed assignments and their original source references; it remains a proposal.", ignoreFocusOut: true });
        if (explanation?.trim()) this.controller.compare(message.id, verdict, explanation);
      } else if (message.action === "return" && message.id) {
        const idea = this.read().coordination.ideas.find(idea => idea.ideaId === message.id);
        if (!idea) return;
        this.controller.returnIdea(idea.ideaId);
        const parent = this.read().tasks.find(task => task.taskId === idea.parentTaskId);
        if (parent) this.returnToParent(parent.groupId);
        await vscode.window.showInformationMessage(`${parent ? "Return to" : "Parent unavailable; saved context for"} ${idea.parentObjective}: ${idea.returnPoint}. Findings remain separate proposals.`);
      } else if (message.action === "steer" && message.id && message.assignmentId) {
        const text = await vscode.window.showInputBox({ title: "Steer this queued assignment", prompt: "Saved locally; becomes part of the exact context reviewed for approval.", ignoreFocusOut: true });
        if (text?.trim()) this.controller.steer(message.id, message.assignmentId, message.requestId, text);
      } else if (message.action === "approve" && message.id) {
        const group = this.read().coordination.groups.find(group => group.groupId === message.id);
        if (!group) return;
        const detail = JSON.stringify({ parent: group.parentObjective, linkedIdea: group.ideaContext, preparedAtRevision: group.preparedAtRevision, assignments: group.assignments.map(worker => ({ ...worker, state: worker.state.kind })), sources: group.sources, durationMs: group.durationMs, softTokensPerWorker: group.maxTokens }, null, 2);
        if (await vscode.window.showWarningMessage(`Start ${String(group.assignments.length)} bounded read-only worker(s)?`, { modal: true, detail: `Shares the exact context below with Codex using each requested model and the standard per-turn tier override. Requires a Codex app-server profile supporting serviceTierForTurn; requested tier does not establish observed billing. One attempt per worker; hard local deadline. Tokens are a soft target. Actual quota, cost and charges unknown; local stop may leave remote usage unconfirmed. No paid fallback or included-only guarantee. Findings cannot change the parent plan.\n\n${detail}` }, "Approve unknown cost and shared context") !== "Approve unknown cost and shared context") return;
        void this.controller.approveAndRun(group.groupId, group.preparedAtRevision, randomUUID()).catch(async () => {
          await vscode.window.showErrorMessage("This batch could not start. Review current approval, sources, scheduling and unresolved activity before trying a fresh approval.");
        });
        return;
      } else if (message.action === "prepare" || message.action === "prepare-idea" || message.action === "capture") {
        const idea = message.action === "prepare-idea" ? this.read().coordination.ideas.find(idea => idea.ideaId === message.id) : undefined;
        if (message.action === "prepare-idea" && !idea) return;
        const task = idea ? this.read().tasks.find(task => task.taskId === idea.parentTaskId) : await vscode.window.showQuickPick(this.read().tasks.map(task => ({ label: task.title, taskId: task.taskId })), { title: "Choose the parent task", ignoreFocusOut: true });
        if (!task) return;
        const purpose = await vscode.window.showInputBox({ title: message.action === "capture" ? "Capture linked idea locally" : "Read-only purpose", ...(idea ? { value: idea.text } : {}), ignoreFocusOut: true });
        if (!purpose?.trim()) return;
        const scope = await vscode.window.showInputBox({ title: message.action === "capture" ? "Where to return in the parent task" : "Bounded scope for supplied project sources", ignoreFocusOut: true });
        if (!scope?.trim()) return;
        if (message.action === "capture") { this.controller.captureIdea({ requestId: message.requestId, parentTaskId: task.taskId, text: purpose, returnPoint: scope }); return; }
        const model = await vscode.window.showInputBox({ title: "Exact Codex model identifier", prompt: "No model lookup or inference. Review this identifier before approval.", ignoreFocusOut: true });
        if (!model?.trim()) return;
        const count = await vscode.window.showQuickPick(["1", "2", "3"], { title: "Read-only workers (one investigation, optional independent reviews)", ignoreFocusOut: true });
        if (!count) return;
        const fileSources = await selectSharedFiles(this.read());
        if (!fileSources) return;
        this.controller.prepare({ fileSources, ...(idea ? { ideaId: idea.ideaId } : {}), requestId: message.requestId, parentTaskId: task.taskId, purpose, scope, model, workers: Number(count), durationMs: 120_000, maxTokens: 4_000 });
      }
    } catch (error) {
      await vscode.window.showErrorMessage(`Assignment action was not completed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally { this.dialogOpen = false; }
  }
}
