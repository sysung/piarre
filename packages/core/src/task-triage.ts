import type { ProjectSnapshot, ProposedTask } from "./index.js";
import { ownsExecutionLease } from "./execution.js";

export interface TaskTriageValue {
  readonly priority: "high" | "normal" | "low";
  readonly disposition: { readonly kind: "available" } | { readonly kind: "deferred"; readonly reason: string };
}
export interface TaskTriageProposal {
  readonly proposalId: string;
  readonly taskId: string;
  readonly recordedAtRevision: number;
  readonly basedOnTriageRevision: number | null;
  readonly desired: TaskTriageValue;
  readonly rationale: string;
  readonly origin: { readonly kind: "user" };
}
export interface TaskTriageDecision {
  readonly decisionId: string;
  readonly taskId: string;
  readonly recordedAtRevision: number;
  readonly proposalId: string;
  readonly previous: TaskTriageValue;
  readonly adopted: TaskTriageValue;
  readonly reversedDecisionId: string | null;
}
export interface TaskTriageState {
  readonly proposals: readonly TaskTriageProposal[];
  readonly decisions: readonly TaskTriageDecision[];
}
export type TaskTriageAction =
  | { readonly kind: "propose-task-triage"; readonly taskId: string; readonly basedOnTriageRevision: number | null; readonly desired: TaskTriageValue; readonly rationale: string; readonly origin: { readonly kind: "user" } }
  | { readonly kind: "adopt-task-triage"; readonly proposalId: string; readonly proposalRevision: number; readonly triageRevision: number | null }
  | { readonly kind: "reverse-task-triage"; readonly taskId: string; readonly decisionId: string; readonly triageRevision: number };
