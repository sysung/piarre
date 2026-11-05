import { sourceCollectionVersion, parseSuppliedSources } from "./supplied-source.js";
import type { ProjectSnapshot } from "./index.js";
import { resolveRecordReference } from "./inspection.js";
import type { ConversationSource } from "./conversation.js";

export interface LinkedIdea {
  readonly ideaId: string;
  readonly parentTaskId: string;
  readonly parentObjective: string;
  readonly text: string;
  readonly returnPoint: string;
  readonly capturedRevision: number;
  readonly returnedAt: number | null;
}
export interface WorkerSpec {
  readonly assignmentId: string;
  readonly role: "investigation" | "review";
  readonly purpose: string;
  readonly scope: string;
  readonly requestedModel: string;
  readonly provider: "codex-read-only";
  readonly serviceTierForTurn: "default";
  readonly permissions: "supplied-sources-only";
}
export interface Steering {
  readonly messageId: string;
  readonly text: string;
}
export type WorkerSession = { readonly kind: "unacknowledged" }
  | { readonly kind: "thread"; readonly threadId: string }
  | { readonly kind: "turn"; readonly threadId: string; readonly turnId: string };
export type WorkerState = { readonly kind: "queued" }
  | { readonly kind: "active"; readonly session: WorkerSession; readonly stopRequested: boolean; readonly deliveredMessageIds: readonly string[] }
  | { readonly kind: "terminal"; readonly session: WorkerSession; readonly outcome: "completed" | "interrupted" | "failed" | "unknown"; readonly observation: string; readonly sourceIndexes: readonly number[]; readonly uncertaintyReviewedAt: number | null; readonly deliveredMessageIds: readonly string[] };
export interface Assignment extends WorkerSpec {
  readonly steering: readonly Steering[];
  readonly providerObservation: { readonly model: string | null; readonly provider: string | null; readonly serviceTier: string | null };
  readonly state: WorkerState;
  readonly latestObservationAt: number;
}
export interface CoordinationGroup {
  readonly parentContext?: CoordinationParentContext;
  readonly ideaId: string | null;
  readonly ideaContext: LinkedIdea | null;
  readonly groupId: string;
  readonly requestId: string;
  readonly parentTaskId: string;
  readonly parentObjective: string;
  readonly parentPlanVersion: number;
  readonly sources: readonly ConversationSource[];
  readonly durationMs: number;
  readonly maxTokens: number;
  readonly preparedAtRevision: number;
  readonly sourceCollectionVersion: string;
  readonly comparison: { readonly kind: "not-recorded" } | { readonly kind: "recorded"; readonly verdict: "agreement" | "disagreement" | "mixed"; readonly explanation: string; readonly assignmentIds: readonly string[]; readonly observedAt: number };
  readonly approval: { readonly kind: "unapproved" } | { readonly kind: "approved"; readonly approvalId: string; readonly observedAt: number };
  readonly assignments: readonly Assignment[];
}
export interface CoordinationParentContext {
  readonly version: 1;
  readonly proposalRevision: number;
  readonly task: import("./index.js").ProposedTask;
}

export function captureCoordinationParent(snapshot: ProjectSnapshot, taskId: string): CoordinationParentContext {
  const task = snapshot.tasks.find(task => task.taskId === taskId);
  const proposal = snapshot.proposals.find(proposal => proposal.groupId === task?.groupId);
  if (!task || !proposal) throw new Error("Choose a current parent task");
  return { version: 1, proposalRevision: proposal.recordedAtRevision, task };
}

