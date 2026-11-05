import { SidebarFixture } from "./sidebar-fixture.js";
import assert from "node:assert/strict";
import * as vscode from "vscode";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { currentTaskTriage, taskTriageRevision } from "../../../../packages/core/src/index.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { ExecutionCoordinator } from "../../src/execution-coordinator.js";
import { ExecutionUi, type TriageDialogs } from "../../src/execution-ui.js";

suite("Task triage Extension Host controls", () => {
  test("native review routes adopt, decline and reverse exact canonical triage without provider or runner calls", async () => {
    assert.equal(vscode.workspace.isTrusted, true);
    const directory = mkdtempSync(path.join(tmpdir(), "piarre-triage-host-"));
    const repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    let providerCalls = 0, runnerCalls = 0, publishCalls = 0;
    const coordinator = new ExecutionCoordinator({ repository, storageDirectory: directory, publish: () => { publishCalls++; },
      createClient: () => { providerCalls++; throw new Error("Triage cannot call the provider"); },
      createRunner: () => { runnerCalls++; throw new Error("Triage cannot run checks"); } });
    let consent = false;
    const reviews: { title: string; detail: string; approve: string }[] = [];
    const picks = ["high", "Deferred"], inputs = ["Wait for policy", "Focus current work"];
    const dialogs: TriageDialogs = {
      pick: () => Promise.resolve(picks.shift()), input: () => Promise.resolve(inputs.shift()),
      review: (title, detail, approve) => { reviews.push({ title, detail, approve }); return Promise.resolve(consent ? approve : undefined); },
    };
    const ui = new ExecutionUi(coordinator, () => repository.read(), () => { throw new Error("Triage cannot open a run result"); }, undefined, dialogs);
    try {
      const project = repository.open({ repositoryUri: "file:///triage-host", name: "Host triage" });
      repository.dispatch({ commandId: "tasks", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "propose-tasks", draft: await new GoalInterpreter().propose("Review policy") } });
      const task = repository.read().tasks[0]; assert.ok(task);
      await ui.handle({ kind: "execution", action: "triage", id: task.taskId });
      const proposal = repository.read().taskTriage.proposals[0]; assert.ok(proposal);
      assert.equal(currentTaskTriage(repository.read(), task.taskId).disposition.kind, "available");
      await ui.handle({ kind: "execution", action: "adopt-triage", id: proposal.proposalId });
      assert.equal(repository.read().taskTriage.decisions.length, 0);
      consent = true; await ui.handle({ kind: "execution", action: "adopt-triage", id: proposal.proposalId });
      assert.equal(currentTaskTriage(repository.read(), task.taskId).disposition.kind, "deferred");
      const review = reviews[1]; assert.ok(review); assert.ok(review.detail.includes(`Proposal ${proposal.proposalId}, revision ${String(proposal.recordedAtRevision)}`));
      assert.ok(review.detail.includes("Previous: normal priority; available")); assert.ok(review.detail.includes("Wait for policy")); assert.ok(review.detail.includes("Focus current work"));
      assert.ok(review.detail.includes("never starts work or restores stale approval"));
      await assert.rejects(coordinator.prepare({ taskId: task.taskId, objective: "Blocked", relativePaths: ["policy.ts"], criteria: [], checks: [] }), /deferred/);
      await ui.handle({ kind: "execution", action: "reverse-triage", id: task.taskId });
      assert.equal(currentTaskTriage(repository.read(), task.taskId).disposition.kind, "available");
      const before = repository.read();
      assert.throws(() => { coordinator.recordTaskTriage({ kind: "propose-task-triage", taskId: task.taskId, basedOnTriageRevision: taskTriageRevision(before, task.taskId), desired: { priority: "low", disposition: { kind: "available" } }, rationale: "Stale review", origin: { kind: "user" } }, before.revision - 1); }, /changed during/);
      assert.deepEqual(repository.read(), before); assert.equal(providerCalls, 0); assert.equal(runnerCalls, 0);
      assert.equal(repository.read().executionPlans.length, 0); assert.equal(repository.read().executionRuns.length, 0); assert.equal(publishCalls, 3);
    } finally { ui.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true }); }
  });
  test("actual task-queue Webview clicks route proposal, adoption and reversal without running work", async function () {
    this.timeout(20000);
    const directory = mkdtempSync(path.join(tmpdir(), "piarre-triage-bridge-"));
    const repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    repository.open({ repositoryUri: "file:///triage-bridge", name: "Triage bridge" });
    const initial = repository.read(); repository.dispatch({ commandId: "bridge-tasks", projectId: initial.projectId, expectedProjectRevision: initial.revision, action: { kind: "propose-tasks", draft: await new GoalInterpreter().propose("Organize policy") } });
    let panel: vscode.WebviewPanel | undefined, handled = 0;
    const control = new ExecutionCoordinator({ repository, storageDirectory: directory,
      createClient: () => { throw new Error("Triage bridge cannot call a provider"); }, publish: snapshot => { view.update(snapshot); } });
    const picks = ["high", "Deferred"], inputs = ["Wait for review", "User queue choice"];
    const ui = new ExecutionUi(control, () => repository.read(), () => { throw new Error("No execution result"); }, undefined, {
      pick: () => Promise.resolve(picks.shift()), input: () => Promise.resolve(inputs.shift()), review: (_title, _detail, approve) => Promise.resolve(approve),
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finish: (() => void) | undefined, fail: ((error: Error) => void) | undefined;
    const journey = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; timer = setTimeout(() => { reject(new Error("Triage Webview journey timed out")); }, 15000); });
    const view: SidebarFixture = new SidebarFixture((...args) => {
      const created = vscode.window.createWebviewPanel(...args); panel = created;
      created.webview.onDidReceiveMessage((message: unknown) => {
        if (typeof message !== "object" || message === null || !("kind" in message)) return;
        if (message.kind === "triage-journey-done") finish?.();
        if (message.kind === "triage-journey-error" && "error" in message) fail?.(new Error(String(message.error)));
      });
      return created;
    }, undefined, undefined, undefined, { handle: async message => { await ui.handle(message); await panel?.webview.postMessage({ kind: "triage-handled", count: ++handled }); } });
    try {
      view.show(repository.read()); assert.ok(panel);
      panel.webview.html = panel.webview.html.replace("</script>", `
        let triageHandled=0;
        window.addEventListener('message',event=>{if(event.data.kind==='triage-handled')triageHandled=event.data.count;});
        async function triageWait(predicate){for(let i=0;i<200;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}throw new Error('Triage DOM did not update');}
        (async()=>{
          document.querySelector('[data-pane="agents"]').click();
          for(const [index,action] of ['triage','adopt-triage','reverse-triage'].entries()){
            await triageWait(()=>document.querySelector('[data-execution-action="'+action+'"]'));
            document.querySelector('[data-execution-action="'+action+'"]').click();
            await triageWait(()=>triageHandled===index+1);
          }
          api.postMessage({kind:'triage-journey-done'});
        })().catch(error=>api.postMessage({kind:'triage-journey-error',error:String(error)}));
      </script>`);
      await journey;
      assert.equal(handled, 3); assert.equal(repository.read().taskTriage.decisions.length, 2);
      const task = repository.read().tasks[0]; assert.ok(task); assert.equal(currentTaskTriage(repository.read(), task.taskId).disposition.kind, "available");
      assert.equal(repository.read().executionRuns.length, 0); assert.equal(repository.read().executionPlans.length, 0);
    } finally { clearTimeout(timer); ui.dispose(); view.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true }); }
  });

});
