import { applyTaskTriageEvent, type TaskTriageAction, type TaskTriageEvent, type TaskTriageState } from "./task-triage.js";
export { currentTaskTriage, taskTriageRevision, latestTaskTriageDecision, orderedTriageTasks } from "./task-triage.js";
export type { TaskTriageAction, TaskTriageEvent, TaskTriageValue, TaskTriageProposal, TaskTriageDecision } from "./task-triage.js";
import { applyCoordinationEvent, type CoordinationAction, type CoordinationEvent, type CoordinationState } from "./coordination.js";
export type { CoordinationAction, CoordinationGroup, Assignment, LinkedIdea } from "./coordination.js";
import { applyReflectionEvent, type Reflection, type ReflectionAction, type ReflectionEvent, type ExplanationPreference, type ExpertisePreference } from "./reflection.js";
export { renderReflection, reflectionArtifactPath, reflectionDrift } from "./reflection.js";
export type { Reflection, ReflectionAction, ExplanationPreference, ExpertisePreference } from "./reflection.js";
import { applyExecutionEvent, ownsExecutionLease, type ExecutionAction, type ExecutionEvent, type ExecutionPlan, type ExecutionRun } from "./execution.js";
export { currentExecutionPlan, planFreshness, executionDependenciesReady, hasUncertainProvider, ownsExecutionLease } from "./execution.js";
export type { ExecutionAction, ExecutionEvent, ExecutionPlan, ExecutionPlanDraft, ExecutionRun, ExecutionResult, ExecutionCheck, CheckEvidence } from "./execution.js";
import { applyKnowledgeEvent, knowledgeEvent, type KnowledgeAction, type KnowledgeEvent, type RecordedKnowledge, type KnowledgeImpact } from "./knowledge.js";
export { currentKnowledge, knowledgeConflicts } from "./knowledge.js";
export type { RecordedKnowledge, KnowledgeImpact, KnowledgeAction, KnowledgeEvent } from "./knowledge.js";
export { parseProposalOutput, parseProjectEvent, validateProjectCommand } from "./contracts.js";
export { parseSubmittedStatement, parseInterpretationOutput, parseKnowledgeCorrection } from "./context.js";
export type { SubmittedStatement, KnowledgeSource, SourcedText, Interpretation, KnowledgeVersion, KnowledgeEntry, KnowledgeCorrection } from "./context.js";
import { applyConversationEvent, conversationEvent, defaultSessionId, type ConversationSession, type ConversationAction, type ConversationEvent, type ConversationTurn } from "./conversation.js";
export { conversationHistory, defaultSessionId } from "./conversation.js";
export type { ConversationAction, ConversationEvent, ConversationTurn, ConversationSource, ConversationSession, SessionAction } from "./conversation.js";

export interface ProjectSnapshot {
  readonly projectId: string;
  readonly repositoryUri: string;
  readonly name: string;
  readonly revision: number;
  readonly proposals: readonly RecordedProposalGroup[];
  readonly tasks: readonly ProposedTask[];
  readonly taskTriage: TaskTriageState;
  readonly sessions: readonly ConversationSession[];
  readonly conversation: readonly ConversationTurn[];
  readonly coordination: CoordinationState;
  readonly knowledge: readonly RecordedKnowledge[];
  readonly knowledgeImpacts: readonly KnowledgeImpact[];
  readonly executionPlans: readonly ExecutionPlan[];
  readonly executionRuns: readonly ExecutionRun[];
  readonly schedulingPaused: boolean;
  readonly reflections: readonly Reflection[];
  readonly explanationPreference: ExplanationPreference;
  readonly expertisePreference: ExpertisePreference;
}

export interface ProposalRequirement {
  readonly key: string;
  readonly text: string;
}

export interface ProposalCheck {
  readonly key: string;
  readonly requirementKeys: readonly string[];
  readonly description: string;
}

export interface ProposedScope {
  readonly included: readonly string[];
  readonly excluded: readonly string[];
}

export interface ProposedBudget {
  readonly maxAttempts: number;
  readonly maxElapsedMinutes: number;
  readonly maxTokens: number;
}

export interface ProposalTaskDraft {
  readonly key: string;
  readonly title: string;
  readonly requirements: readonly ProposalRequirement[];
  readonly proposedScope: ProposedScope;
  readonly checks: readonly ProposalCheck[];
  readonly proposedBudget: ProposedBudget;
  readonly dependsOn: readonly string[];
}

export interface ProposalDraft {
  readonly goal: string;
  readonly source: "deterministic-draft";
  readonly tasks: readonly ProposalTaskDraft[];
}