export function assertCoordinationContextBound(parent: CoordinationParentContext, sources: readonly ConversationSource[]): void {
  const bytes = (text: string) => Array.from(text).reduce((count, character) => {
    const code = character.codePointAt(0) ?? 0;
    return count + (code > 0xffff ? 4 : code > 0x7ff ? 3 : code > 0x7f ? 2 : 1);
  }, 0);
  if (sources.length > 20 || sources.some(source => bytes(source.text) > 10_000) || bytes(JSON.stringify({ parentContext: parent, sources })) > 60_000) {
    throw new Error("Investigation context exceeds 20 sources, 10,000 bytes per excerpt or 60,000 UTF-8 bytes including parent details. Narrow the task or supplied files; required context was not dropped.");
  }
}
export interface CoordinationState {
  readonly ideas: readonly LinkedIdea[];
  readonly groups: readonly CoordinationGroup[];
}
type Operation =
  | { readonly operation: "capture-idea"; readonly ideaId: string; readonly parentTaskId: string; readonly text: string; readonly returnPoint: string }
  | { readonly operation: "return-idea"; readonly ideaId: string; readonly observedAt: number }
  | { readonly operation: "prepare"; readonly parentContextVersion?: 1; readonly ideaId: string | null; readonly groupId: string; readonly requestId: string; readonly parentTaskId: string; readonly sources: readonly ConversationSource[]; readonly workers: readonly WorkerSpec[]; readonly durationMs: number; readonly maxTokens: number }
  | { readonly operation: "approve"; readonly groupId: string; readonly preparedAtRevision: number; readonly approvalId: string; readonly observedAt: number; readonly consent: "unknown-cost-and-shared-context" }
  | { readonly operation: "compare"; readonly groupId: string; readonly verdict: "agreement" | "disagreement" | "mixed"; readonly explanation: string; readonly assignmentIds: readonly string[]; readonly observedAt: number }
  | { readonly operation: "review-unknown"; readonly groupId: string; readonly assignmentId: string; readonly observedAt: number }
  | { readonly operation: "steer"; readonly groupId: string; readonly assignmentId: string; readonly messageId: string; readonly text: string; readonly observedAt: number }
  | { readonly operation: "start"; readonly groupId: string; readonly assignmentId: string; readonly observedAt: number }
  | { readonly operation: "stop"; readonly groupId: string; readonly assignmentId: string; readonly observedAt: number }
  | { readonly operation: "provider"; readonly groupId: string; readonly assignmentId: string; readonly model: string | null; readonly provider: string | null; readonly serviceTier: string | null; readonly observedAt: number }
  | { readonly operation: "session"; readonly groupId: string; readonly assignmentId: string; readonly session: WorkerSession; readonly observedAt: number }
  | { readonly operation: "finish"; readonly groupId: string; readonly assignmentId: string; readonly outcome: "completed" | "interrupted" | "failed" | "unknown"; readonly observation: string; readonly sourceIndexes: readonly number[]; readonly observedAt: number };
export type CoordinationAction = { readonly kind: "coordinate" } & Operation;
export interface CoordinationEvent { readonly kind: "coordination-recorded"; readonly commandId: string; readonly action: CoordinationAction }

