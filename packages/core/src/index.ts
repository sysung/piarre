export interface ProjectSnapshot {
  readonly projectId: string;
  readonly repositoryUri: string;
  readonly name: string;
  readonly revision: number;
  readonly proposals: readonly ProposalGroup[];
  readonly tasks: readonly ProposedTask[];
  readonly grants: readonly ExecutionGrant[];
  readonly runs: readonly TaskRun[];
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

export interface ProposedTask extends Omit<ProposalTaskDraft, "key" | "dependsOn"> {
  readonly taskId: string;
  readonly groupId: string;
  readonly planVersion: 1;
  readonly state:
    | { readonly kind: "unapproved" }
    | { readonly kind: "approved"; readonly approvalId: string };
  readonly dependsOn: readonly string[];
}

export interface ApprovedCommand {
  readonly argv: readonly [string, ...string[]];
}

export interface ExecutionGrant {
  readonly approvalId: string;
  readonly taskId: string;
  readonly planVersion: 1;
  readonly repositoryRoot: string;
  readonly writableRoot: string;
  readonly commands: readonly ApprovedCommand[];
  readonly budget: ProposedBudget;
}

function isCanonicalAbsolutePath(value: string): boolean {
  const separator = value.includes("\\") ? "\\" : "/";
  const absolute =
    value.startsWith("/") || /^[A-Za-z]:\\/.test(value);
  if (!absolute || (separator === "/" && value.includes("\\"))) return false;
  const parts = value.split(separator);
  return parts.every(
    (part, index) => index === 0 || (part !== "" && part !== "." && part !== ".."),
  );
}

function containsPath(parent: string, child: string): boolean {
  const separator = parent.includes("\\") ? "\\" : "/";
  if (child.includes(separator === "/" ? "\\" : "/")) return false;
  if (parent === child) return true;
  return child.startsWith(parent.endsWith(separator) ? parent : `${parent}${separator}`);
}

export function isExecutionGrantForTask(
  grant: ExecutionGrant,
  task: ProposedTask,
): boolean {
  return (
    grant.taskId === task.taskId &&
    isCanonicalAbsolutePath(grant.repositoryRoot) &&
    isCanonicalAbsolutePath(grant.writableRoot) &&
    containsPath(grant.repositoryRoot, grant.writableRoot) &&
    grant.commands.length > 0 &&
    grant.commands.every(
      ({ argv }) =>
        argv.length > 0 && argv.every((argument) => argument.length > 0),
    ) &&
    grant.budget.maxAttempts === task.proposedBudget.maxAttempts &&
    grant.budget.maxElapsedMinutes === task.proposedBudget.maxElapsedMinutes &&
    grant.budget.maxTokens === task.proposedBudget.maxTokens
  );
}

export type TaskRun = {
  readonly runId: string;
  readonly taskId: string;
  readonly approvalId: string;
  readonly adapterId: string;
  readonly externalRunId?: string;
} & (
  | { readonly state: "reserved" | "running" | "reconciliation-required" }
  | { readonly state: "completed" | "failed" }
);

export type TaskStatus =
  | { readonly kind: "unapproved" }
  | { readonly kind: "approved" }
  | { readonly kind: "running"; readonly runId: string }
  | { readonly kind: "needs-verification"; readonly runId: string }
  | { readonly kind: "run-failed"; readonly runId: string }
  | { readonly kind: "reconciliation-required"; readonly runId: string };

export function taskStatus(
  snapshot: ProjectSnapshot,
  taskId: string,
): TaskStatus | undefined {
  const task = snapshot.tasks.find((candidate) => candidate.taskId === taskId);
  if (!task) return undefined;
  const run = [...snapshot.runs]
    .reverse()
    .find((candidate) => candidate.taskId === taskId);
  if (!run)
    return task.state.kind === "unapproved"
      ? { kind: "unapproved" }
      : { kind: "approved" };
  switch (run.state) {
    case "reserved":
    case "running":
      return { kind: "running", runId: run.runId };
    case "completed":
      return { kind: "needs-verification", runId: run.runId };
    case "failed":
      return { kind: "run-failed", runId: run.runId };
    case "reconciliation-required":
      return { kind: "reconciliation-required", runId: run.runId };
  }
}

export function ownsWriter(run: TaskRun): boolean {
  return (
    run.state === "reserved" ||
    run.state === "running" ||
    run.state === "reconciliation-required"
  );
}

export interface ProjectCommand {
  readonly commandId: string;
  readonly projectId: string;
  readonly expectedProjectRevision: number;
  readonly action:
    | { readonly kind: "rename-project"; readonly name: string }
    | { readonly kind: "propose-tasks"; readonly draft: ProposalDraft }
    | { readonly kind: "approve-task"; readonly grant: ExecutionGrant }
    | {
        readonly kind: "reserve-run";
        readonly runId: string;
        readonly taskId: string;
        readonly approvalId: string;
        readonly adapterId: string;
      }
    | {
        readonly kind: "bind-run";
        readonly runId: string;
        readonly externalRunId: string;
      }
    | {
        readonly kind: "finish-run";
        readonly runId: string;
        readonly outcome: "completed" | "failed" | "reconciliation-required";
      };
}

export type ProjectEvent =
  | {
      readonly kind: "project-created";
      readonly projectId: string;
      readonly repositoryUri: string;
      readonly name: string;
    }
  | { readonly kind: "project-renamed"; readonly name: string }
  | {
      readonly kind: "proposal-created";
      readonly group: ProposalGroup;
      readonly tasks: readonly ProposedTask[];
    }
  | { readonly kind: "task-approved"; readonly grant: ExecutionGrant }
  | { readonly kind: "run-reserved"; readonly run: TaskRun }
  | {
      readonly kind: "run-bound";
      readonly runId: string;
      readonly externalRunId: string;
    }
  | {
      readonly kind: "run-finished";
      readonly runId: string;
      readonly outcome: "completed" | "failed" | "reconciliation-required";
    };

export type CommandResult =
  | {
      readonly kind: "applied" | "duplicate";
      readonly snapshot: ProjectSnapshot;
    }
  | { readonly kind: "stale"; readonly actualRevision: number }
  | {
      readonly kind:
        | "command-conflict"
        | "wrong-project"
        | "task-not-ready"
        | "approval-stale"
        | "writer-busy"
        | "run-not-active"
        | "attempt-budget-exhausted";
    };

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
        grants: [],
        runs: [],
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
          proposals: [...snapshot.proposals, event.group],
          tasks: [...snapshot.tasks, ...event.tasks],
        };
        break;
      }
      case "task-approved": {
        const task = snapshot.tasks.find(
          ({ taskId }) => taskId === event.grant.taskId,
        );
        if (
          !task ||
          !isExecutionGrantForTask(event.grant, task) ||
          task.state.kind !== "unapproved" ||
          snapshot.grants.some(
            ({ approvalId }) => approvalId === event.grant.approvalId,
          )
        )
          throw new Error("Invalid project history: task approval");
        snapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          grants: [...snapshot.grants, event.grant],
          tasks: snapshot.tasks.map((candidate) =>
            candidate.taskId === task.taskId
              ? {
                  ...candidate,
                  state: {
                    kind: "approved" as const,
                    approvalId: event.grant.approvalId,
                  },
                }
              : candidate,
          ),
        };
        break;
      }
      case "run-reserved": {
        const task = snapshot.tasks.find(
          ({ taskId }) => taskId === event.run.taskId,
        );
        const grant = snapshot.grants.find(
          ({ approvalId }) => approvalId === event.run.approvalId,
        );
        if (
          !task ||
          task.state.kind !== "approved" ||
          task.state.approvalId !== event.run.approvalId ||
          !grant ||
          grant.taskId !== task.taskId ||
          event.run.state !== "reserved" ||
          event.run.externalRunId !== undefined ||
          snapshot.runs.some(({ runId }) => runId === event.run.runId) ||
          snapshot.runs.some(ownsWriter)
        )
          throw new Error("Invalid project history: run reservation");
        snapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          runs: [...snapshot.runs, event.run],
        };
        break;
      }
      case "run-bound": {
        const run = snapshot.runs.find(({ runId }) => runId === event.runId);
        if (!run || run.state !== "reserved" || run.externalRunId)
          throw new Error("Invalid project history: run binding");
        snapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          runs: snapshot.runs.map((candidate) =>
            candidate.runId === event.runId
              ? {
                  ...candidate,
                  externalRunId: event.externalRunId,
                  state: "running" as const,
                }
              : candidate,
          ),
        };
        break;
      }
      case "run-finished": {
        const run = snapshot.runs.find(({ runId }) => runId === event.runId);
        if (
          !run ||
          !ownsWriter(run) ||
          (event.outcome === "completed" && run.state !== "running")
        )
          throw new Error("Invalid project history: run finish");
        snapshot = {
          ...snapshot,
          revision: snapshot.revision + 1,
          runs: snapshot.runs.map((candidate) =>
            candidate.runId === event.runId
              ? { ...candidate, state: event.outcome }
              : candidate,
          ),
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
    case "approve-task":
      return { kind: "task-approved", grant: command.action.grant };
    case "reserve-run":
      return {
        kind: "run-reserved",
        run: {
          runId: command.action.runId,
          taskId: command.action.taskId,
          approvalId: command.action.approvalId,
          adapterId: command.action.adapterId,
          state: "reserved",
        },
      };
    case "bind-run":
      return {
        kind: "run-bound",
        runId: command.action.runId,
        externalRunId: command.action.externalRunId,
      };
    case "finish-run":
      return {
        kind: "run-finished",
        runId: command.action.runId,
        outcome: command.action.outcome,
      };
  }
}
