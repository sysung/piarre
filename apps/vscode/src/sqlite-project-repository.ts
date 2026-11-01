import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  decideProjectEvent,
  replay,
  type ProjectEvent,
  type ProjectSnapshot,
  type ProjectCommand,
  type CommandResult,
  type ProposedTask,
  type ApprovedCommand,
  type ExecutionGrant,
  type TaskRun,
  isExecutionGrantForTask,
  ownsWriter,
} from "../../../packages/core/src/index.js";

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: Record<PropertyKey, unknown>, key: string): string {
  if (!(key in value) || typeof value[key] !== "string" || !value[key])
    throw new Error("Invalid project history: malformed event");
  return value[key];
}

function readStrings(
  value: Record<PropertyKey, unknown>,
  key: string,
): readonly string[] {
  if (!(key in value) || !Array.isArray(value[key]))
    throw new Error("Invalid project history: malformed event");
  return value[key].map((item) => {
    if (typeof item !== "string" || !item)
      throw new Error("Invalid project history: malformed event");
    return item;
  });
}

function parseStoredRequirement(value: unknown) {
  if (!isRecord(value))
    throw new Error("Invalid project history: malformed event");
  return { key: readString(value, "key"), text: readString(value, "text") };
}

function parseStoredCheck(value: unknown) {
  if (!isRecord(value))
    throw new Error("Invalid project history: malformed event");
  return {
    key: readString(value, "key"),
    requirementKeys: readStrings(value, "requirementKeys"),
    description: readString(value, "description"),
  };
}

function parseStoredTask(value: unknown): ProposedTask {
  if (
    !isRecord(value) ||
    !("requirements" in value) ||
    !Array.isArray(value.requirements) ||
    !("checks" in value) ||
    !Array.isArray(value.checks) ||
    !("proposedScope" in value) ||
    !isRecord(value.proposedScope) ||
    !("proposedBudget" in value) ||
    !isRecord(value.proposedBudget) ||
    !("planVersion" in value) ||
    value.planVersion !== 1 ||
    !("state" in value) ||
    !isRecord(value.state) ||
    !("kind" in value.state) ||
    value.state.kind !== "unapproved"
  )
    throw new Error("Invalid project history: malformed event");
  const { proposedBudget } = value;
  const integer = (key: string): number => {
    if (
      !(key in proposedBudget) ||
      typeof proposedBudget[key] !== "number" ||
      !Number.isSafeInteger(proposedBudget[key]) ||
      proposedBudget[key] < 1
    )
      throw new Error("Invalid project history: malformed event");
    return proposedBudget[key];
  };
  return {
    taskId: readString(value, "taskId"),
    groupId: readString(value, "groupId"),
    planVersion: 1,
    state: { kind: "unapproved" },
    title: readString(value, "title"),
    requirements: value.requirements.map(parseStoredRequirement),
    proposedScope: {
      included: readStrings(value.proposedScope, "included"),
      excluded: readStrings(value.proposedScope, "excluded"),
    },
    checks: value.checks.map(parseStoredCheck),
    proposedBudget: {
      maxAttempts: integer("maxAttempts"),
      maxElapsedMinutes: integer("maxElapsedMinutes"),
      maxTokens: integer("maxTokens"),
    },
    dependsOn: readStrings(value, "dependsOn"),
  };
}

function readPositiveInteger(
  value: Record<PropertyKey, unknown>,
  key: string,
): number {
  const item = value[key];
  if (typeof item !== "number" || !Number.isSafeInteger(item) || item < 1)
    throw new Error("Invalid project history: malformed event");
  return item;
}

function parseStoredCommand(value: unknown): ApprovedCommand {
  if (!isRecord(value) || !Array.isArray(value.argv) || value.argv.length === 0)
    throw new Error("Invalid project history: malformed event");
  const argv = value.argv.map((item) => {
    if (typeof item !== "string" || !item)
      throw new Error("Invalid project history: malformed event");
    return item;
  });
  const [executable, ...arguments_] = argv;
  if (!executable)
    throw new Error("Invalid project history: malformed event");
  return { argv: [executable, ...arguments_] };
}

