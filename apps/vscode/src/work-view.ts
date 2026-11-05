import { renderKnowledgeRelationships } from "./knowledge-relationship-view.js";
import type { KnowledgeOperation } from "./knowledge-controller.js";
import { renderActivity, type ActivityQuery, type ActivityPage } from "./observed-activity.js";
import { resumeProject, knowledgeWorkImpact, type VisitBaseline, type ResumptionFact } from "../../../packages/core/src/resumption.js";
import { renderCoordination } from "./coordination-view.js";
import { parseCoordinationMessage, type CoordinationMessage } from "./coordination-actions.js";
import { parseExecutionMessage, type ExecutionMessage } from "./execution-actions.js";
import { renderExecutionControls, renderExecutionDesk, renderExecutionResult, taskExecutionStatus } from "./execution-view.js";
import type { RetrievalResult } from "./project-retrieval.js";
import { type ConversationState } from "./conversation-controller.js";
import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { GoalInterpreter } from "./goal-interpreter.js";
import { WorkspaceDraft, type DraftOperations } from "./workspace-draft.js";
import { renderWorkspaceShell } from "./workspace-shell.js";
import { conversationContextCatalog } from "./conversation-context.js";
import { estimateBudget, type BudgetEstimate } from "../../../packages/core/src/costs.js";
import { inspectProject, resolveRecordReference, parseProviderConfiguration, type ProjectInspection, type ProviderConfiguration } from "../../../packages/core/src/inspection.js";
import { currentKnowledge, knowledgeConflicts } from "../../../packages/core/src/knowledge.js";
import { conversationHistory, defaultSessionId, type ProjectSnapshot } from "../../../packages/core/src/index.js";

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

export function renderInspection(
  project: ProjectSnapshot,
  configuration?: ProviderConfiguration,
  selectedGroupId?: string,
  executionEnabled = false,
  includeKnowledge = true,
): string {
  const inspection = inspectProject(project, configuration);
  const coding = inspection.providers.find((provider) => provider.role === "coding");
  const selection = coding && "selection" in coding ? coding.selection : undefined;
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
    if (estimate.kind === "api") return `<p>API plan ${escape(estimate.plan)}: ${escape(range(estimate.minimumUsd, estimate.maximumUsd, usd))} at the full token budget.</p><details><summary>Estimate details</summary><p>Uses configured input/output prices that have not been verified. The token split is unknown. Discounts, tools, other agents, audio, taxes, and other fees are excluded.</p><p>${escape(assumptions)}</p></details>`;
    const windows = estimate.windows.map((window) => `<li>${window.window === "five-hour" ? "Five-hour allowance" : "Weekly allowance"}: ${window.kind === "unknown" ? "Unknown. No matching usage samples." : `${escape(range(window.minimumPercent, window.maximumPercent, percent))} estimated consumption.`}</li>`).join("");
    return `<p>Subscription estimate: ${escape(estimate.plan)}. Extra usage can incur charges.</p><ul>${windows}</ul><details><summary>Estimate details</summary><p>Uses supplied samples for the same provider, plan, and model. Account usage has not been checked. Context and effort can change the estimate. Percentages describe task usage, not your remaining allowance.</p><p>${escape(assumptions)}</p></details>`;
  };
  const proposals = [...project.proposals].sort((a, b) => b.recordedAtRevision - a.recordedAtRevision)
    .filter(proposal => selectedGroupId === undefined || proposal.groupId === selectedGroupId)
    .map((proposal) => {
      if (selectedGroupId === undefined) return `<div class="goal-container"><button class="goal-card" data-open-goal="${escape(proposal.groupId)}"><span class="goal-title">${escape(proposal.goal)}</span><span class="goal-meta">Unapproved · ${String(proposal.taskIds.length)} task(s) · Saved at revision ${String(proposal.recordedAtRevision)}</span><span class="goal-action">Open proposal →</span></button><button class="delete-goal secondary" data-delete-goal="${escape(proposal.groupId)}" aria-label="Delete goal: ${escape(proposal.goal)}" title="Delete goal"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg></button></div>`;
      const tasks = proposal.taskIds
        .map((taskId) => project.tasks.find((task) => task.taskId === taskId))
        .filter((task) => task !== undefined)
        .map(
          (task) => {
            const estimate = estimateBudget({ budget: task.proposedBudget, model: selection?.model ?? "", provider: selection?.provider ?? "", billing: selection?.billing ?? { kind: "unknown" } });
            return `<details><summary>${escape(task.title)} · ${executionEnabled ? escape(taskExecutionStatus(project, task.taskId)) : "Unapproved"}</summary><article>${executionEnabled ? `<button type="button" data-execution-action="prepare" data-execution-id="${escape(task.taskId)}">Review run plan</button>` : ""}<p><strong>Original proposal · Unapproved</strong> · Plan version ${String(task.planVersion)}</p><h4>Requirements</h4>${list(task.requirements.map(({ text }) => text), "No requirements")}<h4>Proposed scope</h4><p>Included</p>${list(task.proposedScope.included, "No paths proposed")}<p>Excluded</p>${list(task.proposedScope.excluded, "No exclusions proposed")}<h4>Dependencies</h4>${list(task.dependsOn, "No dependencies")}<h4>Manual checks</h4>${list(task.checks.map(({ description }) => description), "No checks")}<h4>Proposed budget</h4><dl class="budget-grid"><div><dt>Token limit</dt><dd>${task.proposedBudget.maxTokens.toLocaleString("en-US")} tokens</dd></div><div><dt>Time limit</dt><dd>${String(task.proposedBudget.maxElapsedMinutes)} minutes</dd></div><div><dt>Attempts</dt><dd>${String(task.proposedBudget.maxAttempts)} attempt</dd></div></dl><h4>Plan-based estimate</h4>${cost(estimate)}</article></details>`;
          },
        )
        .join("");
      return `<section><h3>${escape(proposal.goal)}</h3><p>Built-in draft. Review its scope before approval.</p>${tasks}</section>`;
    })
    .join("");
  if (selectedGroupId !== undefined) return `${proposals}<p>A proposed budget is not permission to spend. Connection unavailable: no provider is connected.</p>`;
  const work = proposals || "<p>Save a proposal to keep a goal with this project.</p>";
  const recommendation = inspection.recommendation.length === 0
    ? "<p>No proposal sources recorded yet.</p>"
    : `<ul>${inspection.recommendation.map((entry) => `<li><strong>${entry.kind === "submitted-goal" ? "Submitted goal" : entry.kind === "knowledge" ? "User knowledge" : "Proposed task"}</strong>: ${escape(entry.text)}<br>Record ${escape(entry.reference.recordId)}, recorded at project revision ${String(entry.reference.revision)}. Source: ${escape(entry.source)}. Source content is not independently verified.</li>`).join("")}</ul>`;
  const providers = `<ul>${inspection.providers.filter(item => item.role !== "speech-input" && item.role !== "speech-output").map((item) => `<li>${escape(item.role)}: ${item.status === "invalid-configuration" ? "Invalid settings. No provider connected." : "selection" in item ? `${escape(item.selection.provider)} / ${escape(item.selection.model)} selected. ${executionEnabled ? "Connection is checked when explicitly requested; selection does not approve a run." : "Connection unavailable."}` : "Not configured."}</li>`).join("")}</ul>`;
  const policyLabels: Readonly<Record<ProjectInspection["policy"][keyof ProjectInspection["policy"]], string>> = {
    "manual-observations-only": "Automatic memory capture is off. Explicit observations stay unconfirmed until reviewed.",
    "explicit-memory-review-required": "Confirming or replacing knowledge requires an explicit review of the exact record and revision.",
    "per-operation-approval-required-not-implemented": executionEnabled ? "Each coding run requires approval. Actual charges and quotas remain unknown unless the adapter supplies observations." : "Paid work needs approval for each operation. No paid coding provider is connected.",
    "explicit-conversation-disclosure": "Local planning stays local. Explicit Send to Codex shares the displayed conversation context with your configured account.",
    "unsupported": executionEnabled ? "Coding work requires a reviewed scope and observed adapter capabilities. Check completion and human acceptance are separate." : "Running, verifying, and accepting coding work are not available yet.",
  };
  const policy = Object.values(inspection.policy).map((state) => `<li>${escape(policyLabels[state])}</li>`).join("");
  const permissions = `<details><summary>Recommendation and permissions</summary><h3>Recorded recommendation</h3>${recommendation}<h3>What works now</h3><p>${executionEnabled ? "Review task scope, start approved agent work, inspect current evidence, and control recovery from the work overview." : "You can rename this project and save task proposals."} A proposed budget is not permission to spend.</p><ul>${policy}</ul><h3>Providers</h3>${providers}<p>Local task drafting uses the built-in deterministic generator. Connect Codex and Send are separate explicit conversation actions. Provider selections do not approve coding work.</p></details>`;

  return `${work}${includeKnowledge ? renderKnowledge(project) : ""}${permissions}<details><summary>Project information</summary><dl><dt>Repository</dt><dd>${escape(project.repositoryUri)}</dd><dt>Project ID</dt><dd>${escape(project.projectId)}</dd><dt>Revision</dt><dd>${String(project.revision)}</dd></dl></details>`;
}

