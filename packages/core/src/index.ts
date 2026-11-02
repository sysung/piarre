export { parseProposalOutput, parseProjectEvent, validateProjectCommand } from "./contracts.js";
export { parseSubmittedStatement, parseInterpretationOutput, parseKnowledgeCorrection } from "./context.js";
export type { SubmittedStatement, KnowledgeSource, SourcedText, Interpretation, KnowledgeVersion, KnowledgeEntry, KnowledgeCorrection } from "./context.js";

export interface ProjectSnapshot {
  readonly projectId: string;
  readonly repositoryUri: string;
  readonly name: string;
  readonly revision: number;
  readonly proposals: readonly RecordedProposalGroup[];
  readonly tasks: readonly ProposedTask[];
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
  readonly action:
    | { readonly kind: "rename-project"; readonly name: string }
    | { readonly kind: "delete-proposal"; readonly groupId: string }
    | { readonly kind: "propose-tasks"; readonly draft: ProposalDraft };
}

export type ProjectEvent =
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
      };
      continue;
    }
    if (!snapshot) throw new Error("Invalid project history: missing creation");
    switch (event.kind) {
      case "project-renamed":
        snapshot = {
          ...snapshot,
          name: event.name,
          revision: snapshot.revision + 1,
        };
        break;
      case "proposal-deleted": {
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
          source: command.action.draft.source,
          taskIds: tasks.map(({ taskId }) => taskId),
        },
        tasks,
      };
    }
  }
}
