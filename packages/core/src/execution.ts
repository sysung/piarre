import type { CodexExecutionContext } from "./provider-account-context.js";
import type { KnowledgeVersion } from "./context.js";
import { currentKnowledge, knowledgeConflicts } from "./knowledge.js";
import { validateFileManifest, type FileBaseline } from "./execution-patch.js";
import type { ProjectSnapshot } from "./index.js";

export interface ExecutionCriterion { readonly criterionId: string; readonly text: string }
export interface ExecutionCheck {
  readonly checkId: string;
  readonly argv: readonly [string, ...string[]];
  readonly criterionIds: readonly string[];
}
export interface ExecutionPlanDraft {
  readonly taskId: string;
  readonly objective: string;
  readonly criteria: readonly ExecutionCriterion[];
  readonly knowledge: readonly KnowledgeVersion[];
  readonly files: readonly FileBaseline[];
  readonly checks: readonly ExecutionCheck[];
  readonly candidateRoot: string;
  readonly controlDirectory: string;
  readonly captureHash: string;
  readonly baselineCheckpoint: { readonly checkpointId: string; readonly manifestHash: string };
  readonly sourceRoot: string;
  readonly provider: { readonly kind: "codex-readonly-patch"; readonly authType: "chatgpt" | "apiKey" | "unknown"; readonly requestedModel: string };
  readonly accountContext: CodexExecutionContext;
  readonly durationMs: number;
  readonly maxTokens: number;
}
export interface ExecutionPlan extends ExecutionPlanDraft { readonly planId: string; readonly recordedAtRevision: number }
export interface ExecutionGrant {
  readonly approvalId: string;
  readonly plan: ExecutionPlan;
  readonly approvedAt: number;
  readonly expiresAt: number;
  readonly deadlineAt: number;
}
export type ProviderTurn = { readonly kind: "not-requested" | "unacknowledged" }
  | { readonly kind: "thread"; readonly threadId: string }
  | { readonly kind: "turn"; readonly threadId: string; readonly turnId: string };
export type CheckProcess = { readonly kind: "none" }
  | { readonly kind: "launching"; readonly nonce: string; readonly checkId: string; readonly controlDirectory: string }
  | { readonly kind: "running"; readonly nonce: string; readonly checkId: string; readonly pid: number; readonly watchdogPid: number; readonly startedAt: number; readonly controlDirectory: string }
  | { readonly kind: "unknown"; readonly nonce: string; readonly checkId: string; readonly controlDirectory: string; readonly reason: string;
      readonly lastIdentity: { readonly kind: "unobserved" } | { readonly kind: "observed"; readonly pid: number; readonly watchdogPid: number; readonly startedAt: number } };
export interface CheckEvidence {
  readonly checkId: string;
  readonly nonce: string;
  readonly termination: "observed" | "not-started" | "unconfirmed";
  readonly kind: "passed" | "failed" | "unknown" | "not-tested";
  readonly criterionIds: readonly string[];
  readonly argv: readonly [string, ...string[]];
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly manifestHash: string;
  readonly observedAt: number;
}
export interface ExecutionResult {
  readonly resultId: string;
  readonly recordedAtRevision: number;
  readonly summary: string;
  readonly outcome: "needs-review" | "failed" | "no-change" | "unknown";
  readonly manifestHash: string;
  readonly checks: readonly CheckEvidence[];
}
export type RunState =
  | { readonly kind: "reserved" | "generating" | "applying" | "checking" }
  | { readonly kind: "unknown"; readonly reason: string }
  | { readonly kind: "terminal"; readonly result: ExecutionResult };
export type WorkspaceRequest =
  | { readonly kind: "integrate"; readonly resultId: string; readonly resultRevision: number; readonly expectedManifestHash: string; readonly targetManifestHash: string }
  | { readonly kind: "restore"; readonly target: "source" | "candidate"; readonly checkpointId: string; readonly expectedManifestHash: string; readonly targetManifestHash: string };
