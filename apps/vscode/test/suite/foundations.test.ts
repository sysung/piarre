import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { renderWorkView } from "../../src/work-view.js";
import { decideProjectEvent, parseProposalOutput, type ProjectCommand } from "../../../../packages/core/src/index.js";
import { inspectProject, parseProviderConfiguration, resolveRecordReference } from "../../../../packages/core/src/inspection.js";

const fixture = (goal = "Keep project decisions inspectable") => parseProposalOutput(goal, {
  tasks: [{ key: "review", title: "Review the change",
    requirements: [{ key: "intent", text: goal }],
    proposedScope: { included: [], excluded: [] },
    checks: [{ key: "inspect", requirementKeys: ["intent"], description: "Inspect the result" }],
    proposedBudget: { maxAttempts: 1, maxElapsedMinutes: 15, maxTokens: 20000 }, dependsOn: [] }],
});

suite("C01 proposal authority and provenance", () => {
  let directory: string;
  let databasePath: string;
  let repository: SqliteProjectRepository;
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-foundation-"));
    databasePath = path.join(directory, "project.sqlite");
    repository = new SqliteProjectRepository(databasePath);
    repository.open({ repositoryUri: "file:///foundation", name: "Foundation" });
  });
  teardown(() => {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  });
  function propose(goal?: string) {
    const before = repository.read();
    const result = repository.dispatch({ commandId: `proposal-${String(before.revision)}`,
      projectId: before.projectId, expectedProjectRevision: before.revision,
      action: { kind: "propose-tasks", draft: fixture(goal) } });
    assert.equal(result.kind, "applied");
    return repository.read();
  }
  function rename() {
    const before = repository.read();
    repository.dispatch({ commandId: `rename-${String(before.revision)}`,
      projectId: before.projectId, expectedProjectRevision: before.revision,
      action: { kind: "rename-project", name: "Renamed" } });
  }
  test("Basis keeps original proposal revisions through rename and restart", () => {
    const proposal = propose();
    const before = inspectProject(proposal).basis;
    assert.equal(before.length, 2);
    assert.ok(before.every((entry) => entry.reference.revision === 2));
    rename();
    assert.deepEqual(inspectProject(repository.read()).basis, before);
    repository.close();
    repository = new SqliteProjectRepository(databasePath);
    assert.deepEqual(inspectProject(repository.read()).basis, before);
    assert.equal(repository.read().revision, 3);
    for (const entry of before) {
      assert.equal(resolveRecordReference(repository.read(), entry.reference).kind, "resolved");
      assert.equal(resolveRecordReference(repository.read(), { ...entry.reference, revision: 3 }).kind, "stale");
      assert.equal(resolveRecordReference(repository.read(), { ...entry.reference, recordId: "absent" }).kind, "missing");
      assert.equal(resolveRecordReference(repository.read(), { ...entry.reference, projectId: "another-project" }).kind, "wrong-project");
    }
  });
  test("a rename before a proposal does not invent an earlier source revision", () => {
    rename();
    const project = propose();
    assert.equal(project.revision, 3);
    assert.ok(inspectProject(project).basis.every((entry) => entry.reference.revision === 3));
    assert.equal(inspectProject(repository.read(2)).basis.length, 0);
  });
  test("invalid direct dispatch cannot bypass the interpreter or append receipts", () => {
    const before = repository.read();
    const draft = fixture();
    const task = draft.tasks[0];
    assert.ok(task);
    const invalidActions = [
      { kind: "approve-task", taskId: "review" },
      { kind: "propose-tasks", draft, approved: true },
      { kind: "propose-tasks", draft: { ...draft, source: "hosted-model" } },
      { kind: "propose-tasks", draft: { ...draft, tasks: [{ ...task, state: { kind: "accepted" } }] } },
      { kind: "propose-tasks", draft: { ...draft, tasks: [{ ...task, dependsOn: [task.key] }] } },
      { kind: "propose-tasks", draft: { ...draft, tasks: [{ ...task, checks: [] }] } },
      { kind: "propose-tasks", draft: { ...draft, tasks: [{ ...task, proposedBudget: { ...task.proposedBudget, maxTokens: 0 } }] } },
    ];
    for (const action of invalidActions) {
      assert.throws(() => repository.dispatch({ commandId: "invalid",
        projectId: before.projectId, expectedProjectRevision: 1, action }), /Invalid|Unsupported/);
      assert.deepEqual(repository.read(), before);
    }
    const database = new DatabaseSync(databasePath);
    try {
      assert.equal(database.prepare("SELECT COUNT(*) AS n FROM commands").get()?.n, 0);
      assert.equal(database.prepare("SELECT COUNT(*) AS n FROM events").get()?.n, 1);
    } finally { database.close(); }
  });
  test("corrupt stored provenance, authority, and graph envelopes are rejected", () => {
    propose();
    const database = new DatabaseSync(databasePath);
    try {
      const row = database.prepare("SELECT payload FROM events WHERE revision = 2").get();
      assert.ok(row && typeof row.payload === "string");
      const original: unknown = JSON.parse(row.payload);
      // Deliberately mutate JSON via plain data to exercise the storage boundary.
      assert.ok(typeof original === "object" && original !== null && "group" in original && "tasks" in original);
      const mutations = [
        (event: object) => { Object.assign(event, { approved: true }); },
        (event: object) => {
          const group: unknown = "group" in event ? event.group : undefined;
          assert.ok(typeof group === "object" && group !== null);
          Object.assign(group, { source: "untrusted-provider" });
        },
        (event: object) => {
          const tasks: unknown = "tasks" in event ? event.tasks : undefined;
          assert.ok(Array.isArray(tasks));
          const task: unknown = tasks[0];
          assert.ok(typeof task === "object" && task !== null);
          Object.assign(task, { executionGrant: "forged" });
        },
        (event: object) => {
          const tasks: unknown = "tasks" in event ? event.tasks : undefined;
          assert.ok(Array.isArray(tasks));
          const task: unknown = tasks[0];
          assert.ok(typeof task === "object" && task !== null && "taskId" in task);
          Object.assign(task, { dependsOn: [task.taskId] });
        },
        (event: object) => {
          const tasks: unknown = "tasks" in event ? event.tasks : undefined;
          assert.ok(Array.isArray(tasks));
          const task: unknown = tasks[0];
          assert.ok(typeof task === "object" && task !== null);
          Object.assign(task, { checks: [] });
        },
      ];
      for (const mutate of mutations) {
        const event: unknown = JSON.parse(row.payload);
        assert.ok(typeof event === "object" && event !== null && !Array.isArray(event));
        mutate(event);
        const corrupt = JSON.stringify(event);
        database.prepare("UPDATE events SET payload = ? WHERE revision = 2").run(corrupt);
        assert.throws(() => repository.read(), /Invalid project history/);
        assert.equal(database.prepare("SELECT payload FROM events WHERE revision = 2").get()?.payload, corrupt);
      }
      database.prepare("UPDATE events SET payload = ? WHERE revision = 2").run(row.payload);
      assert.equal(repository.read().tasks.length, 1);
    } finally { database.close(); }
  });
  test("pre-C01 receipts with alternate draft property order survive replay and retry", () => {
    const before = repository.read();
    const canonical = fixture();
    const legacyDraft = { tasks: canonical.tasks, source: canonical.source, goal: canonical.goal };
    const command: ProjectCommand = { commandId: "legacy", projectId: before.projectId,
      expectedProjectRevision: 1, action: { kind: "propose-tasks", draft: legacyDraft } };
    const oldInput = JSON.stringify([command.projectId, 1, command.action.kind, legacyDraft]);
    const database = new DatabaseSync(databasePath);
    try {
      database.prepare("INSERT INTO events VALUES (2, 1, ?)").run(JSON.stringify(decideProjectEvent(command)));
      database.prepare("INSERT INTO commands VALUES (?, ?, 2)").run("legacy", oldInput);
      rename();
      repository.close();
      repository = new SqliteProjectRepository(databasePath);
      const retried = repository.dispatch(command);
      assert.equal(retried.kind, "duplicate");
      assert.equal(retried.snapshot.revision, 2);
      assert.equal(repository.read().revision, 3);
      assert.equal(database.prepare("SELECT input FROM commands WHERE command_id = 'legacy'").get()?.input, oldInput);
    } finally { database.close(); }
  });
  test("Work exposes unapproved Basis and unavailable capabilities without running providers", async () => {
    const draft = await new GoalInterpreter().propose('<script>alert("x")</script>');
    const before = repository.read();
    repository.dispatch({ commandId: "escaped", projectId: before.projectId,
      expectedProjectRevision: before.revision, action: { kind: "propose-tasks", draft } });
    const project = repository.read();
    const html = renderWorkView(project);
    assert.ok(html.includes("Basis and permissions"));
    assert.ok(html.includes("recorded at project revision 2"));
    assert.ok(html.includes("A proposed budget is not permission to spend"));
    assert.ok(html.includes("Automatic memory capture is disabled"));
    assert.ok(html.includes("not independently verified"));
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(inspectProject(project).providers.every((provider) => provider.status === "not-configured"));
    const selected = parseProviderConfiguration([{ role: "conversation", provider: "local-engine", model: "small-model" }]);
    const inspection = inspectProject(project, selected);
    assert.equal(inspection.providers.find(({ role }) => role === "conversation")?.status, "unsupported");
    assert.ok(renderWorkView(project, selected).includes("unsupported and not connected"));
  });
  test("invalid provider configuration fails closed and does not expose credentials", () => {
    const cases = [
      { conversation: "engine" },
      [{ role: "unknown", provider: "engine", model: "small" }],
      [{ role: "conversation", provider: "engine", model: "small", apiKey: "secret-value" }],
      [{ role: "conversation", provider: "https://example.invalid", model: "small" }],
      [{ role: "conversation", provider: "engine", model: "small" }, { role: "conversation", provider: "second", model: "large" }],
    ];
    for (const value of cases) {
      const parsed = parseProviderConfiguration(value);
      assert.equal(parsed.kind, "invalid");
      const html = renderWorkView(repository.read(), parsed);
      assert.ok(html.includes("Invalid configuration"));
      assert.ok(!html.includes("secret-value"));
    }
  });
});
