import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as vscode from "vscode";
import { CoordinationController } from "../../src/coordination-controller.js";
import type { CoordinationMessage } from "../../src/coordination-actions.js";
import type { CodexConversationClient } from "../../src/codex-conversation-client.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { WorkView } from "../../src/work-view.js";

type Client = Pick<CodexConversationClient, "connect" | "respond" | "interrupt" | "dispose">;
// Prepared for the next explicitly approved GUI slot. Provider output and native spending
// approval are fixtures. Webview, message parser, controller and SQLite remain real.
suite("Read-only assignment actual Host journey", () => {
  test("clicks target independent assignments and preserves private input through stop and idea return", async function () {
    this.timeout(35_000);
    const directory = mkdtempSync(path.join(tmpdir(), "piarre-coordination-workspace-"));
    const dbPath = path.join(directory, "project.sqlite"); const repository = new SqliteProjectRepository(dbPath);
    const initial = repository.open({ repositoryUri: pathToFileURL(directory).href, name: "Coordination Host fixture" });
    const draft = await new GoalInterpreter().propose("Set refund policy to 45 days");
    repository.dispatch({ commandId: "parent", projectId: initial.projectId, expectedProjectRevision: initial.revision, action: { kind: "propose-tasks", draft } });
    const parent = repository.read(); const task = parent.tasks[0]; assert.ok(task);
    const calls: CoordinationMessage[] = []; const prompts: string[] = []; const interruptions: number[] = [];
    let releaseFirst: () => void = () => { throw new Error("First worker not requested"); };
    let serial = 0;
    const clients: Client[] = [];
    const createClient = (): Client => {
      const index = serial++;
      let finish: (status: "completed" | "interrupted") => void = () => undefined;
      const client: Client = {
        connect: () => Promise.resolve({ kind: "ready", authType: "unknown" }),
        respond: input => {
          prompts.push(input.prompt); assert.equal(input.serviceTierForTurn, "default");
          input.onThreadStarted?.(`host-thread-${String(index)}`); input.onTurnStarted?.(`host-thread-${String(index)}`, `host-turn-${String(index)}`);
          return new Promise(resolve => {
            finish = status => { resolve({ status, threadId: `host-thread-${String(index)}`, turnId: `host-turn-${String(index)}`, output: status === "completed" ? { summary: "Host sourced finding", sourceIndexes: [0] } : null }); };
            if (index === 0) releaseFirst = () => { finish("completed"); };
          });
        },
        interrupt: () => { interruptions.push(index); finish("interrupted"); return Promise.resolve(); },
        dispose: () => { finish("interrupted"); },
      };
      clients.push(client); return client;
    };
    let panel: vscode.WebviewPanel | undefined;
    let completion: Promise<void> | undefined;
    let report: (value: unknown) => void = () => undefined;
    const observed = new Promise<unknown>(resolve => { report = resolve; });
    const deadline = setTimeout(() => { report({ kind: "coordination-journey-result", ok: false, error: "Host coordination journey timeout" }); }, 25_000);
    const controller = new CoordinationController(repository, snapshot => { view.update(snapshot); }, createClient);
    const handle = async (message: CoordinationMessage) => {
      calls.push(message);
      try {
        if (message.action === "prepare") {
          controller.prepare({ requestId: message.requestId, parentTaskId: task.taskId, purpose: "Review the refund requirement", scope: "Supplied project records", model: "fixture-model", workers: 2, durationMs: 120_000, maxTokens: 100 });
          assert.equal(prompts.length, 0);
        } else if (message.action === "steer" && message.id && message.assignmentId) {
          controller.steer(message.id, message.assignmentId, message.requestId, "Look for contradictory requirements");
        } else if (message.action === "approve" && message.id) {
          // This click explicitly authorizes the fixture instead of automating a native dialog.
          const group = repository.read().coordination.groups.find(group => group.groupId === message.id); assert.ok(group);
          completion = controller.approveAndRun(group.groupId, group.preparedAtRevision, `host-native-approval-fixture-${message.requestId}`);
          await completion;
          await panel?.webview.postMessage({ kind: "coordination-journey-terminal" });
        } else if (message.action === "stop" && message.id && message.assignmentId) {
          await controller.stop(message.id, message.assignmentId); releaseFirst();
        } else if (message.action === "capture") {
          controller.captureIdea({ requestId: message.requestId, parentTaskId: task.taskId, text: "Return to refund decision", returnPoint: "Review criterion 1 with the completed finding" });
        } else if (message.action === "return" && message.id) controller.returnIdea(message.id);
      } catch (error) { report({ kind: "coordination-journey-result", ok: false, error: String(error) }); }
    };
    const view = new WorkView((...args) => {
      const next = vscode.window.createWebviewPanel(...args); panel = next;
      next.webview.onDidReceiveMessage((message: unknown) => {
        if (typeof message === "object" && message !== null && "kind" in message && message.kind === "coordination-journey-result") report(message);
      }); return next;
    }, undefined, undefined, undefined, { handle: () => Promise.resolve() }, { handle });
    try {
      view.show(repository.read()); assert.ok(panel);
      panel.webview.html = panel.webview.html.replace("</script>", `${journeyScript()}</script>`);
      assert.deepEqual(await observed, { kind: "coordination-journey-result", ok: true });
      await completion;
      assert.equal(prompts.length, 2); assert.deepEqual(interruptions, [1]);
      assert.ok(prompts[0]?.includes("Look for contradictory requirements")); assert.equal(prompts[1]?.includes("Look for contradictory requirements"), false);
      assert.equal(prompts.some(prompt => prompt.includes("private unsent fixture")), false);
      const group = repository.read().coordination.groups[0]; assert.ok(group);
      assert.equal(calls.find(call => call.action === "prepare")?.requestId, group.requestId);
      assert.ok(calls.some(call => call.action === "stop" && call.assignmentId === group.assignments[1]?.assignmentId));
      assert.deepEqual(repository.read().tasks, parent.tasks); assert.deepEqual(repository.read().executionRuns, parent.executionRuns);
      assert.ok(repository.read().coordination.ideas[0]?.returnedAt);
      controller.dispose(); const durable = repository.read(); repository.close();
      const reopened = new SqliteProjectRepository(dbPath); try { assert.deepEqual(reopened.read(), durable); } finally { reopened.close(); }
    } finally {
      clearTimeout(deadline); for (const client of clients) client.dispose(); await completion?.catch(() => undefined);
      controller.dispose(); view.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true });
    }
  });
});
function journeyScript(): string {
  return `(async()=>{try{
    const wait=async condition=>{const deadline=Date.now()+20000;while(!condition()){if(Date.now()>deadline)throw new Error('Coordination browser condition timeout');await new Promise(resolve=>setTimeout(resolve,10));}};
    const overview=document.getElementById('agent-overview');let terminal=false;window.addEventListener('message',({data})=>{if(data.kind==='coordination-journey-terminal')terminal=true;});
    goal.value='private unsent fixture';goal.dispatchEvent(new Event('input'));goal.focus();goal.setSelectionRange(2,8);
    const stable=()=>{if(goal.value!=='private unsent fixture'||document.activeElement!==goal||goal.selectionStart!==2||goal.selectionEnd!==8)throw new Error('Coordination update lost private input or selection');};
    const click=(action,extra='')=>{const button=overview.querySelector('[data-coordination-action="'+action+'"]'+extra);if(!button)throw new Error('Missing coordination control '+action);button.click();};
    click('prepare');await wait(()=>overview.querySelector('[data-coordination-action="approve"]'));stable();
    click('steer');await wait(()=>overview.textContent.includes('Look for contradictory requirements'));stable();
    click('approve');await wait(()=>overview.textContent.includes('host-thread-1 / host-turn-1'));stable();
    const stops=[...overview.querySelectorAll('[data-coordination-action="stop"]')];if(stops.length!==2)throw new Error('Independent stop controls unavailable');
    stops[1].click();await wait(()=>terminal);stable();
    for(const text of ['Host sourced finding','interrupted','Finding proposal; sources','standard service tier']){if(!overview.textContent.includes(text))throw new Error('Missing recorded worker fact '+text);}
    click('capture');await wait(()=>overview.textContent.includes('Review criterion 1 with the completed finding'));stable();
    click('return');await wait(()=>!overview.querySelector('[data-coordination-action="return"]'));stable();
    api.postMessage({kind:'coordination-journey-result',ok:true});
  }catch(error){api.postMessage({kind:'coordination-journey-result',ok:false,error:String(error)});}})();`;
}