export type WorkspaceState =
  | { readonly kind: "not-integrated" }
  | { readonly kind: "writing"; readonly operationId: string; readonly request: WorkspaceRequest }
  | { readonly kind: "unknown"; readonly operationId: string; readonly request: WorkspaceRequest; readonly reason: string }
  | { readonly kind: "stale"; readonly operationId: string; readonly manifestHash: string; readonly reason: string }
  | { readonly kind: "integrated"; readonly operationId: string; readonly manifestHash: string; readonly observedAt: number }
  | { readonly kind: "restored"; readonly operationId: string; readonly request: Extract<WorkspaceRequest, { readonly kind: "restore" }>; readonly manifestHash: string; readonly observedAt: number };
export interface ExecutionRun {
  readonly runId: string;
  readonly ownerPid: number;
  readonly ownerId: string;
  readonly grant: ExecutionGrant;
  readonly state: RunState;
  readonly providerTurn: ProviderTurn;
  readonly providerObservation: { readonly kind: "unobserved" } | { readonly kind: "observed"; readonly model: string; readonly modelProvider: string; readonly observedAt: number };
  readonly process: CheckProcess;
  readonly evidence: readonly CheckEvidence[];
  readonly workspace: WorkspaceState;
  readonly reviewFreshness: { readonly kind: "current" } | { readonly kind: "stale"; readonly reason: string };
  readonly acceptance: { readonly kind: "unreviewed" } | { readonly kind: "accepted"; readonly resultId: string; readonly resultRevision: number; readonly commandId: string };
}
export type ExecutionAction =
  | { readonly kind: "prepare-execution-plan"; readonly plan: ExecutionPlanDraft }
  | { readonly kind: "approve-execution"; readonly planId: string; readonly planRevision: number; readonly runId: string; readonly approvedAt: number; readonly expiresAt: number; readonly ownerPid: number; readonly ownerId: string }
  | { readonly kind: "request-execution"; readonly runId: string; readonly requestedAt: number }
  | { readonly kind: "observe-execution-provider"; readonly runId: string; readonly model: string; readonly modelProvider: string; readonly observedAt: number }
  | { readonly kind: "bind-execution-thread"; readonly runId: string; readonly threadId: string }
  | { readonly kind: "bind-execution-turn"; readonly runId: string; readonly threadId: string; readonly turnId: string }
  | { readonly kind: "begin-candidate-apply"; readonly runId: string; readonly observedAt: number }
  | { readonly kind: "begin-execution-check"; readonly runId: string; readonly checkId: string; readonly nonce: string; readonly requestedAt: number; readonly controlDirectory: string }
  | { readonly kind: "bind-check-process"; readonly runId: string; readonly checkId: string; readonly nonce: string; readonly pid: number; readonly watchdogPid: number; readonly startedAt: number; readonly controlDirectory: string }
  | { readonly kind: "record-execution-check"; readonly runId: string; readonly evidence: CheckEvidence }
  | { readonly kind: "mark-execution-unknown"; readonly runId: string; readonly reason: string }
  | { readonly kind: "reconcile-execution-process"; readonly runId: string; readonly nonce: string; readonly reason: string; readonly evidence: CheckEvidence | null }
  | { readonly kind: "finish-execution"; readonly runId: string; readonly summary: string; readonly outcome: ExecutionResult["outcome"]; readonly manifestHash: string }
  | { readonly kind: "accept-execution-result"; readonly runId: string; readonly resultId: string; readonly resultRevision: number }
  | { readonly kind: "begin-workspace-operation"; readonly runId: string; readonly request: WorkspaceRequest }
  | { readonly kind: "finish-workspace-operation"; readonly runId: string; readonly operationId: string; readonly manifestHash: string; readonly observedAt: number }
  | { readonly kind: "mark-workspace-unknown"; readonly runId: string; readonly reason: string }
  | { readonly kind: "abandon-workspace-operation"; readonly runId: string; readonly operationId: string; readonly observedManifestHash: string; readonly reason: string }
  | { readonly kind: "invalidate-execution-workspace"; readonly runId: string; readonly reason: string }
  | { readonly kind: "set-scheduling-paused"; readonly paused: boolean };