function parseStoredGrant(value: unknown): ExecutionGrant {
  if (
    !isRecord(value) ||
    value.planVersion !== 1 ||
    !Array.isArray(value.commands) ||
    !isRecord(value.budget)
  )
    throw new Error("Invalid project history: malformed event");
  return {
    approvalId: readString(value, "approvalId"),
    taskId: readString(value, "taskId"),
    planVersion: 1,
    repositoryRoot: readString(value, "repositoryRoot"),
    writableRoot: readString(value, "writableRoot"),
    commands: value.commands.map(parseStoredCommand),
    budget: {
      maxAttempts: readPositiveInteger(value.budget, "maxAttempts"),
      maxElapsedMinutes: readPositiveInteger(value.budget, "maxElapsedMinutes"),
      maxTokens: readPositiveInteger(value.budget, "maxTokens"),
    },
  };
}

function parseStoredRun(value: unknown): TaskRun {
  if (
    !isRecord(value) ||
    !("state" in value) ||
    (value.state !== "reserved" &&
      value.state !== "running" &&
      value.state !== "completed" &&
      value.state !== "failed" &&
      value.state !== "reconciliation-required")
  )
    throw new Error("Invalid project history: malformed event");
  const base = {
    runId: readString(value, "runId"),
    taskId: readString(value, "taskId"),
    approvalId: readString(value, "approvalId"),
    adapterId: readString(value, "adapterId"),
  };
  const externalRunId =
    "externalRunId" in value && typeof value.externalRunId === "string"
      ? value.externalRunId
      : undefined;
  return externalRunId
    ? { ...base, externalRunId, state: value.state }
    : { ...base, state: value.state };
}

function parseEvent(value: unknown): ProjectEvent {
  if (
    !isRecord(value) ||
    !("kind" in value) ||
    typeof value.kind !== "string"
  )
    throw new Error("Invalid project history: malformed event");
  if (value.kind === "project-renamed") {
    const name = readString(value, "name");
    return { kind: value.kind, name };
  }
  if (
    value.kind === "project-created" &&
    "projectId" in value &&
    typeof value.projectId === "string" &&
    "repositoryUri" in value &&
    typeof value.repositoryUri === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    value.name.trim()
  )
    return {
      kind: value.kind,
      projectId: value.projectId,
      repositoryUri: value.repositoryUri,
      name: value.name,
    };
  if (
    value.kind === "proposal-created" &&
    "group" in value &&
    isRecord(value.group) &&
    "tasks" in value &&
    Array.isArray(value.tasks)
  )
    return {
      kind: value.kind,
      group: {
        groupId: readString(value.group, "groupId"),
        goal: readString(value.group, "goal"),
        source: "deterministic-draft",
        taskIds: readStrings(value.group, "taskIds"),
      },
      tasks: value.tasks.map(parseStoredTask),
    };
  if (value.kind === "task-approved" && "grant" in value)
    return { kind: value.kind, grant: parseStoredGrant(value.grant) };
  if (value.kind === "run-reserved" && "run" in value)
    return { kind: value.kind, run: parseStoredRun(value.run) };
  if (value.kind === "run-bound")
    return {
      kind: value.kind,
      runId: readString(value, "runId"),
      externalRunId: readString(value, "externalRunId"),
    };
  if (
    value.kind === "run-finished" &&
    "outcome" in value &&
    (value.outcome === "completed" ||
      value.outcome === "failed" ||
      value.outcome === "reconciliation-required")
  )
    return {
      kind: value.kind,
      runId: readString(value, "runId"),
      outcome: value.outcome,
    };
  throw new Error("Invalid project history: unknown event");
}