export interface TaskTriageEvent { readonly kind: "task-triage-recorded"; readonly commandId: string; readonly action: TaskTriageAction }
const defaultValue: TaskTriageValue = { priority: "normal", disposition: { kind: "available" } };
export function latestTaskTriageDecision(project: ProjectSnapshot, taskId: string): TaskTriageDecision | undefined {
  return project.taskTriage.decisions.filter(item => item.taskId === taskId).at(-1);
}
export function currentTaskTriage(project: ProjectSnapshot, taskId: string): TaskTriageValue { return latestTaskTriageDecision(project, taskId)?.adopted ?? defaultValue; }
export function taskTriageRevision(project: ProjectSnapshot, taskId: string): number | null { return latestTaskTriageDecision(project, taskId)?.recordedAtRevision ?? null; }
export function orderedTriageTasks(project: ProjectSnapshot): readonly ProposedTask[] {
  const ranks = { high: 0, normal: 1, low: 2 };
  return [...project.tasks].sort((a, b) => {
    const left = currentTaskTriage(project, a.taskId), right = currentTaskTriage(project, b.taskId);
    return Number(left.disposition.kind === "deferred") - Number(right.disposition.kind === "deferred") || ranks[left.priority] - ranks[right.priority];
  });
}
function invalid(): never { throw new Error("Invalid or stale task triage; review the current task and triage revision."); }
function availableForChange(project: ProjectSnapshot, taskId: string, desired: TaskTriageValue): void {
  if (!project.tasks.some(task => task.taskId === taskId)) invalid();
  if (desired.disposition.kind === "deferred" && project.executionRuns.some(run => run.grant.plan.taskId === taskId && ownsExecutionLease(run))) {
    throw new Error("Stop and reconcile active or unknown work before deferring this task. Its execution lease remains owned.");
  }
}
export function applyTaskTriageEvent(project: ProjectSnapshot, event: TaskTriageEvent): ProjectSnapshot {
  const action = event.action, revision = project.revision + 1;
  if (action.kind === "propose-task-triage") {
    if (!project.tasks.some(task => task.taskId === action.taskId) || action.basedOnTriageRevision !== taskTriageRevision(project, action.taskId)) invalid();
    const proposal: TaskTriageProposal = { proposalId: `triage-proposal:${event.commandId}`, taskId: action.taskId, recordedAtRevision: revision, basedOnTriageRevision: action.basedOnTriageRevision, desired: action.desired, rationale: action.rationale, origin: action.origin };
    if (project.taskTriage.proposals.some(item => item.proposalId === proposal.proposalId)) invalid();
    return { ...project, revision, taskTriage: { ...project.taskTriage, proposals: [...project.taskTriage.proposals, proposal] } };
  }
  let taskId: string, proposalId: string, desired: TaskTriageValue, reversedDecisionId: string | null;
  if (action.kind === "adopt-task-triage") {
    const proposal = project.taskTriage.proposals.find(item => item.proposalId === action.proposalId && item.recordedAtRevision === action.proposalRevision);
    if (!proposal || proposal.basedOnTriageRevision !== action.triageRevision || taskTriageRevision(project, proposal.taskId) !== action.triageRevision) invalid();
    taskId = proposal.taskId; proposalId = proposal.proposalId; desired = proposal.desired; reversedDecisionId = null;
  } else {
    const decision = latestTaskTriageDecision(project, action.taskId);
    if (!decision || decision.reversedDecisionId !== null || decision.decisionId !== action.decisionId || decision.recordedAtRevision !== action.triageRevision) invalid();
    taskId = action.taskId; proposalId = decision.proposalId; desired = decision.previous; reversedDecisionId = decision.decisionId;
  }
  availableForChange(project, taskId, desired);
  const decision: TaskTriageDecision = { decisionId: `triage-decision:${event.commandId}`, taskId, recordedAtRevision: revision, proposalId, previous: currentTaskTriage(project, taskId), adopted: desired, reversedDecisionId };
  if (project.taskTriage.decisions.some(item => item.decisionId === decision.decisionId)) invalid();
  return { ...project, revision, taskTriage: { ...project.taskTriage, decisions: [...project.taskTriage.decisions, decision] } };
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function fields(value: unknown, keys: readonly string[]): Record<string, unknown> { if (!record(value) || Object.keys(value).length !== keys.length || !Object.keys(value).every(key => keys.includes(key))) invalid(); return value; }
function text(value: unknown, max = 2048): string { if (typeof value !== "string" || !value.trim() || value.length > max) invalid(); return value; }
function revision(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) invalid(); return value; }
function nullableRevision(value: unknown): number | null { return value === null ? null : revision(value); }
function triageValue(value: unknown): TaskTriageValue {
  const row = fields(value, ["priority", "disposition"]);
  if (row.priority !== "high" && row.priority !== "normal" && row.priority !== "low") invalid();
  if (!record(row.disposition)) invalid();
  if (row.disposition.kind === "available") { fields(row.disposition, ["kind"]); return { priority: row.priority, disposition: { kind: "available" } }; }
  const disposition = fields(row.disposition, ["kind", "reason"]); if (disposition.kind !== "deferred") invalid();
  return { priority: row.priority, disposition: { kind: "deferred", reason: text(disposition.reason, 4000) } };
}
export function parseTaskTriageAction(value: unknown): TaskTriageAction | undefined {
  if (!record(value)) return;
  switch (value.kind) {
    case "propose-task-triage": {
      const row = fields(value, ["kind", "taskId", "basedOnTriageRevision", "desired", "rationale", "origin"]);
      const origin = fields(row.origin, ["kind"]); if (origin.kind !== "user") invalid();
      return { kind: value.kind, taskId: text(row.taskId), basedOnTriageRevision: nullableRevision(row.basedOnTriageRevision), desired: triageValue(row.desired), rationale: text(row.rationale, 4000), origin: { kind: "user" } };
    }
    case "adopt-task-triage": {
      const row = fields(value, ["kind", "proposalId", "proposalRevision", "triageRevision"]);
      return { kind: value.kind, proposalId: text(row.proposalId), proposalRevision: revision(row.proposalRevision), triageRevision: nullableRevision(row.triageRevision) };
    }
    case "reverse-task-triage": {
      const row = fields(value, ["kind", "taskId", "decisionId", "triageRevision"]);
      return { kind: value.kind, taskId: text(row.taskId), decisionId: text(row.decisionId), triageRevision: revision(row.triageRevision) };
    }
    default: return;
  }
}
export function parseTaskTriageEvent(value: unknown): TaskTriageEvent | undefined {
  if (!record(value) || value.kind !== "task-triage-recorded") return;
  const row = fields(value, ["kind", "commandId", "action"]), action = parseTaskTriageAction(row.action); if (!action) invalid();
  return { kind: "task-triage-recorded", commandId: text(row.commandId), action };
}
