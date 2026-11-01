import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository";
import { MockWorker } from "../../src/mock-worker.js";
import {
  TaskRunner,
  type DeadlineScheduler,
} from "../../src/task-runner.js";
import type {
  ProjectCommand,
  ProposalDraft,
} from "../../../../packages/core/src/index.js";
import { taskStatus } from "../../../../packages/core/src/index.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
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
  const proposeOneTask = () => {
    const initial = repository.open(identity);
    const proposed = repository.dispatch({
      commandId: "proposal-runner",
      projectId: initial.projectId,
      expectedProjectRevision: initial.revision,
      action: {
        kind: "propose-tasks",
        draft: {
          goal: "Run one task",
          source: "deterministic-draft",
          tasks: [
            {
              key: "one",
              title: "Task one",
              requirements: [{ key: "result", text: "Produce a result." }],
              proposedScope: { included: ["src/**"], excluded: [] },
              checks: [
                {
                  key: "result",
                  requirementKeys: ["result"],
                  description: "Inspect the result.",
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
        },
      },
    });
    assert.ok(proposed.kind === "applied");
    const task = proposed.snapshot.tasks[0];
    assert.ok(task);
    return { snapshot: proposed.snapshot, task };
  };
  const approveOneTask = () => {
    const proposed = proposeOneTask();
    const approved = repository.dispatch({
      commandId: "approve-runner",
      projectId: proposed.snapshot.projectId,
      expectedProjectRevision: proposed.snapshot.revision,
      action: {
        kind: "approve-task",
        grant: {
          approvalId: "approval-one",
          taskId: proposed.task.taskId,
          planVersion: 1,
          repositoryRoot: "/project",
          writableRoot: "/project",
          commands: [{ argv: ["git", "status", "--short"] }],
          budget: proposed.task.proposedBudget,
        },
      },
    });
    assert.ok(approved.kind === "applied");
    return { snapshot: approved.snapshot, task: proposed.task };
  };
  test("approval rejects authority that differs from the proposed task", () => {
    const { snapshot, task } = proposeOneTask();
    const result = repository.dispatch({
      commandId: "approve-invalid",
      projectId: snapshot.projectId,
      expectedProjectRevision: snapshot.revision,
      action: {
        kind: "approve-task",
        grant: {
          approvalId: "approval-invalid",
          taskId: task.taskId,
          planVersion: 1,
          repositoryRoot: "/project",
          writableRoot: "/other-project",
          commands: [{ argv: ["git", "status", "--short"] }],
          budget: { ...task.proposedBudget, maxAttempts: 2 },
        },
      },
    });

    assert.equal(result.kind, "task-not-ready");
    assert.deepEqual(repository.read().grants, []);
  });
  test("runner rejects capabilities that cannot enforce the grant", async () => {
    const { task } = approveOneTask();
    const worker = new MockWorker({
      capabilities: { commandMediation: false },
    });
    const runner = new TaskRunner(repository, worker);

    const result = await runner.startTask({
      taskId: task.taskId,
      approvalId: "approval-one",
      runId: "run-one",
      adapterId: "mock",
      prompt: "Do the task",
      reservationCommandId: "reserve-one",
      bindCommandId: "bind-one",
      terminalCommandId: "finish-one",
    });

    assert.equal(result.kind, "unsupported-capabilities");
    assert.deepEqual(repository.read().runs, []);
    assert.equal(worker.starts.length, 0);
  });
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
  test("a second approved task cannot reserve the repository writer", () => {
    const initial = repository.open(identity);
    const proposal = repository.dispatch({
      commandId: "proposal-runs",
      projectId: initial.projectId,
      expectedProjectRevision: initial.revision,
      action: {
        kind: "propose-tasks",
        draft: {
          goal: "Run bounded work",
          source: "deterministic-draft",
          tasks: ["one", "two"].map((key) => ({
            key,
            title: `Task ${key}`,
            requirements: [{ key: "result", text: "Produce the result." }],
            proposedScope: { included: ["src/**"], excluded: [] },
            checks: [
              {
                key: "result",
                requirementKeys: ["result"],
                description: "Inspect the result.",
              },
            ],
            proposedBudget: {
              maxAttempts: 1,
              maxElapsedMinutes: 15,
              maxTokens: 20_000,
            },
            dependsOn: [],
          })),
        },
      },
    });
    assert.ok(proposal.kind === "applied");
    let snapshot = proposal.snapshot;
    for (const task of snapshot.tasks) {
      const approved = repository.dispatch({
        commandId: `approve-${task.taskId}`,
        projectId: snapshot.projectId,
        expectedProjectRevision: snapshot.revision,
        action: {
          kind: "approve-task",
          grant: {
            approvalId: `approval-${task.taskId}`,
            taskId: task.taskId,
            planVersion: 1,
            repositoryRoot: "/project",
            writableRoot: "/project",
            commands: [{ argv: ["git", "status", "--short"] }],
            budget: task.proposedBudget,
          },
        },
      });
      assert.ok(approved.kind === "applied");
      snapshot = approved.snapshot;
    }
    const first = repository.dispatch({
      commandId: "reserve-one",
      projectId: snapshot.projectId,
      expectedProjectRevision: snapshot.revision,
      action: {
        kind: "reserve-run",
        runId: "run-one",
        taskId: snapshot.tasks[0]?.taskId ?? "missing-task",
        approvalId: snapshot.grants[0]?.approvalId ?? "missing-approval",
        adapterId: "mock",
      },
    });
    assert.ok(first.kind === "applied");
    const other = new SqliteProjectRepository(
      path.join(directory, "project.sqlite"),
    );
    try {
      const second = other.dispatch({
        commandId: "reserve-two",
        projectId: first.snapshot.projectId,
        expectedProjectRevision: first.snapshot.revision,
        action: {
          kind: "reserve-run",
          runId: "run-two",
          taskId: first.snapshot.tasks[1]?.taskId ?? "missing-task",
          approvalId:
            first.snapshot.grants[1]?.approvalId ?? "missing-approval",
          adapterId: "mock",
        },
      });
      assert.equal(second.kind, "writer-busy");
    } finally {
      other.close();
    }
  });
  test("concurrent runners start exactly one repository writer", async () => {
    const { task } = approveOneTask();
    const other = new SqliteProjectRepository(
      path.join(directory, "project.sqlite"),
    );
    const worker = new MockWorker();
    const input = (suffix: string) => ({
      taskId: task.taskId,
      approvalId: "approval-one",
      runId: `run-${suffix}`,
      adapterId: "mock",
      prompt: "Do the task",
      reservationCommandId: `reserve-${suffix}`,
      bindCommandId: `bind-${suffix}`,
      terminalCommandId: `finish-${suffix}`,
    });
    try {
      const results = await Promise.all([
        new TaskRunner(repository, worker).startTask(input("one")),
        new TaskRunner(other, worker).startTask(input("two")),
      ]);

      assert.deepEqual(
        results.map(({ kind }) => kind).sort(),
        ["started", "writer-busy"],
      );
      assert.equal(worker.starts.length, 1);
      assert.equal(repository.read().runs.length, 1);
    } finally {
      other.close();
    }
  });
  test("TaskRunner reserves the writer before starting the worker", async () => {
    const { snapshot, task } = approveOneTask();
    const worker = new MockWorker({
      start: () => {
        const duringStart = repository.read();
        assert.equal(duringStart.runs[0]?.state, "reserved");
        const html = renderWorkView(duringStart);
        assert.ok(html.includes("Approved authority"));
        assert.ok(html.includes("git status --short"));
        assert.ok(html.includes("Writable root: /project"));
        return { kind: "started", ref: { id: "external-one" } };
      },
    });
    const runner = new TaskRunner(repository, worker);

    const result = await runner.startTask({
      taskId: task.taskId,
      approvalId: "approval-one",
      runId: "run-one",
      adapterId: "mock",
      prompt: "Do the task",
      reservationCommandId: "reserve-one",
      bindCommandId: "bind-one",
      terminalCommandId: "finish-one",
    });

    assert.equal(result.kind, "started");
    assert.equal(worker.starts.length, 1);
    assert.equal(repository.read().runs[0]?.state, "running");
    const runningHtml = renderWorkView(repository.read(), {
      observe: true,
      steer: true,
      interrupt: true,
      commandMediation: true,
      writableRoot: "requested-root",
    });
    assert.ok(runningHtml.includes("running"));
    assert.ok(runningHtml.includes("A second start is blocked"));
    assert.ok(runningHtml.includes("Command mediation observed"));
    assert.equal(snapshot.runs.length, 0);
  });
  test("indeterminate starts retain the writer without retrying", async () => {
    const { task } = approveOneTask();
    const worker = new MockWorker({
      start: () => ({ kind: "indeterminate", reason: "lost response" }),
    });
    const runner = new TaskRunner(repository, worker);

    const result = await runner.startTask({
      taskId: task.taskId,
      approvalId: "approval-one",
      runId: "run-one",
      adapterId: "mock",
      prompt: "Do the task",
      reservationCommandId: "reserve-one",
      bindCommandId: "bind-one",
      terminalCommandId: "finish-one",
    });

    assert.equal(result.kind, "indeterminate");
    assert.equal(worker.starts.length, 1);
    assert.equal(repository.read().runs[0]?.state, "reconciliation-required");
    const reconciliationHtml = renderWorkView(repository.read());
    assert.ok(reconciliationHtml.includes("Reconciliation required"));
    assert.ok(reconciliationHtml.includes("A second start is blocked"));
    const second = repository.dispatch({
      commandId: "reserve-two",
      projectId: repository.read().projectId,
      expectedProjectRevision: repository.read().revision,
      action: {
        kind: "reserve-run",
        runId: "run-two",
        taskId: task.taskId,
        approvalId: "approval-one",
        adapterId: "mock",
      },
    });
    assert.equal(second.kind, "writer-busy");
  });
  test("definite start failure releases the writer but exhausts attempts", async () => {
    const { task } = approveOneTask();
    const worker = new MockWorker({
      start: () => ({ kind: "not-started", reason: "rejected before send" }),
    });
    const runner = new TaskRunner(repository, worker);
    const result = await runner.startTask({
      taskId: task.taskId,
      approvalId: "approval-one",
      runId: "run-one",
      adapterId: "mock",
      prompt: "Do the task",
      reservationCommandId: "reserve-one",
      bindCommandId: "bind-one",
      terminalCommandId: "finish-one",
    });
    assert.equal(result.kind, "not-started");
    assert.equal(repository.read().runs[0]?.state, "failed");

    const current = repository.read();
    const retry = repository.dispatch({
      commandId: "reserve-retry",
      projectId: current.projectId,
      expectedProjectRevision: current.revision,
      action: {
        kind: "reserve-run",
        runId: "run-two",
        taskId: task.taskId,
        approvalId: "approval-one",
        adapterId: "mock",
      },
    });
    assert.equal(retry.kind, "attempt-budget-exhausted");
  });
  test("proven completion releases the writer and needs verification", async () => {
    const { task } = approveOneTask();
    const worker = new MockWorker({ inspected: { kind: "completed" } });
    const runner = new TaskRunner(repository, worker);
    const started = await runner.startTask({
      taskId: task.taskId,
      approvalId: "approval-one",
      runId: "run-one",
      adapterId: "mock",
      prompt: "Do the task",
      reservationCommandId: "reserve-one",
      bindCommandId: "bind-one",
      terminalCommandId: "finish-one",
    });
    assert.ok(started.kind === "started");

    const settled = await runner.settle({
      runId: "run-one",
      ref: started.ref,
      commandId: "complete-one",
    });

    assert.equal(settled.kind, "applied");
    const current = repository.read();
    assert.deepEqual(taskStatus(current, task.taskId), {
      kind: "needs-verification",
      runId: "run-one",
    });
    assert.equal(current.runs[0]?.state, "completed");
    const completedHtml = renderWorkView(current);
    assert.ok(completedHtml.includes("Needs verification"));
    assert.ok(!completedHtml.includes("accepted"));
  });
  test("elapsed budget interrupts supported workers and retains an unknown run", async () => {
    const { task } = approveOneTask();
    let expire: (() => Promise<void>) | undefined;
    let scheduledMilliseconds = 0;
    const deadlines: DeadlineScheduler = {
      schedule: (input) => {
        scheduledMilliseconds = input.milliseconds;
        expire = input.expire;
        return () => undefined;
      },
    };
    const worker = new MockWorker({
      capabilities: { interrupt: true },
      inspected: { kind: "unknown" },
    });
    const runner = new TaskRunner(repository, worker, deadlines);
    const started = await runner.startTask({
      taskId: task.taskId,
      approvalId: "approval-one",
      runId: "run-one",
      adapterId: "mock",
      prompt: "Do the task",
      reservationCommandId: "reserve-one",
      bindCommandId: "bind-one",
      terminalCommandId: "finish-one",
    });
    assert.equal(started.kind, "started");
    assert.equal(scheduledMilliseconds, 15 * 60_000);
    assert.ok(expire);

    await expire();

    assert.equal(worker.interrupts, 1);
    assert.equal(repository.read().runs[0]?.state, "reconciliation-required");
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
    const interpreter = new GoalInterpreter(() => ({
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
    }));
    const draft = await interpreter.propose("Add a pricing page");

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
    const html = renderWorkView(result.snapshot);
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
    const interpreter = new GoalInterpreter(() => ({
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
    }));
    const command = {
      commandId: "proposal-one",
      projectId: initial.projectId,
      expectedProjectRevision: initial.revision,
      action: {
        kind: "propose-tasks",
        draft: await interpreter.propose("Preserve the goal"),
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