export class SqliteProjectRepository {
  private readonly database: DatabaseSync;
  private closed = false;

  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath);
    this.database.exec(
      "PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL; CREATE TABLE IF NOT EXISTS events (revision INTEGER PRIMARY KEY, schema_version INTEGER NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS commands (command_id TEXT PRIMARY KEY, input TEXT NOT NULL, result_revision INTEGER NOT NULL REFERENCES events(revision));",
    );
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  open(input: { repositoryUri: string; name: string }): ProjectSnapshot {
    if (!input.name.trim() || !input.repositoryUri)
      throw new Error("Project identity is required");
    return this.transaction(() => {
      if (!this.database.prepare("SELECT revision FROM events LIMIT 1").get()) {
        const event: ProjectEvent = {
          kind: "project-created",
          projectId: randomUUID(),
          repositoryUri: input.repositoryUri,
          name: input.name,
        };
        this.database
          .prepare("INSERT INTO events VALUES (1, 1, ?)")
          .run(JSON.stringify(event));
      }
      const snapshot = this.read();
      if (snapshot.repositoryUri !== input.repositoryUri)
        throw new Error("Project repository identity mismatch");
      return snapshot;
    });
  }

  read(throughRevision = Number.MAX_SAFE_INTEGER): ProjectSnapshot {
    const rows = this.database
      .prepare(
        "SELECT revision, schema_version, payload FROM events WHERE revision <= ? ORDER BY revision",
      )
      .all(throughRevision);
    const events = rows.map((row, index) => {
      if (
        row.revision !== index + 1 ||
        row.schema_version !== 1 ||
        typeof row.payload !== "string"
      )
        throw new Error("Invalid project history: revision or schema");
      try {
        return parseEvent(JSON.parse(row.payload));
      } catch {
        throw new Error("Invalid project history: malformed event");
      }
    });
    return replay(events);
  }

  dispatch(command: ProjectCommand): CommandResult {
    if (
      !command.commandId ||
      !Number.isSafeInteger(command.expectedProjectRevision) ||
      command.expectedProjectRevision < 1
    )
      throw new Error("Invalid project command");
    let input: string;
    if (command.action.kind === "rename-project") {
      if (!command.action.name.trim() || command.action.name.length > 200)
        throw new Error("Invalid project command");
      input = JSON.stringify([
        command.projectId,
        command.expectedProjectRevision,
        command.action.kind,
        command.action.name,
      ]);
    } else if (command.action.kind === "propose-tasks") {
      input = JSON.stringify([
        command.projectId,
        command.expectedProjectRevision,
        command.action.kind,
        command.action.draft,
      ]);
    } else {
      input = JSON.stringify([
        command.projectId,
        command.expectedProjectRevision,
        command.action.kind,
        command.action,
      ]);
    }
    return this.transaction(() => {
      const receipt = this.database
        .prepare(
          "SELECT input, result_revision FROM commands WHERE command_id = ?",
        )
        .get(command.commandId);
      if (receipt) {
        if (receipt.input !== input) return { kind: "command-conflict" };
        if (typeof receipt.result_revision !== "number")
          throw new Error("Invalid command receipt");
        return {
          kind: "duplicate",
          snapshot: this.read(receipt.result_revision),
        };
      }
      const snapshot = this.read();
      if (snapshot.projectId !== command.projectId)
        return { kind: "wrong-project" };
      if (snapshot.revision !== command.expectedProjectRevision)
        return { kind: "stale", actualRevision: snapshot.revision };
      const action = command.action;
      switch (action.kind) {
        case "approve-task": {
          const task = snapshot.tasks.find(
            ({ taskId }) => taskId === action.grant.taskId,
          );
          if (
            !task ||
            !isExecutionGrantForTask(action.grant, task) ||
            task.state.kind !== "unapproved"
          )
            return { kind: "task-not-ready" };
          break;
        }
        case "reserve-run": {
          const task = snapshot.tasks.find(
            ({ taskId }) => taskId === action.taskId,
          );
          const grant = snapshot.grants.find(
            ({ approvalId }) => approvalId === action.approvalId,
          );
          if (!task || task.state.kind !== "approved" || !grant)
            return { kind: "task-not-ready" };
          if (
            task.state.approvalId !== grant.approvalId ||
            grant.taskId !== task.taskId
          )
            return { kind: "approval-stale" };
          if (snapshot.runs.some(ownsWriter)) return { kind: "writer-busy" };
          if (
            snapshot.runs.filter(({ taskId }) => taskId === task.taskId)
              .length >= grant.budget.maxAttempts
          )
            return { kind: "attempt-budget-exhausted" };
          break;
        }
        case "bind-run": {
          const run = snapshot.runs.find(
            ({ runId }) => runId === action.runId,
          );
          if (!run || run.state !== "reserved")
            return { kind: "run-not-active" };
          break;
        }
        case "finish-run": {
          const run = snapshot.runs.find(
            ({ runId }) => runId === action.runId,
          );
          if (!run || !ownsWriter(run)) return { kind: "run-not-active" };
          break;
        }
        case "rename-project":
        case "propose-tasks":
          break;
      }
      const event = decideProjectEvent(command);
      const revision = snapshot.revision + 1;
      this.database
        .prepare("INSERT INTO events VALUES (?, 1, ?)")
        .run(revision, JSON.stringify(event));
      this.database
        .prepare("INSERT INTO commands VALUES (?, ?, ?)")
        .run(command.commandId, input, revision);
      return { kind: "applied", snapshot: this.read() };
    });
  }

  close(): void {
    if (!this.closed) {
      this.database.close();
      this.closed = true;
    }
  }
}
