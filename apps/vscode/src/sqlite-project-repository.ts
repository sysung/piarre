import type { VisitBaseline } from "../../../packages/core/src/resumption.js";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  decideProjectEvent,
  replay,
  type ProjectEvent,
  type ProjectSnapshot,
  type CommandResult,
  parseProjectEvent,
  validateProjectCommand,
} from "../../../packages/core/src/index.js";

export class SqliteProjectRepository {
  private readonly database: DatabaseSync;
  private closed = false;

  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath);
    try {
      this.database.exec(
        "PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL; CREATE TABLE IF NOT EXISTS project_visit (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), revision INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS events (revision INTEGER PRIMARY KEY, schema_version INTEGER NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS commands (command_id TEXT PRIMARY KEY, input TEXT NOT NULL, result_revision INTEGER NOT NULL REFERENCES events(revision));",
      );
    } catch (error) {
      this.database.close();
      throw error;
    }
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
    return replay(this.readEvents(throughRevision));
  }

  readDiagnosticSnapshot(): { readonly snapshot: ProjectSnapshot; readonly events: readonly ProjectEvent[] } {
    const events = this.readEvents(Number.MAX_SAFE_INTEGER);
    return { snapshot: replay(events), events };
  }

  private readEvents(throughRevision: number): readonly ProjectEvent[] {
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
        return parseProjectEvent(JSON.parse(row.payload));
      } catch {
        throw new Error("Invalid project history: malformed event");
      }
    });
    return events;
  }

  beginVisit(): VisitBaseline {
    return this.transaction(() => {
      const current = this.read();
      const row = this.database.prepare("SELECT revision FROM project_visit WHERE singleton = 1").get();
      let baseline: VisitBaseline = { kind: "first-visit" };
      if (row) {
        baseline = typeof row.revision === "number" && Number.isSafeInteger(row.revision) && row.revision >= 1 && row.revision <= current.revision
          ? { kind: "previous-visit", snapshot: this.read(row.revision) }
          : { kind: "unavailable", reason: "Invalid saved visit revision" };
      }
      this.database.prepare("INSERT INTO project_visit VALUES (1, ?) ON CONFLICT(singleton) DO UPDATE SET revision = excluded.revision").run(current.revision);
      return baseline;
    });
  }

  recordVisitedRevision(projectId: string, revision: number): void {
    const current = this.read();
    if (current.projectId !== projectId || !Number.isSafeInteger(revision) || revision < 1 || revision > current.revision) throw new Error("Invalid visited revision");
    this.database.prepare("INSERT INTO project_visit VALUES (1, ?) ON CONFLICT(singleton) DO UPDATE SET revision = max(project_visit.revision, excluded.revision)").run(revision);
  }

  dispatch(inputCommand: unknown): CommandResult {
    const command = validateProjectCommand(inputCommand);
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
    } else if (command.action.kind === "delete-proposal") {
      input = JSON.stringify([command.projectId, command.expectedProjectRevision, command.action.kind, command.action.groupId]);
    } else if (command.action.kind === "propose-tasks") {
      input = JSON.stringify([
        command.projectId,
        command.expectedProjectRevision,
        command.action.kind,
        command.action.draft,
      ]);
    } else {
      input = JSON.stringify([command.projectId, command.expectedProjectRevision, command.action]);
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
      if (["request-execution", "observe-execution-provider", "bind-execution-thread"].includes(action.kind) && "runId" in action) {
        const run = snapshot.executionRuns.find(run => run.runId === action.runId);
        if (run && (run.grant.spendingConsent?.kind !== "native-uncertain-one-attempt" || run.grant.plan.forecast.kind !== "configured-v1")) throw new Error("Historical spending authority cannot start generation. Prepare a new plan and native consent.");
      }
      if (action.kind === "delete-proposal" && !snapshot.proposals.some(proposal => proposal.groupId === action.groupId)) throw new Error("Proposal no longer exists");
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
