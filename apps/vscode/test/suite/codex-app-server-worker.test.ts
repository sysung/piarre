import path from "node:path";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { CodexAppServerWorker } from "../../src/codex-app-server-worker.js";
import type { WorkerTask } from "../../../../packages/core/src/worker.js";
import { workerContract } from "./worker-contract.js";

const fixture = path.resolve(
  __dirname,
  "../../test/fixtures/fake-codex-app-server.mjs",
);

const quote = (value: string): string =>
  /^[A-Za-z0-9_./:@%+=,-]+$/.test(value)
    ? value
    : `'${value.replaceAll("'", `'"'"'`)}'`;
const commandDisplay = (argv: readonly string[]): string => {
  const script = argv.map(quote).join(" ");
  return `/bin/zsh -c ${quote(script)}`;
};

workerContract(
  "codex app-server",
  ({ controls }) =>
    new CodexAppServerWorker({
      command: process.execPath,
      args: [fixture, ...(controls ? ["--controls"] : [])],
      controls,
      timeoutMs: 2_000,
      mediationEvidence: {
        cliVersion: "fake",
        approvalPolicy: "untrusted",
        sandboxPolicy: "workspaceWrite",
      },
    }),
);

const task = (argv: readonly [string, ...string[]]): WorkerTask => ({
  runId: "approval-run",
  prompt: "Run the approved command.",
  repositoryRoot: "/project",
  grant: {
    approvalId: "approval-one",
    taskId: "task-one",
    planVersion: 1,
    repositoryRoot: "/project",
    writableRoot: "/project",
    commands: [{ argv }],
    budget: { maxAttempts: 1, maxElapsedMinutes: 15, maxTokens: 20_000 },
  },
});

suite("Codex app-server approvals", () => {
  test("does not advertise command mediation without current evidence", async () => {
    const worker = new CodexAppServerWorker({
      command: process.execPath,
      args: [fixture],
      timeoutMs: 2_000,
    });
    try {
      assert.equal((await worker.capabilities()).commandMediation, false);
    } finally {
      worker.close();
    }
  });

  test("maps a failed turn to unknown state", async () => {
    const worker = new CodexAppServerWorker({
      command: process.execPath,
      args: [fixture, "--turn-failed"],
      timeoutMs: 2_000,
    });
    try {
      const started = await worker.start(task(["/bin/pwd"]));
      assert.ok(started.kind === "started");
      for await (const observation of worker.observe(started.ref)) {
        assert.fail(`A failed turn emitted ${JSON.stringify(observation)}`);
      }
      assert.deepEqual(await worker.inspect(started.ref), { kind: "unknown" });
    } finally {
      worker.close();
    }
  });
  test("accepts a correlated file change inside the writable root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "piarre-file-change-"));
    const worker = new CodexAppServerWorker({
      command: process.execPath,
      args: [fixture, "--file-change=src/new.ts"],
      timeoutMs: 2_000,
      mediationEvidence: {
        cliVersion: "fake",
        approvalPolicy: "untrusted",
        sandboxPolicy: "workspaceWrite",
      },
    });
    try {
      const started = await worker.start({
        ...task(["/bin/pwd"]),
        repositoryRoot: root,
        grant: {
          ...task(["/bin/pwd"]).grant,
          repositoryRoot: root,
          writableRoot: root,
        },
      });
      assert.ok(started.kind === "started");
      const observations = [];
      for await (const observation of worker.observe(started.ref))
        observations.push(observation);
      assert.deepEqual(observations, [{ kind: "completed" }]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  for (const [name, candidate, extraArguments] of [
    ["outside root", "/tmp/piarre-outside.ts", ["--expect-decline"]],
    ["parent traversal", "../outside.ts", ["--expect-decline"]],
    ["missing item correlation", "src/new.ts", ["--expect-decline", "--missing-correlation"]],
  ] as const) {
    test(`declines a file change with ${name}`, async () => {
      const root = await mkdtemp(path.join(tmpdir(), "piarre-file-deny-"));
      const worker = new CodexAppServerWorker({
        command: process.execPath,
        args: [fixture, `--file-change=${candidate}`, ...extraArguments],
        timeoutMs: 2_000,
      });
      try {
        const started = await worker.start({
          ...task(["/bin/pwd"]),
          repositoryRoot: root,
          grant: {
            ...task(["/bin/pwd"]).grant,
            repositoryRoot: root,
            writableRoot: root,
          },
        });
        assert.ok(started.kind === "started");
        const observations = [];
        for await (const observation of worker.observe(started.ref))
          observations.push(observation);
        assert.deepEqual(observations, [{ kind: "completed" }]);
      } finally {
        worker.close();
        await rm(root, { recursive: true, force: true });
      }
    });
  }

  test("declines a file change through a symlink outside the writable root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "piarre-file-link-"));
    const outside = await mkdtemp(path.join(tmpdir(), "piarre-file-target-"));
    await mkdir(path.join(root, "src"));
    await symlink(outside, path.join(root, "src", "linked"));
    const worker = new CodexAppServerWorker({
      command: process.execPath,
      args: [
        fixture,
        "--file-change=src/linked/new.ts",
        "--expect-decline",
      ],
      timeoutMs: 2_000,
    });
    try {
      const started = await worker.start({
        ...task(["/bin/pwd"]),
        repositoryRoot: root,
        grant: {
          ...task(["/bin/pwd"]).grant,
          repositoryRoot: root,
          writableRoot: root,
        },
      });
      assert.ok(started.kind === "started");
      const observations = [];
      for await (const observation of worker.observe(started.ref))
        observations.push(observation);
      assert.deepEqual(observations, [{ kind: "completed" }]);
    } finally {
      worker.close();
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(outside, { recursive: true, force: true }),
      ]);
    }
  });

  for (const argv of [
    ["/bin/echo", "two words"],
    ["/bin/echo", "single'quote"],
    ["/bin/echo", "$(touch nope)"],
  ] as const) {
    test(`accepts the exact quoted argv ${JSON.stringify(argv)}`, async () => {
      const worker = new CodexAppServerWorker({
        command: process.execPath,
        args: [fixture, `--approval-command=${commandDisplay(argv)}`],
        timeoutMs: 2_000,
      });
      const started = await worker.start(task([...argv]));
      assert.ok(started.kind === "started");
      const observations = [];
      for await (const observation of worker.observe(started.ref))
        observations.push(observation);
      assert.deepEqual(observations, [{ kind: "completed" }]);
      worker.close();
    });
  }
  test("accepts only the exact correlated command display", async () => {
    const worker = new CodexAppServerWorker({
      command: process.execPath,
      args: [fixture, "--approval-command=/bin/zsh -c /bin/pwd"],
      timeoutMs: 2_000,
    });
    const started = await worker.start(task(["/bin/pwd"]));
    assert.ok(started.kind === "started");
    const observations = [];
    for await (const observation of worker.observe(started.ref))
      observations.push(observation);
    assert.deepEqual(observations, [{ kind: "completed" }]);
  });

  test("declines a near-match command", async () => {
    const worker = new CodexAppServerWorker({
      command: process.execPath,
      args: [fixture, "--approval-command=/bin/zsh -c '/bin/pwd --extra'"],
      timeoutMs: 2_000,
    });
    const started = await worker.start(task(["/bin/pwd"]));
    assert.ok(started.kind === "started");
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(await worker.inspect(started.ref), { kind: "unknown" });
  });
});
