import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  replay,
  type ProjectEvent,
  type ProjectSnapshot,
  type ProjectCommand,
  type CommandResult,
} from "../../../packages/core/src/index.js";

function parseEvent(value: unknown): ProjectEvent {
  if (
    typeof value !== "object" ||
    value === null ||
    !("kind" in value) ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !value.name.trim()
  )
    throw new Error("Invalid project history: malformed event");
  if (value.kind === "project-renamed")
    return { kind: value.kind, name: value.name };
  if (
    value.kind === "project-created" &&
    "projectId" in value &&
    typeof value.projectId === "string" &&
    "repositoryUri" in value &&
    typeof value.repositoryUri === "string"
  )
    return {
      kind: value.kind,
      projectId: value.projectId,
      repositoryUri: value.repositoryUri,
      name: value.name,
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
      command.expectedProjectRevision < 1 ||
      !command.action.name.trim() ||
      command.action.name.length > 200
    )
      throw new Error("Invalid project command");
    const input = JSON.stringify([
      command.projectId,
      command.expectedProjectRevision,
      command.action.kind,
      command.action.name,
    ]);
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
      const event: ProjectEvent = {
        kind: "project-renamed",
        name: command.action.name,
      };
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
