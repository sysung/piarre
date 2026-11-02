import * as vscode from "vscode";
import { GoalInterpreter } from "./goal-interpreter.js";
import { WorkspaceDraft, type DraftOperations } from "./workspace-draft.js";
import { renderWorkspaceShell } from "./workspace-shell.js";
import { estimateBudget, type BudgetEstimate } from "../../../packages/core/src/costs.js";
import { inspectProject, parseProviderConfiguration, type ProjectInspection, type ProviderConfiguration } from "../../../packages/core/src/inspection.js";
import type { ProjectSnapshot } from "../../../packages/core/src/index.js";

function renderInspection(
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
    const assumptions = "Uses the full token budget for every attempt, including retries. Actual usage and charges may differ. No provider is connected, and its billing method has not been checked.";
    if (estimate.kind === "unknown") return `<p>Estimated coding cost: Unknown. ${escape(estimate.reason)}</p>`;
    if (estimate.kind === "api") return `<p>API plan ${escape(estimate.plan)}: ${escape(range(estimate.minimumUsd, estimate.maximumUsd, usd))} at the full token budget.</p><details><summary>Estimate basis</summary><p>Uses configured input/output prices that have not been verified. The token split is unknown. Discounts, tools, other agents, audio, taxes, and other fees are excluded.</p><p>${escape(assumptions)}</p></details>`;
    const windows = estimate.windows.map((window) => `<li>${window.window === "five-hour" ? "Five-hour allowance" : "Weekly allowance"}: ${window.kind === "unknown" ? "Unknown. No matching usage samples." : `${escape(range(window.minimumPercent, window.maximumPercent, percent))} estimated consumption.`}</li>`).join("");
    return `<p>Subscription estimate: ${escape(estimate.plan)}. Extra usage can incur charges.</p><ul>${windows}</ul><details><summary>Estimate basis</summary><p>Uses supplied samples for the same provider, plan, and model. Account usage has not been checked. Context and effort can change the estimate. Percentages describe task usage, not your remaining allowance.</p><p>${escape(assumptions)}</p></details>`;
  };
  const proposals = project.proposals
    .map((proposal) => {
      const tasks = proposal.taskIds
        .map((taskId) => project.tasks.find((task) => task.taskId === taskId))
        .filter((task) => task !== undefined)
        .map(
          (task) => {
            const estimate = estimateBudget({ budget: task.proposedBudget, model: selection?.model ?? "", provider: selection?.provider ?? "", billing: selection?.billing ?? { kind: "unknown" } });
            return `<details><summary>${escape(task.title)} · Unapproved</summary><article><p><strong>Unapproved</strong> · Plan version ${String(task.planVersion)}</p><h4>Requirements</h4>${list(task.requirements.map(({ text }) => text), "No requirements")}<h4>Proposed scope</h4><p>Included</p>${list(task.proposedScope.included, "No paths proposed")}<p>Excluded</p>${list(task.proposedScope.excluded, "No exclusions proposed")}<h4>Dependencies</h4>${list(task.dependsOn, "No dependencies")}<h4>Manual checks</h4>${list(task.checks.map(({ description }) => description), "No checks")}<h4>Proposed budget</h4><p>${task.proposedBudget.maxTokens.toLocaleString("en-US")} tokens · ${String(task.proposedBudget.maxElapsedMinutes)} minutes · ${String(task.proposedBudget.maxAttempts)} attempt</p><h4>Plan-based estimate</h4>${cost(estimate)}</article></details>`;
          },
        )
        .join("");
      return `<section><h3>${escape(proposal.goal)}</h3><p>Built-in draft. Review its scope before approval.</p>${tasks}</section>`;
    })
    .join("");
  const work = proposals || "<p>No task proposals yet.</p>";
  const basis = inspection.basis.length === 0
    ? "<p>No proposal sources recorded yet.</p>"
    : `<ul>${inspection.basis.map((entry) => `<li><strong>${entry.kind === "submitted-goal" ? "Submitted goal" : "Proposed task"}</strong>: ${escape(entry.text)}<br>Record ${escape(entry.reference.recordId)}, recorded at project revision ${String(entry.reference.revision)}. Source: deterministic draft. Unapproved, not independently verified.</li>`).join("")}</ul>`;
  const providers = `<ul>${inspection.providers.map((item) => `<li>${escape(item.role)}: ${item.status === "invalid-configuration" ? "Invalid settings. No provider connected." : "selection" in item ? `${escape(item.selection.provider)} / ${escape(item.selection.model)} selected. Connection unavailable.` : "Not configured."}</li>`).join("")}</ul>`;
  const policyLabels: Readonly<Record<ProjectInspection["policy"][keyof ProjectInspection["policy"]], string>> = {
    "automatic-capture-disabled-policy-unresolved": "Automatic memory capture is off until its approval policy is agreed.",
    "explicit-approval-required-not-implemented": "Confirmed memory changes need approval and are not available yet.",
    "per-operation-approval-required-not-implemented": "Paid work needs approval for each operation. No paid provider is connected.",
    "local-only-no-external-adapter": "Piarre keeps project content local. External sharing is off.",
    "unsupported": "Running, verifying, and accepting coding work are not available yet.",
  };
  const policy = Object.values(inspection.policy).map((state) => `<li>${escape(policyLabels[state])}</li>`).join("");
  const permissions = `<details><summary>Basis and permissions</summary><h3>Recorded basis</h3>${basis}<h3>What works now</h3><p>You can rename this project and save task proposals. A proposed budget is not permission to spend.</p><ul>${policy}</ul><h3>Providers</h3>${providers}<p>Drafting uses the built-in deterministic generator, not a conversational model. Selecting a provider does not connect it or approve spending.</p></details>`;

  return `<h2>${escape(project.name)}</h2>${work}${permissions}<details><summary>Project information</summary><dl><dt>Repository</dt><dd>${escape(project.repositoryUri)}</dd><dt>Project ID</dt><dd>${escape(project.projectId)}</dd><dt>Revision</dt><dd>${String(project.revision)}</dd></dl></details>`;
}