export interface ExecutionEvent { readonly kind: "execution-recorded"; readonly commandId: string; readonly action: ExecutionAction }
function uncertainProcess(process: Exclude<CheckProcess, { readonly kind: "none" }>, reason: string): CheckProcess {
  if (process.kind === "unknown") return { ...process, reason };
  return { kind: "unknown", nonce: process.nonce, checkId: process.checkId, controlDirectory: process.controlDirectory, reason,
    lastIdentity: process.kind === "running" ? { kind: "observed", pid: process.pid, watchdogPid: process.watchdogPid, startedAt: process.startedAt } : { kind: "unobserved" } };
}
function invalid(): never { throw new Error("Invalid execution operation"); }
function sameVersion(left: KnowledgeVersion, right: KnowledgeVersion): boolean {
  return left.projectId === right.projectId && left.knowledgeId === right.knowledgeId && left.recordedAtRevision === right.recordedAtRevision;
}
export function planFreshness(project: ProjectSnapshot, plan: ExecutionPlan): "current" | "stale" | "disputed" {
  if (project.executionPlans.some(item => item.planId === plan.planId) && currentExecutionPlan(project, plan.taskId)?.planId !== plan.planId) return "stale";
  if (!project.tasks.some(task => task.taskId === plan.taskId)) return "stale";
  const records = currentKnowledge(project);
  for (const version of plan.knowledge) {
    const entry = records.find(item => sameVersion(item, version));
    if (!entry) return "stale";
    if (knowledgeConflicts(project, entry).length) return "disputed";
  }
  const required = records.filter(entry => entry.affectedTaskIds.includes(plan.taskId));
  if (required.some(entry => !plan.knowledge.some(version => sameVersion(version, entry)))) return "stale";
  if (project.knowledgeImpacts.some(impact => impact.taskId === plan.taskId && impact.toRevision >= plan.recordedAtRevision)) return "stale";
  return "current";
}
export function executionDependenciesReady(project: ProjectSnapshot, taskId: string): boolean {
  const visiting = new Set<string>();
  const ready = new Map<string, boolean>();
  const visit = (id: string): boolean => {
    const cached = ready.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return false;
    const task = project.tasks.find(item => item.taskId === id);
    if (!task) return false;
    visiting.add(id);
    const result = task.dependsOn.every(dependency => visit(dependency) && project.executionRuns.some(run =>
      run.grant.plan.taskId === dependency && run.acceptance.kind === "accepted" && run.state.kind === "terminal" &&
      run.state.result.outcome === "needs-review" && run.workspace.kind === "integrated" && run.reviewFreshness.kind === "current" &&
      !ownsExecutionLease(run) && planFreshness(project, run.grant.plan) === "current"));
    visiting.delete(id);
    ready.set(id, result);
    return result;
  };
  return visit(taskId);
}
export function ownsExecutionLease(run: ExecutionRun): boolean { return run.state.kind !== "terminal" || run.workspace.kind === "writing" || run.workspace.kind === "unknown"; }
export function currentExecutionPlan(project: ProjectSnapshot, taskId: string): ExecutionPlan | undefined {
  return project.executionPlans.filter(plan => plan.taskId === taskId).at(-1);
}

