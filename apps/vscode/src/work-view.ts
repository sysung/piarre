import * as vscode from "vscode";
import { estimateBudget, type BudgetEstimate } from "../../../packages/core/src/costs.js";
import { inspectProject, type ProjectInspection, type ProviderConfiguration } from "../../../packages/core/src/inspection.js";
import type { ProjectSnapshot } from "../../../packages/core/src/index.js";

export function renderWorkView(
  project: ProjectSnapshot,
  configuration?: ProviderConfiguration,
): string {
  const inspection = inspectProject(project, configuration);
  const coding = inspection.providers.find((provider) => provider.role === "coding");
  const selection = coding && "selection" in coding ? coding.selection : undefined;
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
  const usd = (value: number): string => value > 0 && value < 0.0001
    ? "< $0.0001" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value);
  const percent = (value: number): string => value > 0 && value < 0.01 ? "<0.01%" : `${String(Number(value.toFixed(2)))}%`;
  const range = (minimum: number, maximum: number, format: (value: number) => string): string =>
    minimum === maximum ? format(minimum) : `${format(minimum)} to ${format(maximum)}`;
  const cost = (estimate: BudgetEstimate): string => {
    const assumptions = "Assumes the full token budget per attempt across all attempts. This is a planning scenario, not a forecast or hard cap. The provider and actual billing route are not connected or verified; no spending permission is granted.";
    if (estimate.kind === "unknown") return `<p>Estimated coding cost: Unknown. ${escape(estimate.reason)}</p>`;
    if (estimate.kind === "api") return `<p>API plan ${escape(estimate.plan)}: ${escape(range(estimate.minimumUsd, estimate.maximumUsd, usd))} at the full token budget.</p><details><summary>Estimate basis</summary><p>Configured, unverified input/output rates; token mix is unknown. Excludes cache discounts, tools, orchestration, audio, taxes, and other fees.</p><p>${escape(assumptions)}</p></details>`;
    const windows = estimate.windows.map((window) => `<li>${window.window === "five-hour" ? "Five-hour allowance" : "Weekly allowance"}: ${window.kind === "unknown" ? "Unknown; no matching calibration." : `${escape(range(window.minimumPercent, window.maximumPercent, percent))} estimated consumption.`}</li>`).join("");
    return `<p>Subscription estimate: ${escape(estimate.plan)}. Extra usage can incur charges.</p><ul>${windows}</ul><details><summary>Estimate basis</summary><p>Based on supplied same-model calibration, not verified account telemetry. Context and effort can change usage. These percentages estimate task consumption, not remaining allowance.</p><p>${escape(assumptions)}</p></details>`;
  };
  const proposals = project.proposals
    .map((proposal) => {
      const tasks = proposal.taskIds
        .map((taskId) => project.tasks.find((task) => task.taskId === taskId))
        .filter((task) => task !== undefined)
        .map(
          (task) => {
            const estimate = estimateBudget({ budget: task.proposedBudget, model: selection?.model ?? "", billing: selection?.billing ?? { kind: "unknown" } });
            return `<article><h4>${escape(task.title)}</h4><p><strong>Unapproved</strong> · Plan version ${String(task.planVersion)}</p><h5>Requirements</h5>${list(task.requirements.map(({ text }) => text), "No requirements")}<h5>Proposed scope</h5><p>Included</p>${list(task.proposedScope.included, "No paths proposed")}<p>Excluded</p>${list(task.proposedScope.excluded, "No exclusions proposed")}<h5>Dependencies</h5>${list(task.dependsOn, "No dependencies")}<h5>Manual checks</h5>${list(task.checks.map(({ description }) => description), "No checks")}<h5>Proposed budget</h5><p>${task.proposedBudget.maxTokens.toLocaleString("en-US")} tokens · ${String(task.proposedBudget.maxElapsedMinutes)} minutes · ${String(task.proposedBudget.maxAttempts)} attempt</p><h5>Plan-based estimate</h5>${cost(estimate)}</article>`;
          },
        )
        .join("");
      return `<section><h3>${escape(proposal.goal)}</h3><p>Deterministic initial draft. Refine scope before approval.</p>${tasks}</section>`;
    })
    .join("");
  const work = proposals || "<p>Your project is ready. No tasks yet.</p>";
  const basis = inspection.basis.length === 0
    ? "<p>No proposal sources recorded yet.</p>"
    : `<ul>${inspection.basis.map((entry) => `<li><strong>${entry.kind === "submitted-goal" ? "Submitted goal" : "Proposed task"}</strong>: ${escape(entry.text)}<br>Record ${escape(entry.reference.recordId)}, recorded at project revision ${String(entry.reference.revision)}. Source: deterministic draft. Unapproved, not independently verified.</li>`).join("")}</ul>`;
  const providers = `<ul>${inspection.providers.map((item) => `<li>${escape(item.role)}: ${item.status === "invalid-configuration" ? "Invalid configuration. No connection enabled." : "selection" in item ? `${escape(item.selection.provider)} / ${escape(item.selection.model)} requested, but unsupported and not connected.` : "Not configured."}</li>`).join("")}</ul>`;
  const policyLabels: Readonly<Record<ProjectInspection["policy"][keyof ProjectInspection["policy"]], string>> = {
    "automatic-capture-disabled-policy-unresolved": "Automatic memory capture is disabled until its policy is agreed.",
    "explicit-approval-required-not-implemented": "Changing confirmed memory requires approval; that operation is not implemented.",
    "per-operation-approval-required-not-implemented": "Paid operations require per-operation approval; no paid adapter is connected.",
    "local-only-no-external-adapter": "Project content stays local in this version. External disclosure is not enabled.",
    "unsupported": "Coding execution, verification and acceptance are not implemented.",
  };
  const policy = Object.values(inspection.policy).map((state) => `<li>${escape(policyLabels[state])}</li>`).join("");
  const permissions = `<details><summary>Basis and permissions</summary><h3>Recorded basis</h3>${basis}<h3>Current boundaries</h3><p>Only project renaming and unapproved proposals are supported. A proposed budget is not permission to spend.</p><ul>${policy}</ul><h3>Providers</h3>${providers}<p>Drafting uses the built-in deterministic generator, not a conversational model. Provider selection alone never connects a model or grants permission.</p></details>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:var(--vscode-font-family);padding:24px;color:var(--vscode-foreground)}dt{margin-top:16px;color:var(--vscode-descriptionForeground)}dd{margin:4px 0;overflow-wrap:anywhere}section{margin-top:24px;border-top:1px solid var(--vscode-panel-border)}article{margin:16px 0;padding:16px;background:var(--vscode-editor-background)}</style></head><body><h1>Work</h1><h2>${escape(project.name)}</h2>${work}${permissions}<dl><dt>Repository</dt><dd>${escape(project.repositoryUri)}</dd><dt>Project ID</dt><dd>${escape(project.projectId)}</dd><dt>Revision</dt><dd>${String(project.revision)}</dd></dl><p>Use Piarre commands in the Command Palette to manage this project.</p></body></html>`;
}

export class WorkView {
  private panel: vscode.WebviewPanel | undefined;
  show(project: ProjectSnapshot, configuration?: ProviderConfiguration): void {
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
    this.panel.webview.html = renderWorkView(project, configuration);
    this.panel.reveal();
  }
  dispose(): void {
    this.panel?.dispose();
  }
}