export function renderLookup(result: RetrievalResult): string {
  const reason = result.kind === "error" || result.kind === "stale" ? result.reason : result.kind === "no-match" ? "No matching source in the bounded index. This does not establish that the answer is absent." : "Source excerpts at lookup time. Content hashes identify the inspected version; recheck after editing before consequential claims.";
  return `<section aria-label="Project lookup"><h2>Project lookup · ${escape(result.kind)}</h2><p>Code questions route to current file excerpts or the active symbol’s compiler references. Business rationale comes from recorded business/decision statements; no rationale is invented from code. Infrastructure files describe declarations, not deployed state. Module references describe static relationships. Missing explicit links and partial language coverage remain gaps.</p><p>${escape(reason)}</p><p>${escape(result.coverage.limitation)}</p><p>Coverage: ${String(result.coverage.files)} files and ${String(result.coverage.records)} knowledge records.</p>${result.coverage.issues.length ? `<details open><summary>Incomplete coverage and excluded sources</summary><ul>${result.coverage.issues.map(issue => `<li>${escape(issue)}</li>`).join("")}</ul></details>` : ""}${result.hits.map(hit => `<article><h3>${hit.source.kind === "file" ? `${escape(hit.source.path)} · lines ${String(hit.source.startLine)}–${String(hit.source.endLine)}` : `${escape(hit.source.recordId)} · revision ${String(hit.source.revision)} · ${escape(hit.source.standing)}`}</h3><p>${escape(hit.method)} · SHA-256 ${escape(hit.contentHash)}</p><pre>${escape(hit.text)}</pre><p>${hit.source.kind === "file" ? "Static source only. Code does not establish business rationale, runtime behavior or deployed state." : "Explicit recorded statement. Review disputes in Knowledge and decisions; confirmation is not independent verification."}</p></article>`).join("")}</section>`;
}

