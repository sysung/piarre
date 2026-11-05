import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import { type ReflectionAction } from "../../../../packages/core/src/index.js";
import { ReflectionController } from "../../src/reflection-controller.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { WorkView } from "../../src/work-view.js";

suite("Reflection controller lifecycle", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  let view: WorkView;
  let controller: ReflectionController;
  let panel: vscode.WebviewPanel;
  let choices: (string | undefined)[];
  let feedback: string | undefined;
  let beforeChoice: (() => void) | undefined;
  let warning: (() => Promise<void>) | undefined;
  let warnings: string[];
  let closes: number;
  const originals = new Map<string, PropertyDescriptor>();
  const dispatch = (action: ReflectionAction) => {
    const project = repository.read();
    return repository.dispatch({ commandId: randomUUID(), projectId: project.projectId, expectedProjectRevision: project.revision, action });
  };
  const pendingId = () => {
    const pending = repository.read().reflections.find(item => item.status === "pending");
    assert.ok(pending); return pending.reflectionId;
  };
  const reopen = () => {
    repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
  };
  const attach = () => {
    panel = vscode.window.createWebviewPanel("piarre.reflection.fixture", "Reflection lifecycle fixture", vscode.ViewColumn.One, { enableScripts: true });
    view.resolveWebviewView({ webview: panel.webview, show: () => { panel.reveal(); }, onDidDispose: panel.onDidDispose,
      get visible() { return panel.visible; }, onDidChangeVisibility: listener => panel.onDidChangeViewState(() => { listener(); }) });
  };
  const connect = () => {
    view = new WorkView();
    view.update(repository.read()); attach();
    controller = new ReflectionController(repository, project => { view.update(project); }, () => { closes++; view.close(); });
  };
  const assertClosed = () => {
    assert.equal(closes, 1);
    assert.match(panel.webview.html, /Open a trusted local Git repository/);
    assert.doesNotMatch(panel.webview.html, /Reflection lifecycle project/);
  };
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-reflection-controller-"));
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    repository.open({ repositoryUri: vscode.Uri.file(directory).toString(), name: "Reflection lifecycle project" });
    choices = []; feedback = undefined; beforeChoice = undefined; warning = undefined; warnings = []; closes = 0;
    for (const name of ["showQuickPick", "showInputBox", "showWarningMessage"]) {
      const descriptor = Object.getOwnPropertyDescriptor(vscode.window, name);
      assert.ok(descriptor); originals.set(name, descriptor);
    }
    Object.defineProperty(vscode.window, "showQuickPick", { configurable: true, value: (items: readonly (string | vscode.QuickPickItem)[]) => {
      const choice = choices.shift(); beforeChoice?.(); beforeChoice = undefined;
      return Promise.resolve(items.find(item => (typeof item === "string" ? item : item.label) === choice));
    } });
    Object.defineProperty(vscode.window, "showInputBox", { configurable: true, value: () => Promise.resolve(feedback) });
    Object.defineProperty(vscode.window, "showWarningMessage", { configurable: true, value: async (message: string) => { warnings.push(message); await warning?.(); } });
    connect();
  });
  teardown(() => {
    for (const [name, descriptor] of originals) Object.defineProperty(vscode.window, name, descriptor);
    originals.clear(); controller.dispose(); view.dispose(); panel.dispose(); repository.close();
    rmSync(directory, { recursive: true, force: true });
  });

  for (const [choice, status] of [["Decline and close", "declined"], ["Mark reviewed and close", "reviewed"]] satisfies [string, string][]) {
    test(`${choice} persists its resolution and leaves the actual Work view closed`, async () => {
      dispatch({ kind: "offer-reflection" }); const before = repository.read();
      choices.push(choice); await controller.handle("review"); assertClosed();
      reopen();
      const after = repository.read(); assert.equal(after.reflections.at(-1)?.status, status);
      assert.deepEqual(after.executionRuns, before.executionRuns); assert.deepEqual(after.tasks, before.tasks);
      assert.deepEqual(after.knowledge, before.knowledge); assert.equal(after.schedulingPaused, before.schedulingPaused);
      assert.deepEqual(warnings, []);
    });
  }

  test("close now preserves pending reflection through surface disposal and a new controller and SQLite connection", async () => {
    dispatch({ kind: "offer-reflection" }); const before = repository.read();
    choices.push("Close now; keep pending"); await controller.handle("review"); assertClosed();
    controller.dispose(); view.dispose(); panel.dispose(); reopen();
    assert.deepEqual(repository.read(), before); connect();
    assert.match(panel.webview.html, /reflection is pending/);
    choices.push("Decline and close"); closes = 0; await controller.handle("review"); assertClosed();
    assert.equal(repository.read().reflections.at(-1)?.status, "declined");
    panel.dispose(); attach(); assertClosed();
  });

  test("forced surface and controller disposal recover pending reflection without resolving it", () => {
    dispatch({ kind: "offer-reflection" }); const before = repository.read();
    controller.dispose(); view.dispose(); panel.dispose(); reopen(); connect();
    assert.deepEqual(repository.read(), before);
    assert.match(panel.webview.html, /reflection is pending/);
    assert.equal(closes, 0);
  });

  test("canceling reflection and correction leaves durable state and the view unchanged", async () => {
    dispatch({ kind: "offer-reflection" }); const before = repository.read();
    choices.push(undefined); await controller.handle("review");
    choices.push("Add feedback or correction"); await controller.handle("review");
    assert.deepEqual(repository.read(), before); assert.equal(closes, 0);
    assert.match(panel.webview.html, /Reflection lifecycle project/);
  });

  test("correction records feedback as a proposal without changing policy or preferences", async () => {
    dispatch({ kind: "offer-reflection" }); const before = repository.read();
    choices.push("Add feedback or correction"); feedback = "The proposed result still needs my review.";
    await controller.handle("review");
    const after = repository.read(); assert.deepEqual(after.reflections.at(-1)?.feedback, [feedback]);
    assert.equal(after.reflections.at(-1)?.status, "pending"); assert.equal(closes, 0);
    assert.deepEqual(after.knowledge, before.knowledge); assert.deepEqual(after.tasks, before.tasks);
    assert.equal(after.explanationPreference, before.explanationPreference); assert.equal(after.expertisePreference, before.expertisePreference);
  });

  test("optional preferences can be skipped, canceled, changed and reset through native dialog choices", async () => {
    const before = repository.read();
    for (const path of [[undefined], ["Skip"], ["Component familiarity", undefined], ["Component familiarity", "Keep current / skip"], ["Explanation detail", undefined], ["Explanation detail", "Keep current / skip"]]) {
      choices.push(...path); await controller.handle("preference");
    }
    assert.deepEqual(repository.read(), before);
    choices.push("Component familiarity", "Learning"); await controller.handle("preference");
    assert.equal(repository.read().expertisePreference, "learning");
    choices.push("Component familiarity", "Unspecified (reset)"); await controller.handle("preference");
    assert.equal(repository.read().expertisePreference, "unspecified");
    choices.push("Explanation detail", "Guided"); await controller.handle("preference");
    assert.equal(repository.read().explanationPreference, "guided");
    choices.push("Explanation detail", "Default (reset)"); await controller.handle("preference");
    assert.equal(repository.read().explanationPreference, "default"); assert.equal(closes, 0);
  });

  test("persistence failure closes before its warning is dismissed and preserves recoverable pending work", async () => {
    dispatch({ kind: "offer-reflection" }); const before = repository.read();
    choices.push("Decline and close"); beforeChoice = () => { repository.close(); };
    let dismiss: (() => void) | undefined;
    let warned: (() => void) | undefined;
    const shown = new Promise<void>(resolve => { warned = resolve; });
    warning = () => new Promise(resolve => { dismiss = resolve; warned?.(); });
    const handling = controller.handle("review");
    await shown;
    try { assertClosed(); assert.equal(warnings.length, 1); }
    finally { dismiss?.(); await handling; }
    reopen(); assert.deepEqual(repository.read(), before);
  });

  test("resolution changed while the dialog is open still permits closing and preserves the recorded choice", async () => {
    dispatch({ kind: "offer-reflection" }); const id = pendingId();
    choices.push("Decline and close");
    beforeChoice = () => { dispatch({ kind: "resolve-reflection", reflectionId: id, resolution: "reviewed" }); };
    await controller.handle("review"); assertClosed();
    reopen(); assert.equal(repository.read().reflections.at(-1)?.status, "reviewed"); assert.equal(warnings.length, 1);
  });
});
