import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import type { ProjectCommand, ProposalDraft } from "../../../../packages/core/src/index.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { SidebarFixture } from "./sidebar-fixture.js";

suite("Activity real webview journey", () => {
  test("reads SQL pages on demand, navigates exact sources, and preserves disclosure, page, draft and focus on updates", async function () {
    this.timeout(30_000);
    const directory = mkdtempSync(path.join(tmpdir(), "piarre-activity-view-"));
    const repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    const project = repository.open({ repositoryUri: "file:///activity-view", name: "Activity journey" });
    const dispatch = (action: ProjectCommand["action"]): void => {
      const current = repository.read();
      assert.equal(repository.dispatch({ commandId: `event-${String(current.revision)}`, projectId: current.projectId, expectedProjectRevision: current.revision, action }).kind, "applied");
    };
    const draft: ProposalDraft = { source: "deterministic-draft", goal: "Inspect exact Activity sources", tasks: [{ key: "one", title: "Source task", requirements: [{ key: "r", text: "Preserve revision links" }], proposedScope: { included: ["one.txt"], excluded: [] }, checks: [{ key: "c", requirementKeys: ["r"], description: "Inspect source" }], dependsOn: [], proposedBudget: { maxTokens: 1000, maxElapsedMinutes: 1, maxAttempts: 1 } }] };
    for (let index = 0; index < 44; index++) dispatch(index % 10 === 0 ? { kind: "propose-tasks", draft } : { kind: "rename-project", name: `Activity ${String(index)}` });
    dispatch({ kind: "observe-knowledge", topic: "Activity rule", category: "business", submitted: { requestId: "activity-rule", projectId: project.projectId, contextRevision: repository.read().revision, originalStatement: "Observed milestones do not approve work." }, affectedTaskIds: [] });
    let panel: vscode.WebviewPanel | undefined;
    let proposalPanel: vscode.WebviewPanel | undefined;
    let readCount = 0;
    const requests: unknown[] = [];
    let finish: (message: unknown) => void = () => undefined;
    const outcome = new Promise<unknown>(resolve => { finish = resolve; });
    const timer = setTimeout(() => { finish({ kind: "activity-result", ok: false, error: "Activity renderer timed out" }); }, 25_000);
    const view = new SidebarFixture((...args) => {
      const created = vscode.window.createWebviewPanel(...args);
      if (args[0] !== "piarre.sidebar.fixture") { proposalPanel = created; return created; }
      panel = created;
      panel.webview.onDidReceiveMessage((message: unknown) => {
        requests.push(message);
        if (typeof message !== "object" || message === null || !("kind" in message)) return;
        if (message.kind === "activity-result") finish(message);
        if (message.kind === "activity-fixture-refresh") {
          dispatch({ kind: "rename-project", name: `Refresh ${String(repository.read().revision)}` }); view.update(repository.read());
        }
        if (message.kind === "activity-fixture-read-count") void created.webview.postMessage({ kind: "activity-read-count", count: readCount });
      });
      return created;
    }, undefined, undefined, undefined, undefined, undefined, (projectId, query) => {
      assert.equal(projectId, project.projectId); readCount++; return repository.readActivityEvents(query);
    });
    try {
      view.show(repository.read()); assert.ok(panel);
      panel.webview.html = panel.webview.html.replace("</script>", `
(async()=>{try{
const wait=async predicate=>{const deadline=Date.now()+15000;while(!predicate()){if(Date.now()>deadline)throw Error('Activity state did not arrive');await new Promise(resolve=>setTimeout(resolve,10));}};
const disclosure=document.getElementById('observed-activity');const content=document.getElementById('activity-content');const input=document.getElementById('goal');
await wait(()=>document.getElementById('inspection').querySelector('[data-open-goal]'));
if(document.querySelectorAll('.workspace-nav [data-pane]').length!==4||disclosure.open)throw Error('Activity changed the four-tab/default-disclosure contract');
api.postMessage({kind:'activity-page',projectId:'another-project',beforeRevision:null});api.postMessage({kind:'activity-page',projectId,beforeRevision:0});api.postMessage({kind:'activity-page',projectId,beforeRevision:null,limit:5000});
let reads;window.addEventListener('message',({data})=>{if(data.kind==='activity-read-count')reads=data.count;});api.postMessage({kind:'activity-fixture-read-count'});await wait(()=>reads!==undefined);if(reads!==0)throw Error('Closed Activity eagerly read history');
input.value='PRIVATE unsent Activity follow-up';input.dispatchEvent(new Event('input',{bubbles:true}));
document.querySelector('[data-pane="agents"]').click();disclosure.querySelector('summary').click();await wait(()=>content.querySelector('[data-activity-revision]'));
if(content.querySelectorAll('[data-activity-revision]').length!==20)throw Error('First SQL page was not bounded');
const knowledge=[...content.querySelectorAll('[data-activity-knowledge]')][0];if(!knowledge)throw Error('Knowledge identity missing');knowledge.closest('details').open=true;knowledge.click();
if(document.getElementById('knowledge-pane').hidden)throw Error('Knowledge source did not navigate');
const source=[...document.querySelectorAll('#knowledge [data-knowledge-id]')].find(item=>item.dataset.knowledgeId===knowledge.dataset.activityKnowledge);if(!source||!source.closest('article').querySelector('details').open)throw Error('Exact knowledge versions were not exposed');
document.querySelector('[data-pane="agents"]').click();document.getElementById('activity-older').click();await wait(()=>!document.getElementById('activity-newest').disabled);
const olderRevision=content.querySelector('[data-activity-revision]').dataset.activityRevision;const olderCursor=activityBefore;
const historicalSource=content.querySelector('details');if(!historicalSource)throw Error('Older source missing');historicalSource.open=true;historicalSource.querySelector('summary').focus();const key=historicalSource.dataset.activitySource;
const currentRevision=content.textContent.match(/current project revision (\\d+)/)[1];api.postMessage({kind:'activity-fixture-refresh'});
await wait(()=>content.textContent.includes('current project revision '+String(Number(currentRevision)+1)));
if(!disclosure.open||activityBefore!==olderCursor||content.querySelector('[data-activity-revision]').dataset.activityRevision!==olderRevision)throw Error('Background update reset Activity page');
const preserved=[...content.querySelectorAll('details')].find(item=>item.dataset.activitySource===key);if(!preserved?.open||document.activeElement!==preserved.querySelector('summary'))throw Error('Background update reset source disclosure or focus');
const link=preserved.querySelector('button');if(!link)throw Error('Historical page has no current source navigation');link.focus();api.postMessage({kind:'activity-fixture-refresh'});
await wait(()=>content.textContent.includes('current project revision '+String(Number(currentRevision)+2)));
const linkAfter=[...content.querySelectorAll('details')].find(item=>item.dataset.activitySource===key)?.querySelector('button');if(document.activeElement!==linkAfter)throw Error('Background inspection stole Activity link focus');
document.querySelector('[data-pane="chat"]').click();input.focus();const secondRevision=Number(currentRevision)+2;api.postMessage({kind:'activity-fixture-refresh'});await wait(()=>content.textContent.includes('current project revision '+String(secondRevision+1)));
if(document.activeElement!==input||input.value!=='PRIVATE unsent Activity follow-up'||!disclosure.open||activityBefore!==olderCursor)throw Error('Activity update stole composer state or focus');
document.querySelector('[data-pane="agents"]').click();document.getElementById('activity-newest').click();await wait(()=>document.getElementById('activity-newest').disabled&&Number(content.querySelector('[data-activity-revision]').dataset.activityRevision)===secondRevision+1);
const proposal=content.querySelector('[data-open-goal]');if(!proposal)throw Error('Current proposal navigation missing');proposal.closest('details').open=true;proposal.click();
api.postMessage({kind:'activity-result',ok:true});
}catch(error){api.postMessage({kind:'activity-result',ok:false,error:String(error)});}})();</script>`);
      assert.deepEqual(await outcome, { kind: "activity-result", ok: true });
      assert.ok(proposalPanel, "Activity opens the existing native proposal inspector");
      assert.match(proposalPanel.webview.html, /Source task/);
      assert.ok(readCount >= 4, "Newest, Older and current-state updates read bounded SQL pages");
      assert.ok(!requests.some(message => typeof message === "object" && message !== null && "kind" in message && ["send-conversation", "connect-codex"].includes(String(message.kind))), "Activity never contacts a provider");
      assert.doesNotMatch(JSON.stringify(repository.readDiagnosticSnapshot().events), /PRIVATE unsent Activity follow-up/);
    } finally { clearTimeout(timer); proposalPanel?.dispose(); view.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true }); }
  });
});