export function renderKnowledge(project: ProjectSnapshot, glossary = false): string {
  const entries = currentKnowledge(project);
  const recordsByEntry = entries.map(entry => {
    const conflicts = knowledgeConflicts(project, entry);
    const state = conflicts.length ? "Disputed · different confirmed text for this topic" : entry.standing.kind;
    const action = entry.standing.kind === "confirmed" ? "correct-knowledge" : "confirm-knowledge";
    const history = project.knowledge.filter(item => item.knowledgeId === entry.knowledgeId);
    return `<article><h3>${escape(entry.topic)}</h3><p>${escape(entry.category)} · ${escape(state)} · revision ${String(entry.recordedAtRevision)}</p><pre>${escape(entry.content.text)}</pre><p>Source: explicit user statement. Confirmation records your approval of this knowledge; it is not independent verification.</p><button type="button" data-knowledge-action="${action}" data-knowledge-id="${escape(entry.knowledgeId)}">${entry.standing.kind === "confirmed" ? "Review correction" : "Review confirmation"}</button><details><summary>Sources, linked work and version history</summary><p>Linked tasks: ${escape(entry.affectedTaskIds.join(", ") || "None recorded")}. Missing links cannot establish complete impact.</p>${history.map(item => `<p>Revision ${String(item.recordedAtRevision)} · ${escape(item.standing.kind)}${item.supersedes === null ? "" : ` · supersedes ${String(item.supersedes)}`}</p><pre>${escape(item.content.text)}</pre><p>${item.content.sources.map(source => source.kind === "submitted-statement" ? `Original statement ${escape(source.submitted.requestId)} at context revision ${String(source.submitted.contextRevision)}` : `Record ${escape(source.reference.recordId)} at revision ${String(source.reference.revision)}`).join("<br>")}</p>`).join("")}</details></article>`;
  });
  const impacts = project.knowledgeImpacts.filter(impact => project.tasks.some(task => task.taskId === impact.taskId));
  const relationshipsByEntry = entries.map(entry => `<details><summary>${escape(entry.topic)}: supporting records, relationships and correction impact</summary><p>Source: explicit user knowledge/task links and exact execution-plan knowledge revisions. Missing edges do not establish complete impact. No model-inferred relationships are confirmed.</p><p>Current record ${escape(entry.knowledgeId)} · revision ${String(entry.recordedAtRevision)} · ${escape(entry.standing.kind)}.</p>${project.knowledge.filter(item => item.knowledgeId === entry.knowledgeId).map(item => `<details><summary>Original record revision ${String(item.recordedAtRevision)}${item.supersedes === null ? "" : ` supersedes ${String(item.supersedes)}`}</summary><pre>${escape(JSON.stringify(item, null, 2))}</pre></details>`).join("")}<p>Explicit task links: ${entry.affectedTaskIds.map(escape).join(", ") || "None recorded"}.</p>${entry.affectedTaskIds.map(id => project.tasks.find(task => task.taskId === id)).filter(task => task !== undefined).map(task => `<p>Recorded knowledge → task ${escape(task.taskId)} → proposed module/infrastructure scope: ${escape(task.proposedScope.included.join(", "))}. Requirements: ${escape(task.requirements.map(item => item.text).join("; "))}. These are explicit proposal relationships, not verified implementation, inferred symbol links or deployed observations.</p>`).join("")}<p>Recorded alternatives and assumptions: inspect original decision wording. No structured alternatives are recorded by this projection; unconfirmed and inferred statements retain their standing. Missing source-to-symbol or deployment evidence cannot establish completeness.</p>${knowledgeWorkImpact(project, entry.knowledgeId).map(impact => `<details><summary>Plan ${escape(impact.plan.planId)} · revision ${String(impact.plan.recordedAtRevision)} · ${impact.freshness}</summary><p>Proposed objective: ${escape(impact.plan.objective)}. Planned files are declarations, not observed changes. Criteria are requirements, not proof of execution.</p><pre>${escape(JSON.stringify(impact.plan, null, 2))}</pre>${impact.runs.map(run => `<details><summary>Approval ${escape(run.grant.approvalId)} → run ${escape(run.runId)} · ${run.state.kind} · review ${run.reviewFreshness.kind}</summary><p>Process ${run.process.kind}; workspace ${run.workspace.kind}. Correction cannot release the writer or establish reconciliation. Result/evidence remains historical when its plan is stale.</p><pre>${escape(JSON.stringify(run, null, 2))}</pre></details>`).join("") || "<p>No run approval or result linked to this plan.</p>"}</details>`).join("") || "<p>No execution-plan relationships recorded.</p>"}</details>`);
  const content = glossary ? (["business", "decision"] as const).map(category => {
    const items = entries.flatMap((entry, index) => entry.category === category ? [
      `<details><summary>${escape(entry.topic)} · ${escape(entry.standing.kind)}</summary>${recordsByEntry[index] ?? ""}${relationshipsByEntry[index] ?? ""}</details>`,
    ] : []);
    return `<details><summary>${category === "business" ? "Business rules" : "Technical decisions"} · ${String(items.length)}</summary>${items.join("") || "<p>No entries recorded.</p>"}</details>`;
  }).join("") : relationshipsByEntry.join("") + (recordsByEntry.join("") || "<p>No knowledge recorded. Absence is not a retrieval failure.</p>");
  return `<section id="project-knowledge" aria-label="Project knowledge"><h2>Knowledge and decisions</h2><button type="button" data-knowledge-action="lookup-project">Look up project sources</button><p>Automatic capture is off. Add observations explicitly; confirmation and replacement require review. Different confirmed text under the same topic is flagged; this is not general semantic contradiction detection.</p><button type="button" data-knowledge-action="observe-business">Record business knowledge</button><button type="button" data-knowledge-action="observe-decision">Record technical decision</button>${content}${impacts.length ? `<h3>Changed knowledge needs plan review</h3><ul>${impacts.map(impact => `<li>${escape(project.tasks.find(task => task.taskId === impact.taskId)?.title ?? impact.taskId)}: stale after knowledge ${escape(impact.knowledgeId)} changed from revision ${String(impact.fromRevision)} to ${String(impact.toRevision)}. Earlier evidence cannot demonstrate the corrected rule.</li>`).join("")}</ul>` : ""}</section>`;
}