export function renderWorkView(project: ProjectSnapshot, configuration?: ProviderConfiguration): string {
  return renderWorkspaceShell(renderInspection(project, configuration));
}

export class WorkView {
  private current: { readonly panel: vscode.WebviewPanel; readonly project: ProjectSnapshot; readonly draft: WorkspaceDraft } | undefined;
  private readonly settingsChanged: vscode.Disposable;

  constructor(private readonly createPanel: typeof vscode.window.createWebviewPanel = vscode.window.createWebviewPanel,
    private readonly operations: DraftOperations = {
      prepare: (goal) => new GoalInterpreter().propose(goal),
      save: () => undefined,
    }) {
    this.settingsChanged = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("piarre.providers")) this.refresh();
    });
  }

  show(project: ProjectSnapshot): void {
    if (!this.current) {
      const panel = this.createPanel("piarre.work", "Piarre Work", vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] });
      const draft = new WorkspaceDraft(project, this.operations, () => {
        if (this.current?.panel === panel) this.publishDraft();
      });
      this.current = { panel, project, draft };
      panel.onDidDispose(() => {
        draft.dispose();
        if (this.current?.panel === panel) this.current = undefined;
      });
      panel.webview.onDidReceiveMessage((message: unknown) => {
        if (this.current?.panel !== panel) return;
        if (typeof message === "object" && message !== null && "kind" in message && message.kind === "ready") {
          this.refresh();
          this.publishDraft();
          return;
        }
        void draft.receive(message);
      });
      panel.webview.html = renderWorkView(project, this.configuration());
    } else {
      this.update(project);
    }
    this.current.panel.reveal();
  }

  update(project: ProjectSnapshot): void {
    if (!this.current) return;
    this.current.draft.update(project);
    this.current = { ...this.current, project };
    this.refresh();
  }

  private configuration(): ProviderConfiguration {
    return parseProviderConfiguration(vscode.workspace.getConfiguration("piarre").get<unknown>("providers", []));
  }

  private refresh(): void {
    if (!this.current) return;
    void this.current.panel.webview.postMessage({ kind: "inspection", html: renderInspection(this.current.project, this.configuration()) });
  }

  private publishDraft(): void {
    if (this.current) void this.current.panel.webview.postMessage({ kind: "draft", state: this.current.draft.state });
  }

  close(): void {
    const current = this.current;
    this.current = undefined;
    current?.draft.dispose();
    current?.panel.dispose();
  }

  dispose(): void {
    this.settingsChanged.dispose();
    this.close();
  }
}
