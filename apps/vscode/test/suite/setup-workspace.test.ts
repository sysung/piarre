import assert from "node:assert/strict";
import * as vscode from "vscode";
import { WorkView } from "../../src/work-view.js";
import { replay } from "../../../../packages/core/src/index.js";

suite("First-time Codex setup", () => {
  test("waits for explicit connection, keeps failures visible, then reveals the preserved draft", async function () {
    this.timeout(20_000);
    const project = replay([{ kind: "project-created", projectId: "setup-test", repositoryUri: "file:///setup-test", name: "Setup" }]);
    let connects = 0; let sends = 0;
    const view = new WorkView(undefined, undefined, undefined, {
      connect: () => {
        connects++;
        view.updateConversation(project, { kind: "connecting", message: "Checking fixture connection" });
        if (connects === 1) view.updateConversation(project, { kind: "disconnected", message: "Sign in with Codex, then try again." });
        return Promise.resolve();
      }, disconnect: () => undefined, interrupt: () => Promise.resolve(), send: () => { sends++; return Promise.resolve(); },
    });
    const panel = vscode.window.createWebviewPanel("piarre.setup.fixture", "Piarre setup fixture", vscode.ViewColumn.One, { enableScripts: true });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      view.update(project);
      const result = new Promise<unknown>(resolve => {
        deadline = setTimeout(() => { resolve({ ok: false, error: "Setup webview timed out" }); }, 15_000);
        panel.webview.onDidReceiveMessage((message: unknown) => {
          if (typeof message !== "object" || message === null || !("kind" in message)) return;
          if (message.kind === "test-connect-ready") view.updateConversation(project, { kind: "ready", message: "Fixture connected" });
          if (message.kind === "test-setup-result") resolve(message);
        });
      });
      view.resolveWebviewView({ webview: panel.webview, show: () => { panel.reveal(); }, onDidDispose: panel.onDidDispose,
        get visible() { return panel.visible; }, onDidChangeVisibility: listener => panel.onDidChangeViewState(() => { listener(); }) });
      panel.webview.html = panel.webview.html.replace("</script>", `
(async()=>{const wait=async f=>{const until=Date.now()+10000;while(!f()){if(Date.now()>until)throw new Error('Setup condition timed out');await new Promise(r=>setTimeout(r,10));}};try{
const overlay=document.getElementById('setup-overlay'),button=document.getElementById('connect-codex');
if(overlay.hidden||!document.querySelector('.workspace-nav').inert)throw new Error('First-time setup must cover inactive chat');
goal.value='Preserve my first thought';goal.dispatchEvent(new Event('input'));
button.click();await wait(()=>document.getElementById('setup-status').textContent.includes('Sign in'));
if(overlay.hidden||button.disabled||!button.textContent.includes('Try again'))throw new Error('Failure must retain setup and allow retry');
button.click();await wait(()=>button.disabled&&button.textContent.includes('Connecting'));
if(overlay.hidden)throw new Error('Connecting is not connected');
api.postMessage({kind:'test-connect-ready'});await wait(()=>overlay.hidden);
if(goal.value!=='Preserve my first thought'||document.activeElement!==goal||document.querySelector('.workspace-nav').inert)throw new Error('Success must preserve draft and restore chat focus');
api.postMessage({kind:'test-setup-result',ok:true});
}catch(error){api.postMessage({kind:'test-setup-result',ok:false,error:String(error)});}})();</script>`);
      assert.deepEqual(await result, { kind: "test-setup-result", ok: true });
      assert.equal(connects, 2);
      assert.equal(sends, 0, "Connection and setup never send the unsent draft");
    } finally { if (deadline) clearTimeout(deadline); view.dispose(); panel.dispose(); }
  });
  test("Continue offline reveals chat and deterministic drafting with zero provider calls", async function () {
    this.timeout(20_000);
    const project = replay([{ kind: "project-created", projectId: "offline-test", repositoryUri: "file:///offline-test", name: "Offline" }]);
    let connects = 0; let sends = 0;
    const view = new WorkView(undefined, undefined, undefined, {
      connect: () => { connects++; return Promise.resolve(); }, disconnect: () => {}, interrupt: () => Promise.resolve(),
      send: () => { sends++; return Promise.resolve(); },
    });
    const panel = vscode.window.createWebviewPanel("piarre.offline.fixture", "Piarre offline fixture", vscode.ViewColumn.One, { enableScripts: true });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      view.update(project);
      const result = new Promise<unknown>(resolve => {
        deadline = setTimeout(() => { resolve({ ok: false, error: "Offline webview timed out" }); }, 15_000);
        panel.webview.onDidReceiveMessage((message: unknown) => { if (typeof message === "object" && message !== null && "kind" in message && message.kind === "test-offline-result") resolve(message); });
      });
      view.resolveWebviewView({ webview: panel.webview, show: () => { panel.reveal(); }, onDidDispose: panel.onDidDispose,
        get visible() { return panel.visible; }, onDidChangeVisibility: listener => panel.onDidChangeViewState(() => { listener(); }) });
      panel.webview.html = panel.webview.html.replace("</script>", `
(async()=>{const wait=async f=>{const until=Date.now()+10000;while(!f()){if(Date.now()>until)throw new Error('Offline condition timed out');await new Promise(r=>setTimeout(r,10));}};try{
goal.value='Preserve my offline thought';goal.dispatchEvent(new Event('input'));
document.getElementById('continue-offline').click();
if(!document.getElementById('setup-overlay').hidden||document.querySelector('.workspace-nav').inert||document.activeElement!==goal)throw new Error('Offline entry must reveal and focus chat');
if(!send.disabled||!setupCompleted||api.getState().setupCompleted!==true||goal.value!=='Preserve my offline thought')throw new Error('Offline state must persist without enabling Send');
const offlineDraft=api.getState().drafts.find(row=>row[0]===sessionId);if(offlineDraft[1].text!==goal.value)throw new Error('Offline draft was not persisted');
setContext(true);document.getElementById('prepare').click();await wait(()=>!document.getElementById('preview').hidden);
if(document.getElementById('preview').textContent.length===0)throw new Error('Offline deterministic plan missing');
api.postMessage({kind:'test-offline-result',ok:true});
}catch(error){api.postMessage({kind:'test-offline-result',ok:false,error:String(error)});}})();</script>`);
      assert.deepEqual(await result, { kind: "test-offline-result", ok: true });
      assert.equal(connects, 0); assert.equal(sends, 0);
    } finally { if (deadline) clearTimeout(deadline); view.dispose(); panel.dispose(); }
  });

});