export function renderConversation(project: ProjectSnapshot, sessionId?: string): string {
  return (sessionId ? conversationHistory(project, sessionId) : project.conversation).map(turn => {
    const unavailable = turn.sources.filter(source => source.reference.kind !== "file" && resolveRecordReference(project, source.reference).kind !== "resolved");
    const disputed = turn.sources.some(source => source.reference.kind === "knowledge" && currentKnowledge(project).some(entry => entry.knowledgeId === source.reference.recordId && knowledgeConflicts(project, entry).length > 0));
    const capturedFiles = turn.sources.some(source => source.reference.kind === "file") ? "<p>Captured file evidence: exact historical bytes below. Current file, permission and collection freshness has not been revalidated for this display. Prepare fresh context before consequential reuse.</p>" : "";
    const freshness = unavailable.length ? "<p><strong>Historical context:</strong> a captured source has changed or is unavailable. This reply does not demonstrate the corrected or current rule. Review current knowledge before acting.</p>" : disputed ? "<p><strong>Disputed context:</strong> captured knowledge has different confirmed values. Resolve the dispute before relying on this reply.</p>" : "";
    const reply = turn.kind === "answered" ? `<p><strong>Codex · Inferred</strong></p>${capturedFiles}${freshness}<pre>${escape(turn.text)}</pre><details><summary>Recommendation context and citations</summary><p>Your original statement is preserved above. A source reference does not independently verify the reply.</p>${turn.sources.map(source => `<p>${turn.citations.some(reference => reference.kind === source.reference.kind && reference.recordId === source.reference.recordId && reference.revision === source.reference.revision) ? "Cited" : "Available context"}: ${escape(source.reference.kind)} ${escape(source.reference.recordId)} · revision ${String(source.reference.revision)}${source.reference.kind === "file" ? ` · captured ${source.reference.representation.kind === "git-diff" ? `diff against ${escape(source.reference.representation.baseCommit)}` : "file"} lines ${String(source.reference.startLine)}–${String(source.reference.endLine)} · SHA-256 ${escape(source.reference.contentHash)} · historical bytes; current freshness requires revalidation` : ""}</p><pre>${escape(source.text)}</pre><details><summary>Exact citation provenance</summary><pre>${escape(JSON.stringify(source.reference, null, 2))}</pre></details>`).join("")}</details>`
      : `<p>${turn.kind === "pending" ? "Waiting for a terminal reply…" : escape(turn.kind + ": " + turn.reason)}</p>`;
    return `<article class="turn"><div class="user-message"><p><strong>You</strong> · revision ${String(turn.submitted.contextRevision)}</p><pre>${escape(turn.submitted.originalStatement)}</pre></div><div class="assistant-message">${reply}</div></article>`;
  }).join("");
}

function renderFactSource(project: ProjectSnapshot, fact: ResumptionFact, baseline: VisitBaseline): string {
  const source = fact.source;
  const record = source.kind === "knowledge" ? project.knowledge.find(entry => entry.knowledgeId === source.recordId && entry.recordedAtRevision === source.revision)
    : source.kind === "proposal" ? (project.proposals.find(entry => entry.groupId === source.recordId) ?? (baseline.kind === "previous-visit" ? baseline.snapshot.proposals.find(entry => entry.groupId === source.recordId) : undefined))
    : source.kind === "plan" ? project.executionPlans.find(entry => entry.planId === source.recordId)
    : source.kind === "run" ? project.executionRuns.find(entry => entry.runId === source.recordId)
    : source.kind === "conversation" ? project.conversation.find(entry => entry.submitted.requestId === source.recordId) : { projectId: project.projectId, revision: project.revision, name: project.name, schedulingPaused: project.schedulingPaused };
  return `<details><summary>${escape(source.kind)} ${escape(source.recordId)} · revision ${String(source.revision)}</summary><p>Extraction: canonical record projection. Recorded statements and proposals retain their authority; a source link does not independently verify them.</p>${record ? `<pre>${escape(JSON.stringify(record, null, 2))}</pre>` : "<p>Historical source removed from the current collection. Consult project history at the referenced revision; current source is unavailable.</p>"}</details>`;
}

export function renderSessionBrief(project: ProjectSnapshot, baseline: VisitBaseline = { kind: "first-visit" }): string {
  const resumption = resumeProject(project, baseline);
  const section = (category: ResumptionFact["category"], title: string, empty: string): string => {
    const facts = resumption.facts.filter(fact => fact.category === category);
    return `<div><dt>${title}</dt><dd>${facts.length ? `<ul>${facts.map(fact => `<li>${escape(fact.text)}${renderFactSource(project, fact, baseline)}</li>`).join("")}</ul>` : empty}</dd></div>`;
  };
  return `<div class="workspace-identity"><strong>Piarre</strong><span class="project-name">${escape(project.name)}</span><span class="capability">Recorded work and evidence</span></div><p class="eyebrow">Project brief</p><h1>Pick up your work</h1>${project.reflections.some(item => item.status === "pending") ? "<p>Optional reflection is pending. Use Piarre: Review Reflection from the Command Palette to inspect or decline it. This does not pause agents or approve work.</p>" : ""}<dl class="session-summary">${section("accomplishment", "Accomplishments", "No accepted result recorded. Saved goals remain proposals.")}${section("next", "Next step", "No next action established by recorded plans.")}${section("open", "Still open", "No unresolved decision recorded. Missing records do not prove completion.")}${section("change", "Changes since your prior visit", resumption.baseline === "previous-visit" ? "No change in the covered records." : "Prior-visit delta unavailable.")}</dl><details><summary>Resumption coverage and assumptions</summary><p>No inferred assumptions or alternatives are supplied by this deterministic brief. Review proposed task scope and original knowledge statements in Recommendation.</p><ul>${resumption.gaps.map(gap => `<li>${escape(gap)}</li>`).join("")}</ul></details>`;
}

