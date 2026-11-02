import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { GoalInterpreter } from "./goal-interpreter.js";
import { WorkspaceDraft, type DraftOperations } from "./workspace-draft.js";
import { renderWorkspaceShell } from "./workspace-shell.js";
import { estimateBudget, type BudgetEstimate } from "../../../packages/core/src/costs.js";
import { inspectProject, parseProviderConfiguration, type ProjectInspection, type ProviderConfiguration } from "../../../packages/core/src/inspection.js";
import type { ProjectSnapshot } from "../../../packages/core/src/index.js";

export function renderInspection(
  project: ProjectSnapshot,
  configuration?: ProviderConfiguration,
  selectedGroupId?: string,
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
  const proposals = [...project.proposals].sort((a, b) => b.recordedAtRevision - a.recordedAtRevision)
    .filter(proposal => selectedGroupId === undefined || proposal.groupId === selectedGroupId)
    .map((proposal) => {
      if (selectedGroupId === undefined) return `<button class="goal-card" data-open-goal="${escape(proposal.groupId)}"><span class="goal-title">${escape(proposal.goal)}</span><span class="goal-meta">Unapproved · ${String(proposal.taskIds.length)} task(s) · Saved at revision ${String(proposal.recordedAtRevision)}</span><span class="goal-action">Open proposal →</span></button>`;
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
  if (selectedGroupId !== undefined) return `${proposals}<p>A proposed budget is not permission to spend. Connection unavailable: no provider is connected.</p>`;
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
  private detail: { readonly panel: vscode.WebviewPanel; readonly groupId: string; readonly html?: string } | undefined;
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
        if (this.current?.panel === panel) { this.current = undefined; this.closeDetail(); }
      });
      panel.webview.onDidReceiveMessage((message: unknown) => {
        if (this.current?.panel !== panel) return;
        if (typeof message === "object" && message !== null && "kind" in message && message.kind === "ready") {
          this.refresh();
          this.publishDraft();
          return;
        }
        if (typeof message === "object" && message !== null && "kind" in message && message.kind === "open-proposal") {
          if (Object.keys(message).length === 2 && "groupId" in message && typeof message.groupId === "string" && message.groupId.length <= 2048) this.openProposal(message.groupId);
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
    if (this.current.project.projectId !== project.projectId) this.closeDetail();
    this.current.draft.update(project);
    this.current = { ...this.current, project };
    this.refresh();
  }

  openProposal(groupId: string): void {
    if (!this.current?.project.proposals.some(proposal => proposal.groupId === groupId)) return;
    if (!this.detail) {
      const panel = this.createPanel("piarre.proposal", "Proposal details", vscode.ViewColumn.Beside,
        { enableScripts: true, localResourceRoots: [] });
      this.detail = { panel, groupId };
      panel.onDidDispose(() => { if (this.detail?.panel === panel) { this.detail = undefined; void this.current?.panel.webview.postMessage({ kind: "proposal-opened" }); } });
    } else this.detail = { ...this.detail, groupId };
    this.refreshDetail();
    this.detail.panel.reveal();
    void this.current.panel.webview.postMessage({ kind: "proposal-opened", groupId });
  }

  private refreshDetail(): void {
    if (!this.detail || !this.current) return;
    if (!this.current.project.proposals.some(proposal => proposal.groupId === this.detail?.groupId)) {
      this.closeDetail(); return;
    }
    const html = renderInspection(this.current.project, this.configuration(), this.detail.groupId);
    if (this.detail.html === html) return;
    this.detail = { ...this.detail, html };
    const nonce = randomUUID();
    const groupKey = JSON.stringify(this.detail.groupId).replaceAll("<", "\\u003c");
    this.detail.panel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:var(--vscode-font-family);line-height:1.6;padding:24px;color:var(--vscode-foreground);background:var(--vscode-editor-background);overflow-wrap:anywhere}section{max-width:760px;margin:auto;animation:arrive 140ms ease-out}details{margin:16px 0;border:1px solid var(--vscode-panel-border);padding:16px}summary{cursor:pointer;min-height:32px}:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:3px}@keyframes arrive{from{opacity:.7}to{opacity:1}}@media(prefers-reduced-motion:reduce){section{animation:none}}</style></head><body><h1>Proposal details</h1><p>Read only · Not approved to run</p>${html}<script nonce="${nonce}">
const api = acquireVsCodeApi();
const groupId = ${groupKey};
const disclosures = [...document.querySelectorAll('details')];
const state = api.getState();
if (state && state.groupId === groupId) {
  disclosures.forEach((item, index) => { item.open = state.open.includes(index); });
  requestAnimationFrame(() => { window.scrollTo(0, state.scroll); if (state.focus >= 0) disclosures[state.focus]?.querySelector('summary')?.focus({preventScroll:true}); });
}
function remember() { api.setState({groupId, open: disclosures.flatMap((item,index) => item.open ? [index] : []), scroll: window.scrollY, focus: disclosures.findIndex(item => item.querySelector('summary') === document.activeElement)}); }
disclosures.forEach(item => item.addEventListener('toggle', remember));
window.addEventListener('scroll', remember, {passive:true});
document.addEventListener('focusin', remember);
</script></body></html>`;
  }

  private closeDetail(): void {
    const detail = this.detail; this.detail = undefined; detail?.panel.dispose();
    if (detail) void this.current?.panel.webview.postMessage({ kind: "proposal-opened" });
  }

  private configuration(): ProviderConfiguration {
    return parseProviderConfiguration(vscode.workspace.getConfiguration("piarre").get<unknown>("providers", []));
  }

  private refresh(): void {
    if (!this.current) return;
    this.refreshDetail();
    void this.current.panel.webview.postMessage({ kind: "inspection", selectedGroupId: this.detail?.groupId, html: renderInspection(this.current.project, this.configuration()) });
  }

  private publishDraft(): void {
    if (this.current) void this.current.panel.webview.postMessage({ kind: "draft", state: this.current.draft.state });
  }

  close(): void {
    this.closeDetail();
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
