import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import { ownsExecutionLease, type ProjectCommand } from "../../../../packages/core/src/index.js";
import { CandidateWorkspace } from "../../src/candidate-workspace.js";
import { ExecutionCoordinator } from "../../src/execution-coordinator.js";
import { activate } from "../../src/extension.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { forecastFixture, consentFixture } from "./forecast-fixture.js";
import { command, host } from "./project-lifetime-vscode.js";

function deferred() {
  let resolve = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function createFixture() {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "piarre-lifetime-")));
  const globalStorageUri = vscode.Uri.file(path.join(directory, "storage"));
  const subscriptions: vscode.Disposable[] = [];
  const extension = vscode.extensions.getExtension("sysung.piarre");
  assert.ok(extension);
  const context = { globalStorageUri, subscriptions, extension } satisfies Pick<vscode.ExtensionContext, "globalStorageUri" | "subscriptions" | "extension">;
  const folder = (name: string): vscode.WorkspaceFolder => {
    const root = path.join(directory, name);
    execFileSync("git", ["init", root]);
    return { uri: vscode.Uri.file(root), name, index: 0 };
  };
  const storage = (folder: vscode.WorkspaceFolder): string => path.join(globalStorageUri.fsPath, "projects", createHash("sha256").update(folder.uri.toString()).digest("hex"));
  const open = () => vscode.commands.executeCommand(command("piarre.open"));
  const run = (id: string) => vscode.commands.executeCommand(command(`piarre.${id}`));
  const propose = (goal: string) => vscode.commands.executeCommand(command("piarre.proposeTask"), goal);
  return {
    start: () => { activate(context as vscode.ExtensionContext); }, folder, storage, open, propose, run,
    dispose: () => {
      try { for (const subscription of subscriptions.splice(0)) { try { subscription.dispose(); } catch { /* Preserve the test failure and finish fixture cleanup. */ } } }
      finally {
        host.folders = []; host.errors.length = 0; host.setupError = undefined;
        host.watcherDisposals = 0; host.panel = undefined; host.stopVisible = false; host.rename = undefined;
        rmSync(directory, { recursive: true, force: true });
      }
    },
  };
}

async function seedRun(folder: vscode.WorkspaceFolder, storage: string) {
  const executionStorage = path.join(storage, "execution");
  mkdirSync(executionStorage, { recursive: true });
  const root = folder.uri.fsPath;
  writeFileSync(path.join(root, "review.txt"), "original\n");
  const repository = new SqliteProjectRepository(path.join(storage, "project.sqlite"));
  try {
    repository.open({ repositoryUri: folder.uri.toString(), name: folder.name });
    const send = (action: ProjectCommand["action"], id: string) => {
      const { projectId, revision } = repository.read();
      assert.equal(repository.dispatch({ commandId: id, projectId, expectedProjectRevision: revision, action }).kind, "applied");
    };
    send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose("Review scoped files") }, "goal");
    const task = repository.read().tasks[0]; assert.ok(task);
    const candidate = CandidateWorkspace.capture({ repositoryRoot: root, storageDirectory: executionStorage, relativePaths: ["review.txt"] });
    send({ kind: "prepare-execution-plan", plan: { taskId: task.taskId, objective: task.title, criteria: [{ criterionId: "text", text: "Review scoped text" }], knowledge: [], files: candidate.files.map(file => file.baseline), checks: [], candidateRoot: candidate.root, controlDirectory: candidate.controlDirectory, captureHash: candidate.captureHash, baselineCheckpoint: candidate.checkpoint({ checkpointId: "baseline" }), sourceRoot: root, provider: { kind: "codex-readonly-patch", authType: "unknown", requestedModel: "fixture" }, accountContext: { observedAt: new Date(1000).toISOString(), model: { kind: "unknown" }, usage: { kind: "unknown" } }, forecast: forecastFixture(), durationMs: 120_000, maxTokens: 1000 } }, "plan");
    const plan = repository.read().executionPlans[0]; assert.ok(plan);
    const runId = "run:opening-fixture";
    send({ kind: "approve-execution", spendingConsent: consentFixture(plan, runId), planId: plan.planId, planRevision: plan.recordedAtRevision, runId, ownerPid: 2147483647, ownerId: "departed-host", approvedAt: 1000, expiresAt: 120_000 }, "approve");
    send({ kind: "request-execution", runId, requestedAt: 1000 }, "request");
    send({ kind: "observe-execution-provider", runId, model: "fixture", modelProvider: "openai", observedAt: 1000 }, "observed");
    send({ kind: "bind-execution-thread", runId, threadId: "unconfirmed-thread" }, "thread");
    send({ kind: "mark-execution-unknown", runId, reason: "No terminal provider observation" }, "uncertain");
    return { candidate, snapshot: repository.read() };
  } finally { repository.close(); }
}