export function renderWorkView(project: ProjectSnapshot, configuration?: ProviderConfiguration, executionEnabled = false, baseline: VisitBaseline = { kind: "first-visit" }): string {
  return renderWorkspaceShell({ projectId: project.projectId, inspection: renderInspection(project, configuration, undefined, executionEnabled, false), brief: renderSessionBrief(project, baseline), agentOverview: executionEnabled ? renderCoordination(project) + renderExecutionDesk(project) : "<p>No coding agents are running. Save a task proposal to prepare work for an agent.</p>", executionControls: executionEnabled ? renderExecutionControls(project) : "" });
}

export class WorkView implements vscode.WebviewViewProvider {
  private visit: { readonly projectId: string; readonly baseline: VisitBaseline; readonly observed: (revision: number) => void } | undefined;

  setVisit(projectId: string, baseline: VisitBaseline, observed: (revision: number) => void): void {
    this.visit = { projectId, baseline, observed };
  }

  private visitBaseline(project: ProjectSnapshot): VisitBaseline {
    return this.visit?.projectId === project.projectId ? this.visit.baseline : { kind: "first-visit" };
  }

  private current: { readonly project: ProjectSnapshot; readonly draft: WorkspaceDraft } | undefined;
  private sidebar: Pick<vscode.WebviewView, "webview" | "show" | "onDidDispose" | "visible" | "onDidChangeVisibility"> | undefined;
  private sidebarSubscriptions: vscode.Disposable[] = [];
  private viewReady = false;
  private deleting = false;
  private activity: Omit<ActivityQuery, "limit"> | undefined;
  private runDetail: { readonly panel: vscode.WebviewPanel; readonly runId: string; readonly sessionId: string; readonly html?: string } | undefined;
  private lookup: { readonly projectId: string; readonly result: RetrievalResult } | undefined;
  private conversationState: ConversationState = { kind: "disconnected", message: "Connect your configured Codex account to discuss this project." };
  private detail: { readonly panel: vscode.WebviewPanel; readonly groupId: string; readonly sessionId: string; readonly html?: string } | undefined;
  private readonly settingsChanged: vscode.Disposable;