export interface ProposalGroup {
  readonly sessionId?: string;
  readonly groupId: string;
  readonly goal: string;
  readonly source: "deterministic-draft";
  readonly taskIds: readonly string[];
}

export interface RecordedProposalGroup extends ProposalGroup {
  readonly recordedAtRevision: number;
}

export interface ProposedTask extends Omit<ProposalTaskDraft, "key" | "dependsOn"> {
  readonly taskId: string;
  readonly groupId: string;
  readonly planVersion: 1;
  readonly state: { readonly kind: "unapproved" };
  readonly dependsOn: readonly string[];
}

export interface ProjectCommand {
  readonly commandId: string;
  readonly projectId: string;
  readonly expectedProjectRevision: number;
  readonly action: TaskTriageAction | CoordinationAction | ConversationAction | KnowledgeAction | ExecutionAction | ReflectionAction
    | { readonly kind: "rename-project"; readonly name: string }
    | { readonly kind: "delete-proposal"; readonly groupId: string }
    | { readonly kind: "propose-tasks"; readonly draft: ProposalDraft; readonly sessionId?: string };
}

export type ProjectEvent = TaskTriageEvent | CoordinationEvent | ConversationEvent | KnowledgeEvent | ExecutionEvent | ReflectionEvent
  | {
      readonly kind: "project-created";
      readonly projectId: string;
      readonly repositoryUri: string;
      readonly name: string;
    }
  | { readonly kind: "proposal-deleted"; readonly groupId: string }
  | { readonly kind: "project-renamed"; readonly name: string }
  | {
      readonly kind: "proposal-created";
      readonly group: ProposalGroup;
      readonly tasks: readonly ProposedTask[];
    };

export type CommandResult =
  | {
      readonly kind: "applied" | "duplicate";
      readonly snapshot: ProjectSnapshot;
    }
  | { readonly kind: "stale"; readonly actualRevision: number }
  | { readonly kind: "command-conflict" | "wrong-project" };

export function replay(events: readonly ProjectEvent[]): ProjectSnapshot {
  let snapshot: ProjectSnapshot | undefined;
  for (const event of events) {
    if (event.kind === "project-created") {
      if (snapshot)
        throw new Error("Invalid project history: repeated creation");
      snapshot = {
        projectId: event.projectId,
        repositoryUri: event.repositoryUri,
        name: event.name,
        revision: 1,
        proposals: [],
        tasks: [],
        taskTriage: { proposals: [], decisions: [] },
        sessions: [{ id: defaultSessionId, title: "Project chat" }],
        conversation: [],
        coordination: { ideas: [], groups: [] },
        knowledge: [],
        knowledgeImpacts: [],
        executionPlans: [],
        executionRuns: [],
        schedulingPaused: false,
        reflections: [],
        explanationPreference: "default",
        expertisePreference: "unspecified",
      };
      continue;
    }
    if (!snapshot) throw new Error("Invalid project history: missing creation");
    switch (event.kind) {
      case "task-triage-recorded": snapshot = applyTaskTriageEvent(snapshot, event); break;
      case "coordination-recorded":
        snapshot = applyCoordinationEvent(snapshot, event); break;
      case "reflection-recorded":
        snapshot = applyReflectionEvent(snapshot, event); break;
      case "execution-recorded":
        snapshot = applyExecutionEvent(snapshot, event); break;
      case "knowledge-observed":
      case "knowledge-confirmed":
      case "knowledge-corrected":
        snapshot = applyKnowledgeEvent(snapshot, event);
        break;
      case "session-recorded":
      case "conversation-started":
      case "conversation-replied":
      case "conversation-ended":
        snapshot = applyConversationEvent(snapshot, event);
        break;
      case "project-renamed":
        snapshot = {
          ...snapshot,
          name: event.name,
          revision: snapshot.revision + 1,
        };
        break;
      case "proposal-deleted": {
        const currentTasks = snapshot.tasks;
        if (snapshot.executionRuns.some(run => ownsExecutionLease(run) && currentTasks.some(task => task.taskId === run.grant.plan.taskId && task.groupId === event.groupId))) throw new Error("Stop and reconcile active work before deleting its proposal");
        if (!snapshot.proposals.some(proposal => proposal.groupId === event.groupId)) throw new Error("Invalid project history: unknown proposal deletion");
        snapshot = { ...snapshot, revision: snapshot.revision + 1,
          proposals: snapshot.proposals.filter(proposal => proposal.groupId !== event.groupId),
          tasks: snapshot.tasks.filter(task => task.groupId !== event.groupId) };
        break;
      }
      case "proposal-created": {
        const knownGroups = new Set(snapshot.proposals.map(({ groupId }) => groupId));
        const knownTasks = new Set(snapshot.tasks.map(({ taskId }) => taskId));
        if (
          (event.group.sessionId !== undefined && !snapshot.sessions.some(session => session.id === event.group.sessionId && !session.archived)) ||
          knownGroups.has(event.group.groupId) ||
          event.tasks.length === 0 ||
          event.group.taskIds.length !== event.tasks.length
        )
          throw new Error("Invalid project history: proposal identity");
        const eventTaskIds = new Set(event.tasks.map(({ taskId }) => taskId));
        if (
          eventTaskIds.size !== event.tasks.length ||
          event.group.taskIds.some((taskId) => !eventTaskIds.has(taskId)) ||
          event.tasks.some(
            (task) =>
              task.groupId !== event.group.groupId ||
              knownTasks.has(task.taskId) ||
              task.dependsOn.some((taskId) => !eventTaskIds.has(taskId)),
          )
        )
          throw new Error("Invalid project history: proposal membership");
        snapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          proposals: [...snapshot.proposals, { ...event.group, recordedAtRevision: snapshot.revision + 1 }],
          tasks: [...snapshot.tasks, ...event.tasks],
        };
        break;
      }
      default: {
        const exhaustive: never = event;
        throw new Error(`Invalid project history: ${String(exhaustive)}`);
      }
    }
  }
  if (!snapshot) throw new Error("Invalid project history: empty log");
  return snapshot;
}

