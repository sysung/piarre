import * as vscode from "vscode";
import {
  ownsWriter,
  taskStatus,
  type ProjectSnapshot,
} from "../../../packages/core/src/index.js";
import type { WorkerCapabilities } from "../../../packages/core/src/worker.js";

export function renderWorkView(
  project: ProjectSnapshot,
  capabilities?: WorkerCapabilities,
): string {
  const escape = (value: string): string =>
    value.replace(/[&<>"']/g, (character) => {
      switch (character) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        default:
          return "&#39;";
      }
    });
  const list = (values: readonly string[], empty: string): string =>
    values.length === 0
      ? `<p>${escape(empty)}</p>`
      : `<ul>${values.map((value) => `<li>${escape(value)}</li>`).join("")}</ul>`;
  const proposals = project.proposals
    .map((proposal) => {
      const tasks = proposal.taskIds
        .map((taskId) => project.tasks.find((task) => task.taskId === taskId))
        .filter((task) => task !== undefined)
        .map((task) => {
          const status = taskStatus(project, task.taskId);
          const run = [...project.runs]
            .reverse()
            .find((candidate) => candidate.taskId === task.taskId);
          const taskApprovalId =
            task.state.kind === "approved" ? task.state.approvalId : undefined;
          const grant = taskApprovalId
            ? project.grants.find(
                ({ approvalId }) => approvalId === taskApprovalId,
              )
            : undefined;
          const statusKind = status
            ? status.kind.replaceAll("-", " ")
            : "unknown";
          const statusText = `${statusKind[0]?.toUpperCase() ?? ""}${statusKind.slice(1)}`;
          const authority = grant
            ? `<h5>Approved authority</h5><p>Writable root: ${escape(grant.writableRoot)}</p>${list(grant.commands.map(({ argv }) => argv.join(" ")), "No shell commands approved")}<p>${String(grant.budget.maxAttempts)} attempt · ${String(grant.budget.maxElapsedMinutes)} minutes · ${grant.budget.maxTokens.toLocaleString("en-US")} observed token budget</p>`
            : "";
          const runState = run
            ? `<p>Run ${escape(run.runId)} · ${escape(run.state)}</p>`
            : "";
          return `<article><h4>${escape(task.title)}</h4><p><strong>${escape(statusText)}</strong> · Plan version ${String(task.planVersion)}</p>${runState}${authority}<h5>Requirements</h5>${list(task.requirements.map(({ text }) => text), "No requirements")}<h5>Proposed scope</h5><p>Included</p>${list(task.proposedScope.included, "No paths proposed")}<p>Excluded</p>${list(task.proposedScope.excluded, "No exclusions proposed")}<h5>Dependencies</h5>${list(task.dependsOn, "No dependencies")}<h5>Manual checks</h5>${list(task.checks.map(({ description }) => description), "No checks")}<h5>Proposed budget</h5><p>${task.proposedBudget.maxTokens.toLocaleString("en-US")} tokens · ${String(task.proposedBudget.maxElapsedMinutes)} minutes · ${String(task.proposedBudget.maxAttempts)} attempt</p></article>`;
        })
        .join("");
      return `<section><h3>${escape(proposal.goal)}</h3><p>Deterministic initial draft. Refine scope before approval.</p>${tasks}</section>`;
    })
    .join("");
  const work = proposals || "<p>Your project is ready. No tasks yet.</p>";
  const activeWriter = project.runs.find(ownsWriter);
  const adapter = capabilities
    ? `Command mediation ${capabilities.commandMediation ? "observed" : "unavailable"}; writable scope ${capabilities.writableRoot}; steer ${capabilities.steer ? "supported" : "unsupported"}; interrupt ${capabilities.interrupt ? "supported" : "unsupported"}.`
    : "Worker capabilities have not been observed.";
  const startState = activeWriter
    ? `A second start is blocked by run ${activeWriter.runId} in state ${activeWriter.state}.`
    : "No run owns the repository writer.";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:var(--vscode-font-family);padding:24px;color:var(--vscode-foreground)}dt{margin-top:16px;color:var(--vscode-descriptionForeground)}dd{margin:4px 0;overflow-wrap:anywhere}section{margin-top:24px;border-top:1px solid var(--vscode-panel-border)}article{margin:16px 0;padding:16px;background:var(--vscode-editor-background)}</style></head><body><h1>Work</h1><h2>${escape(project.name)}</h2><p>${escape(adapter)}</p><p>${escape(startState)}</p>${work}<dl><dt>Repository</dt><dd>${escape(project.repositoryUri)}</dd><dt>Project ID</dt><dd>${escape(project.projectId)}</dd><dt>Revision</dt><dd>${String(project.revision)}</dd></dl><p>Use Piarre commands in the Command Palette to manage this project.</p></body></html>`;
}

export class WorkView {
  private panel: vscode.WebviewPanel | undefined;
  show(project: ProjectSnapshot, capabilities?: WorkerCapabilities): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "piarre.work",
        "Piarre Work",
        vscode.ViewColumn.One,
        { enableScripts: false, localResourceRoots: [] },
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }
    this.panel.webview.html = renderWorkView(project, capabilities);
    this.panel.reveal();
  }
  dispose(): void {
    this.panel?.dispose();
  }
}