  constructor(private readonly createPanel: typeof vscode.window.createWebviewPanel = vscode.window.createWebviewPanel,
    private readonly operations: DraftOperations = {
      prepare: (goal) => new GoalInterpreter().propose(goal),
      save: () => undefined,
    }, private readonly confirmDelete: (goal: string) => Promise<boolean> = async (goal) =>
      await vscode.window.showWarningMessage(`Delete “${goal}” and its proposal?`,
        { modal: true, detail: "Removes this saved goal and its proposed tasks. Repository files are unchanged. Prior project history is retained." }, "Delete goal") === "Delete goal",
    private readonly conversation?: { connect(): Promise<void>; disconnect(): void; send(text: string, sessionId: string, model: string, attachFiles: boolean, recordIds: readonly string[], accepted: () => void): Promise<void>;
      session?(action: "new" | "rename" | "fork" | "archive" | "share", id?: string): Promise<string | undefined>;
      models?(): Promise<readonly string[]>; interrupt(): Promise<void>; knowledge?(kind: KnowledgeOperation, id?: string): Promise<void> },
    private readonly execution?: { handle(message: ExecutionMessage): Promise<void>; renderDetails?(runId: string): string },
    private readonly coordination?: { handle(message: CoordinationMessage): Promise<void> },
    private readonly readActivity?: (projectId: string, query: ActivityQuery) => ActivityPage | undefined) {
    this.settingsChanged = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("piarre.providers")) this.refresh();
    });
  }

  resolveWebviewView(panel: Pick<vscode.WebviewView, "webview" | "show" | "onDidDispose" | "visible" | "onDidChangeVisibility">): void {
    this.detachSidebar();
    this.sidebar = panel;
    this.sidebarSubscriptions.push(panel.onDidChangeVisibility(() => { if (panel.visible) this.refresh(); }));
    panel.webview.options = { enableScripts: true, localResourceRoots: [] };
    this.sidebarSubscriptions.push(panel.onDidDispose(() => {
      if (this.sidebar === panel) this.detachSidebar();
    }));
    this.sidebarSubscriptions.push(panel.webview.onDidReceiveMessage((message: unknown) => {
        const current = this.current;
        if (this.sidebar !== panel || !current) return;
        const draft = current.draft;

        if (typeof message === "object" && message !== null && "kind" in message && message.kind === "ready") {
          this.viewReady = true;
          this.refresh();
          this.publishDraft();
          return;
        }
        if (typeof message === "object" && message !== null && "kind" in message && message.kind === "activity-page") {
          if (Object.keys(message).length === 3 && "projectId" in message && message.projectId === current.project.projectId && "beforeRevision" in message &&
              (message.beforeRevision === null || (typeof message.beforeRevision === "number" && Number.isSafeInteger(message.beforeRevision) && message.beforeRevision >= 1))) {
            this.activity = message.beforeRevision === null ? {} : { beforeRevision: message.beforeRevision };
            this.publishActivity();
          }
          return;
        }
        if (typeof message === "object" && message !== null && "kind" in message && message.kind === "open-proposal") {
          if (Object.keys(message).length === 2 && "groupId" in message && typeof message.groupId === "string" && message.groupId.length <= 2048) this.openProposal(message.groupId);
          return;
        }
        if (typeof message === "object" && message !== null && "kind" in message && message.kind === "delete-proposal") {
          if (Object.keys(message).length === 2 && "groupId" in message && typeof message.groupId === "string") void this.deleteProposal(message.groupId);
          return;
        }
        if (typeof message === "object" && message !== null && "kind" in message) {
          if (Object.keys(message).length === 1) {
            if (message.kind === "connect-codex") { void this.conversation?.connect(); return; }
            if (message.kind === "disconnect-codex") { this.conversation?.disconnect(); return; }
            if (message.kind === "stop-conversation") { void this.conversation?.interrupt(); return; }
          }
          if (message.kind === "send-conversation") {
            if ("text" in message && typeof message.text === "string" && message.text.trim() && message.text.length <= 10_000 &&
                "sessionId" in message && typeof message.sessionId === "string" && "requestId" in message && typeof message.requestId === "string" &&
                "model" in message && typeof message.model === "string" && message.model.length <= 512 &&
                "attachFiles" in message && typeof message.attachFiles === "boolean" && "recordIds" in message && Array.isArray(message.recordIds) &&
                message.recordIds.length <= 15 && message.recordIds.every((id: unknown): id is string => typeof id === "string" && id.length <= 2048)) {
              const { text, sessionId, model, attachFiles, recordIds, requestId } = message;
              void this.conversation?.send(text, sessionId, model, attachFiles, recordIds, () => {
                if (this.sidebar === panel && this.current?.project.projectId === current.project.projectId) void panel.webview.postMessage({ kind: "send-accepted", requestId, sessionId });
              }).catch(() => vscode.window.showErrorMessage("Piarre could not send the reviewed context. Your draft is still available."))
                .finally(() => { if (this.sidebar === panel && this.current?.project.projectId === current.project.projectId) void panel.webview.postMessage({ kind: "send-finished", requestId }); });
            }
            return;
          }
          if (message.kind === "session-action" && "action" in message) {
            const action = message.action;
            if (action === "new" || action === "rename" || action === "fork" || action === "archive" || action === "share") {
              const id = "id" in message && typeof message.id === "string" ? message.id : undefined;
              void this.conversation?.session?.(action, id).then(selected => {
                if (selected && this.current?.project.projectId === current.project.projectId && this.sidebar === panel) void panel.webview.postMessage({ kind: "select-session", id: selected });
              }).catch(() => vscode.window.showWarningMessage("The session could not be changed. Check whether a reply is active or the project changed."));
            }
            return;
          }
          if (message.kind === "load-models") {
            void this.conversation?.models?.().then(models => { if (this.sidebar === panel && this.current?.project.projectId === current.project.projectId) void panel.webview.postMessage({ kind: "models", models }); })
              .catch(() => vscode.window.showWarningMessage("Could not read the Codex model catalog. The account default is still available."));
            return;
          }
        }
        if (typeof message === "object" && message !== null && "kind" in message) {
          if ((message.kind === "observe-business" || message.kind === "observe-decision" || message.kind === "lookup-project") && Object.keys(message).length === 1) {
            void this.conversation?.knowledge?.(message.kind); return;
          }
          if ((message.kind === "confirm-knowledge" || message.kind === "correct-knowledge" || message.kind === "prepare-relationship" || message.kind === "review-relationship" || message.kind === "withdraw-relationship" || message.kind === "check-relationship") && Object.keys(message).length === 2 && "knowledgeId" in message && typeof message.knowledgeId === "string") {
            void this.conversation?.knowledge?.(message.kind, message.knowledgeId); return;
          }
        }
        const coordinationMessage = parseCoordinationMessage(message);
        if (coordinationMessage) { void this.coordination?.handle(coordinationMessage); return; }
        const executionMessage = parseExecutionMessage(message);
        if (executionMessage) { void this.execution?.handle(executionMessage); return; }
        void draft.receive(message);
      }));
    this.renderSidebar();
  }

  private detachSidebar(): void {
    this.sidebar = undefined;
    this.viewReady = false;
    for (const subscription of this.sidebarSubscriptions.splice(0)) subscription.dispose();
  }

  private renderSidebar(): void {
    if (!this.sidebar) return;
    this.viewReady = false;
    this.sidebar.webview.html = this.current
      ? renderWorkView(this.current.project, this.configuration(), this.execution !== undefined, this.visitBaseline(this.current.project))
      : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);padding:16px}a{color:var(--vscode-textLink-foreground)}</style></head><body><p>Open a trusted local Git repository to use Piarre.</p><p>Run “Piarre: Open” after selecting a workspace folder.</p></body></html>`;
  }

  show(project: ProjectSnapshot): void {
    this.update(project);
    if (this.sidebar) this.sidebar.show(false);
    else void vscode.commands.executeCommand("piarre.sidebar.focus");
  }

  updateLookup(projectId: string, result: RetrievalResult): void {
    if (this.current?.project.projectId !== projectId) return;
    this.lookup = { projectId, result }; this.refresh();
  }

  updateConversation(project: ProjectSnapshot, state: ConversationState): void {
    this.conversationState = state;
    this.update(project);
  }

  update(project: ProjectSnapshot): void {
    if (!this.current || this.current.project.projectId !== project.projectId) {
      if (this.current) this.conversationState = { kind: "disconnected", message: "Connect your configured Codex account to discuss this project." };
      this.closeDetail(); this.closeRunDetail(); this.current?.draft.dispose();
      const draft = new WorkspaceDraft(project, this.operations, () => { this.publishDraft(); });
      this.current = { project, draft };
      this.lookup = undefined;
      this.activity = undefined;
      this.renderSidebar();
    } else {
      this.current.draft.update(project);
      this.current = { ...this.current, project };
      this.refresh();
    }
  }

  async deleteProposal(groupId: string): Promise<void> {
    const current = this.current;
    const proposal = current?.project.proposals.find(item => item.groupId === groupId);
    if (!current || !proposal || !this.operations.deleteProposal || this.deleting) return;
    this.deleting = true;
    try {
      if (!await this.confirmDelete(proposal.goal)) return;
      if (this.current !== current) {
        await vscode.window.showInformationMessage("The project changed. Review the goal before deleting it."); return;
      }
      const result = this.operations.deleteProposal(current.project, groupId, randomUUID());
      if (result) this.update(result);
      else await vscode.window.showInformationMessage("The goal could not be deleted. Refresh the project and try again.");
    } catch {
      await vscode.window.showErrorMessage("The goal could not be deleted. Refresh the project and try again.");
    } finally { this.deleting = false; }
  }

  openProposal(groupId: string): void {
    if (!this.current?.project.proposals.some(proposal => proposal.groupId === groupId)) return;
    if (!this.detail) {
      const panel = this.createPanel("piarre.proposal", "Proposal details", vscode.ViewColumn.Beside,
        { enableScripts: true, localResourceRoots: [] });
      this.detail = { panel, groupId, sessionId: this.current.project.proposals.find(item => item.groupId === groupId)?.sessionId ?? defaultSessionId };
      panel.webview.onDidReceiveMessage((message: unknown) => {
        if (this.detail?.panel !== panel) return;
        if (this.isReturnMessage(message)) { const id = this.detail.sessionId; this.closeDetail(); this.returnToChat(id); return; }
        const executionMessage = parseExecutionMessage(message);
        if (executionMessage) { void this.execution?.handle(executionMessage); return; }
        if (typeof message !== "object" || message === null || Object.keys(message).length !== 1 || !("kind" in message) || message.kind !== "delete-proposal") return;
        void this.deleteProposal(this.detail.groupId);
      });
      panel.onDidDispose(() => { if (this.detail?.panel === panel) { this.detail = undefined; void this.sidebar?.webview.postMessage({ kind: "proposal-opened" }); } });
    } else this.detail = { ...this.detail, groupId, sessionId: this.current.project.proposals.find(item => item.groupId === groupId)?.sessionId ?? defaultSessionId };
    this.refreshDetail();
    this.detail.panel.reveal();
    void this.sidebar?.webview.postMessage({ kind: "proposal-opened", groupId });
  }

  openExecutionResult(runId: string): void {
    if (!this.current?.project.executionRuns.some(run => run.runId === runId)) return;
    if (!this.runDetail) {
      const panel = this.createPanel("piarre.execution", "Agent work review", vscode.ViewColumn.Beside,
        { enableScripts: true, localResourceRoots: [] });
      this.runDetail = { panel, runId, sessionId: this.runSession(runId) };
      panel.webview.onDidReceiveMessage((message: unknown) => {
        if (this.runDetail?.panel !== panel) return;
        if (this.isReturnMessage(message)) { const id = this.runDetail.sessionId; this.closeRunDetail(); this.returnToChat(id); return; }
        const parsed = parseExecutionMessage(message);
        if (parsed) void this.execution?.handle(parsed);
      });
      panel.onDidDispose(() => { if (this.runDetail?.panel === panel) this.runDetail = undefined; });
    } else this.runDetail = { ...this.runDetail, runId, sessionId: this.runSession(runId) };
    this.refreshRunDetail(); this.runDetail.panel.reveal();
  }

  private isReturnMessage(message: unknown): boolean {
    return typeof message === "object" && message !== null && Object.keys(message).length === 1 && "kind" in message && message.kind === "return-to-chat";
  }

  private runSession(runId: string): string {
    const run = this.current?.project.executionRuns.find(item => item.runId === runId);
    return this.current?.project.proposals.find(group => group.taskIds.includes(run?.grant.plan.taskId ?? ""))?.sessionId ?? defaultSessionId;
  }

  private returnToChat(sessionId: string): void {
    this.sidebar?.show(false);
    void this.sidebar?.webview.postMessage({ kind: "select-session", id: sessionId });
  }

  private refreshRunDetail(): void {
    const detail = this.runDetail; if (!detail || !this.current) return;
    if (!this.current.project.executionRuns.some(run => run.runId === detail.runId)) { this.closeRunDetail(); return; }
    const html = renderExecutionResult(this.current.project, detail.runId) + (this.execution?.renderDetails?.(detail.runId) ?? "");
    if (detail.html === html) return;
    this.runDetail = { ...detail, html };
    const nonce = randomUUID();
    const identity = JSON.stringify(detail.runId).replaceAll("<", "\\u003c");
    detail.panel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);line-height:1.6;padding:24px;overflow-wrap:anywhere}details{border-top:1px solid var(--vscode-panel-border);padding:12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}button{font:inherit;min-height:36px;margin:8px 8px 8px 0;padding:8px 16px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;cursor:pointer}:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:3px}</style></head><body><button id="return-to-chat" type="button">← Return to chat draft</button>${html}<script nonce="${nonce}">const api=acquireVsCodeApi();document.getElementById("return-to-chat").onclick=()=>api.postMessage({kind:"return-to-chat"});const identity=${identity};const disclosures=[...document.querySelectorAll('details')];const state=api.getState();if(state&&state.identity===identity){disclosures.forEach(item=>{item.open=state.open.includes(item.dataset.reviewKey);});requestAnimationFrame(()=>{window.scrollTo(0,state.scroll);disclosures.find(item=>item.dataset.reviewKey===state.focus)?.querySelector('summary')?.focus({preventScroll:true});if(state.action)[...document.querySelectorAll('[data-execution-action]')].find(button=>button.dataset.executionAction===state.action&&button.dataset.executionId===state.actionId)?.focus({preventScroll:true});});}function remember(){api.setState({identity,open:disclosures.flatMap(item=>item.open?[item.dataset.reviewKey]:[]),scroll:window.scrollY,focus:disclosures.find(item=>item.querySelector('summary')===document.activeElement)?.dataset.reviewKey,action:document.activeElement?.dataset.executionAction,actionId:document.activeElement?.dataset.executionId});}disclosures.forEach(item=>item.addEventListener('toggle',remember));window.addEventListener('scroll',remember,{passive:true});document.addEventListener('focusin',remember);document.addEventListener('click',event=>{const button=event.target instanceof Element?event.target.closest('[data-execution-action]'):null;if(!button)return;api.postMessage(button.dataset.executionId?{kind:'execution',action:button.dataset.executionAction,id:button.dataset.executionId}:{kind:'execution',action:button.dataset.executionAction});});</script></body></html>`;
  }

  private closeRunDetail(): void { const detail = this.runDetail; this.runDetail = undefined; detail?.panel.dispose(); }

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
    this.detail.panel.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:var(--vscode-font-family);line-height:1.6;padding:24px;color:var(--vscode-foreground);background:var(--vscode-editor-background);overflow-wrap:anywhere}section{max-width:760px;margin:auto;animation:arrive 140ms ease-out}details{margin:16px 0;border:1px solid var(--vscode-panel-border);padding:16px}summary{cursor:pointer;min-height:32px}.budget-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:16px}.budget-grid dt{color:var(--vscode-descriptionForeground)}.budget-grid dd{font-weight:600;margin:4px 0}button{font:inherit;padding:8px 16px;min-height:36px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:1px solid var(--vscode-panel-border);cursor:pointer}:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:3px}@keyframes arrive{from{opacity:.7}to{opacity:1}}@media(prefers-reduced-motion:reduce){section{animation:none}}</style></head><body><button id="return-to-chat" type="button">← Return to chat draft</button><h1>Proposal details</h1><p>Not approved to run</p><button id="delete-goal" type="button">Delete goal and proposal</button>${html}<script nonce="${nonce}">
