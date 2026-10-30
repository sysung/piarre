import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository";
import type { ProjectCommand } from "../../../../packages/core/src/index.js";
import { renderWorkView } from "../../src/work-view.js";

suite("Durable projects", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-project-"));
    repository = new SqliteProjectRepository(
      path.join(directory, "project.sqlite"),
    );
  });
  teardown(() => {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const identity = { repositoryUri: "file:///project", name: "Project" };
  test("restart replays the same observable project", () => {
    const initial = repository.open(identity);
    const result = repository.dispatch({
      commandId: "rename",
      projectId: initial.projectId,
      expectedProjectRevision: 1,
      action: { kind: "rename-project", name: "Renamed" },
    });
    assert.equal(result.kind, "applied");
    const before = repository.read();
    repository.close();
    repository = new SqliteProjectRepository(
      path.join(directory, "project.sqlite"),
    );
    assert.deepEqual(repository.open(identity), before);
  });
  test("duplicate command returns its original receipt after later mutations", () => {
    const initial = repository.open(identity);
    const command: ProjectCommand = {
      commandId: "one",
      projectId: initial.projectId,
      expectedProjectRevision: 1,
      action: { kind: "rename-project", name: "One" },
    };
    const first = repository.dispatch(command);
    repository.dispatch({
      ...command,
      commandId: "two",
      expectedProjectRevision: 2,
      action: { kind: "rename-project", name: "Two" },
    });
    assert.deepEqual(repository.dispatch(command), {
      kind: "duplicate",
      snapshot: first.kind === "applied" ? first.snapshot : undefined,
    });
    assert.equal(repository.read().revision, 3);
  });
  test("stale and conflicting commands do not append effects", () => {
    const initial = repository.open(identity);
    const command: ProjectCommand = {
      commandId: "one",
      projectId: initial.projectId,
      expectedProjectRevision: 1,
      action: { kind: "rename-project", name: "One" },
    };
    repository.dispatch(command);
    assert.equal(
      repository.dispatch({ ...command, commandId: "stale" }).kind,
      "stale",
    );
    assert.equal(
      repository.dispatch({
        ...command,
        action: { kind: "rename-project", name: "Conflict" },
      }).kind,
      "command-conflict",
    );
    assert.equal(
      repository.dispatch({
        ...command,
        commandId: "wrong",
        projectId: "wrong",
        expectedProjectRevision: 2,
      }).kind,
      "wrong-project",
    );
    assert.equal(repository.read().revision, 2);
  });
  test("two connections cannot accept the same observed revision", () => {
    const initial = repository.open(identity);
    const other = new SqliteProjectRepository(
      path.join(directory, "project.sqlite"),
    );
    try {
      const command: ProjectCommand = {
        commandId: "one",
        projectId: initial.projectId,
        expectedProjectRevision: 1,
        action: { kind: "rename-project", name: "One" },
      };
      assert.equal(repository.dispatch(command).kind, "applied");
      assert.equal(
        other.dispatch({ ...command, commandId: "two" }).kind,
        "stale",
      );
    } finally {
      other.close();
    }
  });
  test("corrupt history fails instead of recreating the project", () => {
    repository.open(identity);
    const database = new DatabaseSync(path.join(directory, "project.sqlite"));
    database.exec("UPDATE events SET payload = '{}' WHERE revision = 1");
    database.close();
    assert.throws(() => repository.read(), /Invalid project history/);
  });
  test("Work view escapes persisted project names and disables content scripts", () => {
    const project = repository.open({
      ...identity,
      name: '<script>alert("x")</script>',
    });
    const html = renderWorkView(project);
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(html.includes("default-src 'none'"));
  });
});
