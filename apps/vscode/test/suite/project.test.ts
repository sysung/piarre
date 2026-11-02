import { parseProposalOutput } from "../../../../packages/core/src/contracts.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository";
import type {
  ProjectCommand,
  ProposalDraft,
} from "../../../../packages/core/src/index.js";
import { renderInspection, renderWorkView } from "../../src/work-view.js";

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
  test("persists one complete unapproved proposal with stable task identities", async () => {
    const initial = repository.open(identity);
    const interpreter = ((goal: string) => Promise.resolve().then(() => parseProposalOutput(goal, ({
      tasks: [
        {
          key: "pricing-page",
          title: "Add the pricing page",
          requirements: [
            { key: "pricing-content", text: "Show the available plans." },
          ],
          proposedScope: {
            included: ["src/pages/pricing.tsx"],
            excluded: ["src/billing/**"],
          },
          checks: [
            {
              key: "pricing-visible",
              requirementKeys: ["pricing-content"],
              description: "Confirm the page shows each available plan.",
            },
          ],
          proposedBudget: {
            maxAttempts: 1,
            maxElapsedMinutes: 15,
            maxTokens: 20_000,
          },
          dependsOn: [],
        },
      ],
    }))));
    const draft = await interpreter("Add a pricing page");

    const result = repository.dispatch({
      commandId: "proposal-one",
      projectId: initial.projectId,
      expectedProjectRevision: initial.revision,
      action: { kind: "propose-tasks", draft },
    });

    assert.ok(result.kind === "applied");
    assert.deepEqual(result.snapshot.proposals, [
      {
        groupId: "proposal:proposal-one",
        recordedAtRevision: 2,
        goal: "Add a pricing page",
        source: "deterministic-draft",
        taskIds: ["task:proposal-one:pricing-page"],
      },
    ]);
    assert.deepEqual(result.snapshot.tasks, [
      {
        taskId: "task:proposal-one:pricing-page",
        groupId: "proposal:proposal-one",
        planVersion: 1,
        state: { kind: "unapproved" },
        title: "Add the pricing page",
        requirements: [
          { key: "pricing-content", text: "Show the available plans." },
        ],
        proposedScope: {
          included: ["src/pages/pricing.tsx"],
          excluded: ["src/billing/**"],
        },
        checks: [
          {
            key: "pricing-visible",
            requirementKeys: ["pricing-content"],
            description: "Confirm the page shows each available plan.",
          },
        ],
        proposedBudget: {
          maxAttempts: 1,
          maxElapsedMinutes: 15,
          maxTokens: 20_000,
        },
        dependsOn: [],
      },
    ]);
    const html = renderInspection(result.snapshot, undefined, result.snapshot.proposals[0]?.groupId);
    assert.ok(html.includes("Add a pricing page"));
    assert.ok(html.includes("Show the available plans."));
    assert.ok(html.includes("src/pages/pricing.tsx"));
    assert.ok(html.includes("No dependencies"));
    assert.ok(html.includes("Confirm the page shows each available plan."));
    assert.ok(html.includes("20,000 tokens"));
    assert.ok(html.includes("Plan version 1"));
    assert.ok(html.includes("Unapproved"));
    const beforeRestart = result.snapshot;
    repository.close();
    repository = new SqliteProjectRepository(
      path.join(directory, "project.sqlite"),
    );
    assert.deepEqual(repository.open(identity), beforeRestart);
  });
  test("duplicate proposal returns its historical receipt after rename", async () => {
    const initial = repository.open(identity);
    const interpreter = ((goal: string) => Promise.resolve().then(() => parseProposalOutput(goal, ({
      tasks: [
        {
          key: "task",
          title: "Review the goal",
          requirements: [{ key: "goal", text: "Preserve the goal." }],
          proposedScope: { included: ["src/**"], excluded: [] },
          checks: [
            {
              key: "review",
              requirementKeys: ["goal"],
              description: "Review the result.",
            },
          ],
          proposedBudget: {
            maxAttempts: 1,
            maxElapsedMinutes: 15,
            maxTokens: 20_000,
          },
          dependsOn: [],
        },
      ],
    }))));
    const command = {
      commandId: "proposal-one",
      projectId: initial.projectId,
      expectedProjectRevision: initial.revision,
      action: {
        kind: "propose-tasks",
        draft: await interpreter("Preserve the goal"),
      },
    } satisfies ProjectCommand;
    const first = repository.dispatch(command);
    assert.ok(first.kind === "applied");
    repository.dispatch({
      commandId: "rename-after-proposal",
      projectId: initial.projectId,
      expectedProjectRevision: 2,
      action: { kind: "rename-project", name: "Renamed" },
    });

    assert.deepEqual(repository.dispatch(command), {
      kind: "duplicate",
      snapshot: first.snapshot,
    });
    assert.equal(repository.read().revision, 3);
  });
  test("canonical task identities cannot collide across tuple boundaries", () => {
    const initial = repository.open(identity);
    const draft = (key: string): ProposalDraft => ({
      goal: "Review identity",
      source: "deterministic-draft",
      tasks: [
        {
          key,
          title: "Review identity",
          requirements: [{ key: "identity", text: "Keep IDs distinct." }],
          proposedScope: { included: [], excluded: [] },
          checks: [
            {
              key: "review",
              requirementKeys: ["identity"],
              description: "Compare the task IDs.",
            },
          ],
          proposedBudget: {
            maxAttempts: 1,
            maxElapsedMinutes: 15,
            maxTokens: 20_000,
          },
          dependsOn: [],
        },
      ],
    });
    const first = repository.dispatch({
      commandId: "a:b",
      projectId: initial.projectId,
      expectedProjectRevision: 1,
      action: { kind: "propose-tasks", draft: draft("c") },
    });
    const second = repository.dispatch({
      commandId: "a",
      projectId: initial.projectId,
      expectedProjectRevision: 2,
      action: { kind: "propose-tasks", draft: draft("b:c") },
    });

    assert.ok(first.kind === "applied");
    assert.ok(second.kind === "applied");
    assert.notEqual(first.snapshot.tasks[0]?.taskId, second.snapshot.tasks[1]?.taskId);
  });
});