const api = acquireVsCodeApi();
const groupId = ${groupKey};
document.getElementById("return-to-chat").onclick=()=>api.postMessage({kind:"return-to-chat"});
document.getElementById('delete-goal').addEventListener('click', () => api.postMessage({kind:'delete-proposal'}));
document.addEventListener('click',event=>{const button=event.target instanceof Element?event.target.closest('[data-execution-action]'):null;if(button)api.postMessage(button.dataset.executionId?{kind:'execution',action:button.dataset.executionAction,id:button.dataset.executionId}:{kind:'execution',action:button.dataset.executionAction});});
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
    if (detail) void this.sidebar?.webview.postMessage({ kind: "proposal-opened" });
  }

  private configuration(): ProviderConfiguration {
    return parseProviderConfiguration(vscode.workspace.getConfiguration("piarre").get<unknown>("providers", []));
  }

  private refresh(): void {
    if (!this.current) return;
    this.refreshDetail();
    this.refreshRunDetail();
    if (!this.sidebar || !this.viewReady) return;
    const panel = this.sidebar;
    const { project } = this.current;
    if (panel.visible && this.visit?.projectId === project.projectId) this.visit.observed(project.revision);
    void panel.webview.postMessage({ kind: "conversation", state: this.conversationState,
      sessions: project.sessions.filter(session => !session.archived).map(session => {
        const turn = conversationHistory(project, session.id).at(-1);
        const proposals = project.proposals.filter(group => (group.sessionId ?? defaultSessionId) === session.id);
        const tasks = proposals.flatMap(group => group.taskIds);
        const recentRuns = [...project.executionRuns].reverse();
        const latestRuns = tasks.map(taskId => recentRuns.find(run => run.grant.plan.taskId === taskId));
        const status = turn?.kind === "pending" || latestRuns.some(run => run && run.state.kind !== "terminal") ? "Reply or work in progress"
          : turn?.kind === "failed" || turn?.kind === "unknown" || latestRuns.some(run => run?.state.kind === "terminal" &&
            (run.state.result.outcome === "failed" || run.state.result.outcome === "unknown")) ? "Something went wrong"
          : turn?.kind === "interrupted" || latestRuns.some(run => run?.state.kind === "terminal" &&
            run.state.result.outcome === "needs-review" && run.acceptance.kind === "unreviewed") ? "Needs your attention"
          : tasks.length > 0 && latestRuns.every(run => run?.acceptance.kind === "accepted" && run.reviewFreshness.kind === "current") ? "Complete"
          : "In progress";
        return { ...session, status, html: renderConversation(project, session.id),
          artifacts: proposals.map(group => ({ id: group.groupId, title: group.goal,
            runs: project.executionRuns.filter(run => group.taskIds.includes(run.grant.plan.taskId)).map(run => run.runId) })) };
      }) });
    void panel.webview.postMessage({ kind: "inspection", selectedGroupId: this.detail?.groupId,
      html: renderInspection(project, this.configuration(), undefined, this.execution !== undefined, false),
      knowledge: renderKnowledge(project, true) + renderKnowledgeRelationships(project) + (this.lookup?.projectId === project.projectId ? renderLookup(this.lookup.result) : ""),
      ...conversationContextCatalog(project),
      brief: renderSessionBrief(project, this.visitBaseline(project)),
      agentOverview: this.execution ? renderCoordination(project) + renderExecutionDesk(project) : "<p>No coding agents are running. Save a task proposal to prepare work for an agent.</p>",
      executionControls: this.execution ? renderExecutionControls(project) : "" });
    this.publishActivity();
  }

  private publishActivity(): void {
    if (!this.current || !this.sidebar || !this.viewReady || !this.activity) return;
    const { project } = this.current;
    let html: string;
    try {
      const page = this.readActivity?.(project.projectId, { beforeRevision: Math.min(this.activity.beforeRevision ?? project.revision + 1, project.revision + 1), limit: 20 });
      html = page ? renderActivity(project, page, this.activity.beforeRevision) : '<p>Activity history is unavailable for this project. No provider was contacted.</p><button type="button" data-activity-before="">Read newest milestones</button>';
    } catch {
      html = '<p>Activity history could not be read. Missing records do not establish completion. No provider was contacted.</p><button type="button" data-activity-before="">Read newest milestones</button>';
    }
    void this.sidebar.webview.postMessage({ kind: "activity", projectId: project.projectId, beforeRevision: this.activity.beforeRevision ?? null, html });
  }

  private publishDraft(): void {
    if (this.current) void this.sidebar?.webview.postMessage({ kind: "draft", state: this.current.draft.state });
  }

  close(): void {
    this.closeRunDetail();
    this.closeDetail();
    const current = this.current;
    this.current = undefined;
    current?.draft.dispose();
    this.renderSidebar();
  }

  dispose(): void {
    this.settingsChanged.dispose();
    this.close();
    this.detachSidebar();
  }
}