export function assertCoordinationCurrent(snapshot: ProjectSnapshot, group: CoordinationGroup): void {
  if (sourceCollectionVersion(snapshot) !== group.sourceCollectionVersion) throw new Error("Parent or project source collection changed; prepare fresh context");
  const task = snapshot.tasks.find(task => task.taskId === group.parentTaskId);
  if (group.parentContext) {
    if (JSON.stringify(captureCoordinationParent(snapshot, group.parentTaskId)) !== JSON.stringify(group.parentContext)) throw new Error("Parent task details changed; prepare fresh context");
    assertCoordinationContextBound(group.parentContext, group.sources);
  }
  if (!task || task.title !== group.parentObjective || task.planVersion !== group.parentPlanVersion || group.sources.some(source => {
    if (source.reference.kind === "file") return source.reference.projectId !== snapshot.projectId || source.reference.revision > snapshot.revision;
    const resolved = resolveRecordReference(snapshot, source.reference);
    return resolved.kind !== "resolved" || resolved.text !== source.text;
  })) throw new Error("Parent or supplied sources changed; prepare and approve a fresh assignment");
}
export function applyCoordinationEvent(snapshot: ProjectSnapshot, event: CoordinationEvent): ProjectSnapshot {
  const action = event.action;
  const revision = snapshot.revision + 1;
  const state = snapshot.coordination;
  const save = (coordination: CoordinationState): ProjectSnapshot => ({ ...snapshot, revision, coordination });
  if (action.operation === "capture-idea") {
    const parent = snapshot.tasks.find(task => task.taskId === action.parentTaskId);
    if (!parent || state.ideas.some(idea => idea.ideaId === action.ideaId)) throw new Error("Unknown parent or duplicate idea");
    return save({ ...state, ideas: [...state.ideas, { ideaId: action.ideaId, parentTaskId: parent.taskId, parentObjective: parent.title,
      text: action.text, returnPoint: action.returnPoint, capturedRevision: revision, returnedAt: null }] });
  }
  if (action.operation === "return-idea") {
    if (!state.ideas.some(idea => idea.ideaId === action.ideaId && idea.returnedAt === null)) throw new Error("Idea unavailable or already returned");
    return save({ ...state, ideas: state.ideas.map(idea => idea.ideaId === action.ideaId ? { ...idea, returnedAt: action.observedAt } : idea) });
  }
  if (action.operation === "prepare") {
    const parent = snapshot.tasks.find(task => task.taskId === action.parentTaskId);
    if (!parent || state.groups.some(group => group.groupId === action.groupId || group.requestId === action.requestId) ||
      action.workers.some(worker => state.groups.some(group => group.assignments.some(item => item.assignmentId === worker.assignmentId)))) throw new Error("Unknown parent or reused request/assignment");
    if (action.ideaId !== null && !state.ideas.some(idea => idea.ideaId === action.ideaId && idea.parentTaskId === parent.taskId)) throw new Error("Linked idea does not belong to this parent");
    const group: CoordinationGroup = { ideaId: action.ideaId, ideaContext: state.ideas.find(idea => idea.ideaId === action.ideaId) ?? null, groupId: action.groupId, requestId: action.requestId, parentTaskId: parent.taskId, parentObjective: parent.title,
      parentPlanVersion: parent.planVersion, ...(action.parentContextVersion === 1 && { parentContext: captureCoordinationParent(snapshot, parent.taskId) }), sources: parseSuppliedSources(action.sources), sourceCollectionVersion: sourceCollectionVersion(snapshot), durationMs: action.durationMs, maxTokens: action.maxTokens,
      preparedAtRevision: revision, comparison: { kind: "not-recorded" }, approval: { kind: "unapproved" }, assignments: action.workers.map(worker => ({ ...worker, steering: [], providerObservation: { model: null, provider: null, serviceTier: null }, state: { kind: "queued" }, latestObservationAt: 0 })) };
    assertCoordinationCurrent(snapshot, group);
    return save({ ...state, groups: [...state.groups, group] });
  }
  const group = state.groups.find(group => group.groupId === action.groupId);
  if (!group) throw new Error("Unknown coordination group");
  const replace = (next: CoordinationGroup) => save({ ...state, groups: state.groups.map(item => item === group ? next : item) });
  if (action.operation === "approve") {
    if (state.groups.some(item => item.assignments.some(worker => worker.state.kind === "terminal" && worker.state.outcome === "unknown" && worker.state.uncertaintyReviewedAt === null))) throw new Error("Review prior unconfirmed activity before approving more spending");
    if (state.groups.flatMap(item => item.assignments).filter(worker => worker.state.kind === "active").length + group.assignments.length > 3) throw new Error("Global read-only fanout limit is 3");
    if (snapshot.schedulingPaused || group.approval.kind !== "unapproved" || group.preparedAtRevision !== action.preparedAtRevision) throw new Error("Approval is stale or scheduling paused");
    assertCoordinationCurrent(snapshot, group);
    return replace({ ...group, approval: { kind: "approved", approvalId: action.approvalId, observedAt: action.observedAt } });
  }
  if (action.operation === "compare") {
    if (action.assignmentIds.length < 2 || new Set(action.assignmentIds).size !== action.assignmentIds.length || action.assignmentIds.some(id => !group.assignments.some(worker => worker.assignmentId === id && worker.state.kind === "terminal" && worker.state.outcome === "completed"))) throw new Error("Comparison requires at least two completed sourced findings");
    return replace({ ...group, comparison: { kind: "recorded", verdict: action.verdict, explanation: action.explanation, assignmentIds: action.assignmentIds, observedAt: action.observedAt } });
  }
  const worker = group.assignments.find(worker => worker.assignmentId === action.assignmentId);
  if (!worker) throw new Error("Unknown assignment");
  let next: Assignment;
  if (action.operation === "review-unknown") {
    if (worker.state.kind !== "terminal" || worker.state.outcome !== "unknown" || worker.state.uncertaintyReviewedAt !== null) throw new Error("No unresolved unknown assignment");
    next = { ...worker, state: { ...worker.state, uncertaintyReviewedAt: action.observedAt }, latestObservationAt: action.observedAt };
  } else if (action.operation === "steer") {
    if (worker.state.kind !== "queued" || group.approval.kind !== "unapproved" || worker.steering.some(message => message.messageId === action.messageId)) throw new Error("Steering requires an unapproved queued assignment; stop active work and approve a new assignment");
    next = { ...worker, steering: [...worker.steering, { messageId: action.messageId, text: action.text }], latestObservationAt: action.observedAt };
  } else if (action.operation === "start") {
    assertCoordinationCurrent(snapshot, group);
    if (snapshot.schedulingPaused || group.approval.kind !== "approved" || worker.state.kind !== "queued" ||
      state.groups.flatMap(group => group.assignments).filter(worker => worker.state.kind === "active").length >= 3) throw new Error("Assignment is unapproved, already requested, paused or fanout limit reached");
    next = { ...worker, state: { kind: "active", session: { kind: "unacknowledged" }, stopRequested: false, deliveredMessageIds: [] }, latestObservationAt: action.observedAt };
  } else if (action.operation === "provider") {
    if (worker.state.kind !== "active") throw new Error("Assignment is no longer active");
    next = { ...worker, providerObservation: { model: action.model, provider: action.provider, serviceTier: action.serviceTier }, latestObservationAt: action.observedAt };
  } else if (action.operation === "finish") {
    if (worker.state.kind !== "active") throw new Error("Assignment is no longer active");
    if (action.outcome === "completed" && (worker.state.session.kind !== "turn" || action.sourceIndexes.length === 0 || action.sourceIndexes.some(index => !group.sources[index]))) throw new Error("Findings require an observed turn and available source evidence");
    if (action.outcome !== "completed" && action.sourceIndexes.length !== 0) throw new Error("Failed work cannot supply accepted findings");
    next = { ...worker, state: { kind: "terminal", session: worker.state.session, outcome: action.outcome, observation: action.observation, sourceIndexes: action.sourceIndexes, uncertaintyReviewedAt: null, deliveredMessageIds: worker.state.deliveredMessageIds }, latestObservationAt: action.observedAt };
  } else {
    if (worker.state.kind !== "active") throw new Error("Assignment is no longer active");
    if (action.operation === "stop") next = { ...worker, state: { ...worker.state, stopRequested: true }, latestObservationAt: action.observedAt };
    else {
      const prior = worker.state.session;
      if (action.session.kind === "unacknowledged" || prior.kind === "turn" ||
        (prior.kind === "thread" && action.session.threadId !== prior.threadId)) throw new Error("Invalid provider session correlation");
      next = { ...worker, state: { ...worker.state, session: action.session, deliveredMessageIds: action.session.kind === "turn" ? worker.steering.map(message => message.messageId) : worker.state.deliveredMessageIds }, latestObservationAt: action.observedAt };
    }
  }
  return replace({ ...group, ...(action.operation === "steer" ? { preparedAtRevision: revision } : {}), assignments: group.assignments.map(item => item === worker ? next : item) });
}
