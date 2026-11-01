import assert from "node:assert/strict";
import {
  UnsupportedWorkerOperation,
  type ExternalRunRef,
  type WorkerAdapter,
  type WorkerTask,
} from "../../../../packages/core/src/worker.js";

const task: WorkerTask = {
  runId: "run-one",
  prompt: "Do the bounded task.",
  repositoryRoot: "/project",
  grant: {
    approvalId: "approval-one",
    taskId: "task-one",
    planVersion: 1,
    repositoryRoot: "/project",
    writableRoot: "/project",
    commands: [{ argv: ["git", "status", "--short"] }],
    budget: {
      maxAttempts: 1,
      maxElapsedMinutes: 15,
      maxTokens: 20_000,
    },
  },
};

export function workerContract(
  name: string,
  createWorker: (input: {
    readonly controls: boolean;
  }) => WorkerAdapter,
): void {
  suite(`Worker contract: ${name}`, () => {
    test("start observe and inspect use one external run", async () => {
      const worker = createWorker({ controls: false });
      const started = await worker.start(task);
      assert.ok(started.kind === "started");
      const observations = [];
      for await (const observation of worker.observe(started.ref))
        observations.push(observation);
      assert.deepEqual(observations, [{ kind: "completed" }]);
      assert.deepEqual(await worker.inspect(started.ref), { kind: "completed" });
    });

    test("unsupported controls return one typed error without an effect", async () => {
      const worker = createWorker({ controls: false });
      const started = await worker.start(task);
      assert.ok(started.kind === "started");
      await assert.rejects(
        worker.steer(started.ref, "Change direction"),
        UnsupportedWorkerOperation,
      );
      await assert.rejects(
        worker.interrupt(started.ref),
        UnsupportedWorkerOperation,
      );
    });

    test("supported controls target the started external run", async () => {
      const worker = createWorker({ controls: true });
      const started = await worker.start(task);
      assert.ok(started.kind === "started");
      await worker.steer(started.ref, "Change direction");
      await worker.interrupt(started.ref);
      assert.deepEqual(await worker.inspect(started.ref), { kind: "completed" });
    });

    test("an unrecognized external run is unknown", async () => {
      const worker = createWorker({ controls: false });
      const missing: ExternalRunRef = { id: "missing" };
      assert.deepEqual(await worker.inspect(missing), { kind: "unknown" });
    });
  });
}