export function applyExecutionEvent(project: ProjectSnapshot, event: ExecutionEvent): ProjectSnapshot {
  const action = event.action;
  const revision = project.revision + 1;
  if (action.kind === "set-scheduling-paused") return { ...project, revision, schedulingPaused: action.paused };
  if (action.kind === "prepare-execution-plan") {
    if (!project.tasks.some(task => task.taskId === action.plan.taskId)) invalid();
    validateFileManifest(action.plan.files);
    const plan = { ...action.plan, planId: `plan:${event.commandId}`, recordedAtRevision: revision };
    if (planFreshness(project, plan) !== "current") invalid();
    return { ...project, revision, executionPlans: [...project.executionPlans, plan] };
  }
  if (action.kind === "approve-execution") {
    if (project.schedulingPaused || project.executionRuns.some(ownsExecutionLease) || project.executionRuns.some(run => run.runId === action.runId)) invalid();
    const plan = project.executionPlans.find(item => item.planId === action.planId && item.recordedAtRevision === action.planRevision);
    if (!plan || currentExecutionPlan(project, plan.taskId)?.planId !== plan.planId || planFreshness(project, plan) !== "current" || action.expiresAt <= action.approvedAt) invalid();
    const task = project.tasks.find(item => item.taskId === plan.taskId);
    if (!task || !executionDependenciesReady(project, task.taskId)) invalid();
    const run: ExecutionRun = { runId: action.runId, ownerPid: action.ownerPid, ownerId: action.ownerId, grant: { approvalId: event.commandId, plan, approvedAt: action.approvedAt,
      expiresAt: action.expiresAt, deadlineAt: action.approvedAt + plan.durationMs }, state: { kind: "reserved" },
      providerTurn: { kind: "not-requested" }, providerObservation: { kind: "unobserved" }, process: { kind: "none" }, evidence: [], workspace: { kind: "not-integrated" }, reviewFreshness: { kind: "current" }, acceptance: { kind: "unreviewed" } };
    return { ...project, revision, executionRuns: [...project.executionRuns, run] };
  }
  const run = project.executionRuns.find(item => item.runId === action.runId);
  if (!run) invalid();
  let next: ExecutionRun;
  switch (action.kind) {
    case "request-execution":
      if (run.state.kind !== "reserved" || project.schedulingPaused || action.requestedAt < run.grant.approvedAt || action.requestedAt >= run.grant.expiresAt || action.requestedAt >= run.grant.deadlineAt || (planFreshness(project, run.grant.plan) !== "current" || !executionDependenciesReady(project, run.grant.plan.taskId))) invalid();
      next = { ...run, state: { kind: "generating" }, providerTurn: { kind: "unacknowledged" } }; break;
    case "observe-execution-provider":
      if (run.state.kind !== "generating" || run.providerObservation.kind !== "unobserved" || action.model !== run.grant.plan.provider.requestedModel || action.modelProvider !== "openai" || action.observedAt < run.grant.approvedAt || action.observedAt >= run.grant.deadlineAt) invalid();
      next = { ...run, providerObservation: { kind: "observed", model: action.model, modelProvider: action.modelProvider, observedAt: action.observedAt } }; break;
    case "bind-execution-thread":
      if (run.state.kind !== "generating" || run.providerObservation.kind !== "observed" || run.providerTurn.kind !== "unacknowledged") invalid();
      next = { ...run, providerTurn: { kind: "thread", threadId: action.threadId } }; break;
    case "bind-execution-turn":
      if (run.state.kind !== "generating" || run.providerTurn.kind !== "thread" || run.providerTurn.threadId !== action.threadId) invalid();
      next = { ...run, providerTurn: { kind: "turn", threadId: action.threadId, turnId: action.turnId } }; break;
    case "begin-candidate-apply":
      if (run.reviewFreshness.kind !== "current" || action.observedAt < run.grant.approvedAt || action.observedAt >= run.grant.deadlineAt || run.state.kind !== "generating" || run.providerTurn.kind !== "turn" || (planFreshness(project, run.grant.plan) !== "current" || !executionDependenciesReady(project, run.grant.plan.taskId))) invalid();
      next = { ...run, state: { kind: "applying" } }; break;
    case "begin-execution-check":
      if (!executionDependenciesReady(project, run.grant.plan.taskId) || planFreshness(project, run.grant.plan) !== "current" || action.requestedAt < run.grant.approvedAt || action.requestedAt >= run.grant.deadlineAt || (run.state.kind !== "applying" && run.state.kind !== "checking") || run.process.kind !== "none" || run.evidence.some(item => item.checkId === action.checkId) || !run.grant.plan.checks.some(check => check.checkId === action.checkId)) invalid();
      next = { ...run, state: { kind: "checking" }, process: { kind: "launching", nonce: action.nonce, checkId: action.checkId, controlDirectory: action.controlDirectory } }; break;
    case "bind-check-process":
      if (run.state.kind !== "checking" || run.process.kind !== "launching" || run.process.nonce !== action.nonce || run.process.checkId !== action.checkId || run.process.controlDirectory !== action.controlDirectory || action.startedAt >= run.grant.deadlineAt) invalid();
      next = { ...run, process: { kind: "running", nonce: action.nonce, checkId: action.checkId, pid: action.pid, watchdogPid: action.watchdogPid, startedAt: action.startedAt, controlDirectory: action.controlDirectory } }; break;
    case "record-execution-check": {
      const check = run.grant.plan.checks.find(item => item.checkId === action.evidence.checkId);
      if (run.state.kind !== "checking" || run.process.kind === "none" || run.process.kind === "unknown" || run.process.nonce !== action.evidence.nonce || run.process.checkId !== action.evidence.checkId || !check || run.evidence.some(item => item.checkId === check.checkId) ||
          JSON.stringify(check.argv) !== JSON.stringify(action.evidence.argv) || JSON.stringify(check.criterionIds) !== JSON.stringify(action.evidence.criterionIds)) invalid();
      if (run.process.kind === "running" && action.evidence.observedAt < run.process.startedAt) invalid();
      if (action.evidence.kind === "passed" && (action.evidence.observedAt >= run.grant.deadlineAt || action.evidence.termination !== "observed" || action.evidence.exitCode !== 0 || action.evidence.signal !== null || run.process.kind !== "running")) invalid();
      if (action.evidence.termination === "not-started" && (run.process.kind !== "launching" || action.evidence.kind !== "not-tested" || action.evidence.exitCode !== null || action.evidence.signal !== null)) invalid();
      next = action.evidence.termination === "unconfirmed" ? { ...run,
        state: { kind: "unknown", reason: "Check process termination is unconfirmed" },
        process: uncertainProcess(run.process, "Check process termination is unconfirmed"), evidence: [...run.evidence, action.evidence] }
        : { ...run, process: { kind: "none" }, evidence: [...run.evidence, action.evidence] }; break;
    }
    case "mark-execution-unknown":
      if (run.state.kind === "terminal") invalid();
      next = { ...run, state: { kind: "unknown", reason: action.reason }, process: run.process.kind === "none" ? run.process : uncertainProcess(run.process, action.reason) }; break;
    case "reconcile-execution-process": {
      if (run.state.kind !== "unknown" || run.process.kind !== "unknown" || run.process.nonce !== action.nonce) invalid();
      const process = run.process;
      if (action.evidence) {
        const check = run.grant.plan.checks.find(item => item.checkId === process.checkId);
        if (!check || action.evidence.checkId !== check.checkId || action.evidence.nonce !== run.process.nonce || action.evidence.termination === "unconfirmed" || action.evidence.kind === "passed" || JSON.stringify(check.argv) !== JSON.stringify(action.evidence.argv) || JSON.stringify(check.criterionIds) !== JSON.stringify(action.evidence.criterionIds)) invalid();
      }
      next = { ...run, process: { kind: "none" }, evidence: action.evidence ? [...run.evidence.filter(item => item.checkId !== action.evidence?.checkId), action.evidence] : run.evidence }; break;
    }
    case "finish-execution": {
      if (run.state.kind === "terminal" || run.process.kind !== "none") invalid();
      if (action.outcome === "needs-review" && (run.state.kind !== "checking" || run.reviewFreshness.kind !== "current" || (planFreshness(project, run.grant.plan) !== "current" || !executionDependenciesReady(project, run.grant.plan.taskId)) || run.grant.plan.checks.length === 0 || run.grant.plan.checks.some(check => !run.evidence.some(item => item.checkId === check.checkId && item.kind === "passed" && item.manifestHash === action.manifestHash)) ||
          run.grant.plan.criteria.some(criterion => !run.evidence.some(item => item.kind === "passed" && item.criterionIds.includes(criterion.criterionId) && item.manifestHash === action.manifestHash)))) invalid();
      const result: ExecutionResult = { resultId: `result:${event.commandId}`, recordedAtRevision: revision, summary: action.summary,
        outcome: action.outcome, manifestHash: action.manifestHash, checks: run.evidence };
      next = { ...run, state: { kind: "terminal", result }, acceptance: { kind: "unreviewed" } }; break;
    }
    case "begin-workspace-operation": {
      if (run.state.kind !== "terminal" || run.process.kind !== "none" || run.workspace.kind === "writing" || run.workspace.kind === "unknown" || project.schedulingPaused || project.executionRuns.some(other => other.runId !== run.runId && ownsExecutionLease(other))) invalid();
      if (action.request.kind === "integrate" && (run.state.result.outcome !== "needs-review" || run.reviewFreshness.kind !== "current" || (planFreshness(project, run.grant.plan) !== "current" || !executionDependenciesReady(project, run.grant.plan.taskId)) || run.workspace.kind !== "not-integrated" || action.request.resultId !== run.state.result.resultId || action.request.resultRevision !== run.state.result.recordedAtRevision || action.request.targetManifestHash !== run.state.result.manifestHash)) invalid();
      next = { ...run, workspace: { kind: "writing", operationId: event.commandId, request: action.request }, acceptance: { kind: "unreviewed" },
        reviewFreshness: action.request.kind === "restore" ? { kind: "stale", reason: "Checkpoint restore invalidates earlier result evidence" } : run.reviewFreshness }; break;
    }
    case "finish-workspace-operation":
      if ((run.workspace.kind !== "writing" && run.workspace.kind !== "unknown") || run.workspace.operationId !== action.operationId || run.workspace.request.targetManifestHash !== action.manifestHash) invalid();
      next = { ...run, workspace: run.workspace.request.kind === "integrate" ? { kind: "integrated", operationId: action.operationId, manifestHash: action.manifestHash, observedAt: action.observedAt }
        : { kind: "restored", operationId: action.operationId, request: run.workspace.request, manifestHash: action.manifestHash, observedAt: action.observedAt } }; break;
    case "mark-workspace-unknown":
      if (run.workspace.kind !== "writing" && run.workspace.kind !== "unknown") invalid();
      next = { ...run, workspace: { kind: "unknown", operationId: run.workspace.operationId, request: run.workspace.request, reason: action.reason }, acceptance: { kind: "unreviewed" } }; break;
    case "abandon-workspace-operation":
      if (run.state.kind !== "terminal" || run.process.kind !== "none" || (run.workspace.kind !== "writing" && run.workspace.kind !== "unknown") || run.workspace.operationId !== action.operationId) invalid();
      next = { ...run, workspace: { kind: "stale", operationId: action.operationId, manifestHash: action.observedManifestHash, reason: action.reason },
        acceptance: { kind: "unreviewed" }, reviewFreshness: { kind: "stale", reason: action.reason } }; break;
    case "invalidate-execution-workspace":
      next = { ...run, reviewFreshness: { kind: "stale", reason: action.reason }, acceptance: { kind: "unreviewed" } }; break;
    case "accept-execution-result":
      if (run.workspace.kind !== "integrated" || run.reviewFreshness.kind !== "current" || run.workspace.manifestHash !== (run.state.kind === "terminal" ? run.state.result.manifestHash : "") || run.state.kind !== "terminal" || run.state.result.outcome !== "needs-review" || run.state.result.resultId !== action.resultId || run.state.result.recordedAtRevision !== action.resultRevision || (planFreshness(project, run.grant.plan) !== "current" || !executionDependenciesReady(project, run.grant.plan.taskId)) || run.acceptance.kind !== "unreviewed") invalid();
      next = { ...run, acceptance: { kind: "accepted", resultId: action.resultId, resultRevision: action.resultRevision, commandId: event.commandId } }; break;
    default: { const exhaustive: never = action; throw new Error(`Invalid execution action: ${String(exhaustive)}`); }
  }
  return { ...project, revision, executionRuns: project.executionRuns.map(item => item === run ? next : item) };
}