suite("Project lifetime through VS Code and SQLite", () => {
  test("withdraws a failed opening and retries the same root after its capture returns", async function () {
    this.timeout(15_000);
    const fixture = createFixture();
    try {
      const folder = fixture.folder("recoverable");
      const storage = fixture.storage(folder);
      const { candidate, snapshot } = await seedRun(folder, storage);
      const capture = candidate.controlDirectory;
      const missing = `${capture}-offline`;
      renameSync(capture, missing);
      host.folders = [folder];
      fixture.start();
      await fixture.open();
      const failedPanel = host.panel;
      renameSync(missing, capture);
      await fixture.open();
      await fixture.propose("Proof that the retry selected the original project");
      const database = new SqliteProjectRepository(path.join(storage, "project.sqlite"));
      try {
        const recovered = database.read();
        assert.equal(recovered.proposals.at(-1)?.goal, "Proof that the retry selected the original project");
        assert.notEqual(host.panel, failedPanel, "retry should own a new Work panel");
        assert.equal(recovered.projectId, snapshot.projectId);
        assert.deepEqual(recovered.executionRuns, snapshot.executionRuns);
        assert.ok(recovered.executionRuns.some(ownsExecutionLease));
      } finally { database.close(); }
    } finally { fixture.dispose(); }
  });
  for (const outcome of ["success", "failure", "same-root", "dispose"] as const) {
    test(`ignores a ${outcome} continuation from a retired opening`, async function () {
      this.timeout(15_000);
      const fixture = createFixture();
      // eslint-disable-next-line @typescript-eslint/unbound-method -- restored after the fixture and called with the original receiver
      const { reconcile } = ExecutionCoordinator.prototype;
      const entered = deferred();
      const release = deferred();
      let first = true;
      ExecutionCoordinator.prototype.reconcile = async function () {
        if (first) { first = false; entered.resolve(); await release.promise; }
        await reconcile.call(this);
      };
      try {
        const a = fixture.folder("initial");
        const b = outcome === "same-root" ? a : fixture.folder("replacement");
        fixture.start();
        await fixture.open();
        host.folders = [a];
        const opening = fixture.open();
        await entered.promise;
        if (outcome === "dispose") fixture.dispose();
        else {
          host.folders = [b];
          host.changed.fire({ added: [b], removed: [a] });
          await fixture.open();
        }
        if (outcome === "failure") release.reject(new Error("Retired reconciliation failed"));
        else release.resolve();
        await opening;
        assert.deepEqual(host.errors, [], "a retired opening may not report over the current workspace");
        if (outcome !== "dispose") {
          await fixture.propose("Only the replacement receives this proposal");
          const selected = new SqliteProjectRepository(path.join(fixture.storage(b), "project.sqlite"));
          try { assert.equal(selected.read().proposals.at(-1)?.goal, "Only the replacement receives this proposal"); }
          finally { selected.close(); }
        }
      } finally {
        release.resolve();
        ExecutionCoordinator.prototype.reconcile = reconcile;
        fixture.dispose();
      }
    });
  }
  test("releases a partial opening after watcher setup fails and accepts another root", async () => {
    const fixture = createFixture();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- restored after the fixture and called with the original receiver
    const { close } = SqliteProjectRepository.prototype;
    const closed: string[] = [];
    SqliteProjectRepository.prototype.close = function () {
      closed.push(this.read().name);
      close.call(this);
    };
    try {
      const a = fixture.folder("setup-failure");
      const b = fixture.folder("replacement");
      fixture.start();
      await fixture.open();
      host.folders = [a];
      host.setupError = new Error("Watcher setup failed");
      await fixture.open();
      assert.deepEqual(closed, [a.name]);
      assert.match(host.errors.at(-1) ?? "", /Watcher setup failed/);
      assert.equal(host.panel, undefined);
      assert.equal(host.stopVisible, false);
      host.setupError = undefined;
      host.folders = [b];
      await fixture.open();
      await fixture.propose("Proposal belongs to replacement");
      const repository = new SqliteProjectRepository(path.join(fixture.storage(b), "project.sqlite"));
      try { assert.equal(repository.read().proposals.at(-1)?.goal, "Proposal belongs to replacement"); }
      finally { close.call(repository); }
    } finally { fixture.dispose(); SqliteProjectRepository.prototype.close = close; }
  });

  test("keeps Work, Stop and reconciliation available while opening is pending", async () => {
    const fixture = createFixture();
    const entered = deferred();
    const release = deferred();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- restored after the fixture and called with the original receiver
    const { reconcile } = ExecutionCoordinator.prototype;
    ExecutionCoordinator.prototype.reconcile = async function () { entered.resolve(); await release.promise; await reconcile.call(this); };
    try {
      const a = fixture.folder("stop-during-open");
      const storage = fixture.storage(a);
      await seedRun(a, storage);
      host.folders = [a];
      fixture.start();
      const opening = fixture.open();
      await entered.promise;
      assert.ok(host.panel);
      assert.match(host.panel.webview.html, /data-execution-action="pause-all"/);
      assert.match(host.panel.webview.html, /data-execution-action="reconcile"/);
      assert.equal(host.stopVisible, true);
      await fixture.run("stopAll");
      const repository = new SqliteProjectRepository(path.join(storage, "project.sqlite"));
      try {
        const stopped = repository.read();
        assert.equal(stopped.schedulingPaused, true);
        assert.ok(stopped.executionRuns.some(ownsExecutionLease));
        release.resolve();
        await opening;
        assert.deepEqual(repository.read().executionRuns, stopped.executionRuns);
      } finally { repository.close(); }
    } finally {
      release.resolve();
      ExecutionCoordinator.prototype.reconcile = reconcile;
      fixture.dispose();
    }
  });

  test("does not rename a reopened instance when an old native prompt resolves", async () => {
    const fixture = createFixture();
    const entered = deferred();
    let resolveName: (name: string) => void = () => {};
    const answer = new Promise<string>(resolve => { resolveName = resolve; });
    try {
      const a = fixture.folder("reopened");
      host.folders = [a];
      fixture.start();
      await fixture.open();
      host.rename = () => { entered.resolve(); return answer; };
      const rename = fixture.run("renameProject");
      await entered.promise;
      host.changed.fire({ added: [a], removed: [a] });
      await fixture.open();
      resolveName("Obsolete rename");
      await rename;
      const repository = new SqliteProjectRepository(path.join(fixture.storage(a), "project.sqlite"));
      try { assert.equal(repository.read().name, a.name); }
      finally { repository.close(); }
      assert.deepEqual(host.errors, []);
    } finally { resolveName(""); fixture.dispose(); }
  });

  test("disposes remaining resources and closes SQLite last after a throwing disposer", async () => {
    const fixture = createFixture();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- restored after the fixture and called with the original receiver
    const { dispose } = ExecutionCoordinator.prototype;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- restored after the fixture and called with the original receiver
    const { close } = SqliteProjectRepository.prototype;
    const calls: string[] = [];
    ExecutionCoordinator.prototype.dispose = function () {
      calls.push("execution");
      dispose.call(this);
      throw new Error("Fixture disposer failure");
    };
    SqliteProjectRepository.prototype.close = function () { calls.push(`close:${this.read().name}`); close.call(this); };
    try {
      const a = fixture.folder("throwing-disposer");
      const b = fixture.folder("replacement");
      host.folders = [a];
      fixture.start();
      await fixture.open();
      host.folders = [b];
      host.changed.fire({ added: [b], removed: [a] });
      await fixture.open();
      assert.deepEqual(calls, ["execution", "close:throwing-disposer"]);
      assert.equal(host.watcherDisposals, 1);
      assert.ok(existsSync(path.join(fixture.storage(b), "project.sqlite")));
      await fixture.propose("After the prior project disposer threw");
    } finally {
      ExecutionCoordinator.prototype.dispose = dispose;
      SqliteProjectRepository.prototype.close = close;
      fixture.dispose();
    }
  });
});