export function decideProjectEvent(command: ProjectCommand): ProjectEvent {
  switch (command.action.kind) {
    case "propose-task-triage":
    case "adopt-task-triage":
    case "reverse-task-triage":
      return { kind: "task-triage-recorded", commandId: command.commandId, action: command.action };
    case "coordinate": return { kind: "coordination-recorded", commandId: command.commandId, action: command.action };
    case "offer-reflection":
    case "correct-reflection":
    case "resolve-reflection":
    case "set-expertise-preference":
    case "set-explanation-preference":
      return { kind: "reflection-recorded", commandId: command.commandId, action: command.action };
    case "register-retained-version":
    case "begin-recovery":
    case "finish-recovery":
    case "mark-recovery-unknown":
    case "prepare-execution-plan":
    case "approve-execution":
    case "request-execution":
    case "record-execution-account-observation":
    case "observe-execution-provider":
    case "bind-execution-thread":
    case "bind-execution-turn":
    case "observe-execution-terminal":
    case "abandon-execution-provider":
    case "begin-candidate-apply":
    case "begin-execution-check":
    case "bind-check-process":
    case "record-execution-check":
    case "mark-execution-unknown":
    case "reconcile-execution-process":
    case "finish-execution":
    case "accept-execution-result":
    case "begin-workspace-operation":
    case "finish-workspace-operation":
    case "abandon-workspace-operation":
    case "mark-workspace-unknown":
    case "invalidate-execution-workspace":
    case "set-scheduling-paused":
      return { kind: "execution-recorded", commandId: command.commandId, action: command.action };
    case "observe-knowledge":
    case "confirm-knowledge":
    case "correct-knowledge":
      return knowledgeEvent(command.action, command.commandId);
    case "create-session":
    case "rename-session":
    case "archive-session":
    case "begin-conversation":
    case "record-conversation-reply":
    case "end-conversation":
      return conversationEvent(command.action);
    case "rename-project":
      return { kind: "project-renamed", name: command.action.name };
    case "delete-proposal":
      return { kind: "proposal-deleted", groupId: command.action.groupId };
    case "propose-tasks": {
      const encodedCommandId = encodeURIComponent(command.commandId);
      const groupId = `proposal:${encodedCommandId}`;
      const taskIds = new Map(
        command.action.draft.tasks.map(({ key }) => [
          key,
          `task:${encodedCommandId}:${encodeURIComponent(key)}`,
        ]),
      );
      const tasks = command.action.draft.tasks.map((task): ProposedTask => {
        const taskId = taskIds.get(task.key);
        if (!taskId) throw new Error("Invalid project command");
        return {
          taskId,
          groupId,
          planVersion: 1,
          state: { kind: "unapproved" },
          title: task.title,
          requirements: task.requirements,
          proposedScope: task.proposedScope,
          checks: task.checks,
          proposedBudget: task.proposedBudget,
          dependsOn: task.dependsOn.map((key) => {
            const dependency = taskIds.get(key);
            if (!dependency) throw new Error("Invalid project command");
            return dependency;
          }),
        };
      });
      return {
        kind: "proposal-created",
        group: {
          groupId,
          goal: command.action.draft.goal,
          ...(command.action.sessionId && { sessionId: command.action.sessionId }),
          source: command.action.draft.source,
          taskIds: tasks.map(({ taskId }) => taskId),
        },
        tasks,
      };
    }
  }
}
