import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import { currentKnowledge } from "../../../../packages/core/src/index.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { WorkView } from "../../src/work-view.js";

// Prepared for an explicitly authorized Extension Host slot. No provider/account is used.
suite("Resumption real webview journey", () => {
  test("opens exact correction sources without losing unsent input and persists the observed visit", async function () {
    this.timeout(20_000);
    const directory = mkdtempSync(path.join(tmpdir(), "piarre-resumption-view-"));
    const database = path.join(directory, "project.sqlite");
    const repository = new SqliteProjectRepository(database);
    const initial = repository.open({ repositoryUri: "file:///resumption-view", name: "Resumption journey" });
    repository.dispatch({ commandId: "observe", projectId: initial.projectId, expectedProjectRevision: initial.revision, action: { kind: "observe-knowledge", topic: "Refund policy", category: "business", submitted: { requestId: "original", projectId: initial.projectId, contextRevision: initial.revision, originalStatement: "30 days" }, affectedTaskIds: [] } });
    const observed = currentKnowledge(repository.read())[0]; assert.ok(observed);
    repository.dispatch({ commandId: "confirm-fixture", projectId: initial.projectId, expectedProjectRevision: repository.read().revision, action: { kind: "confirm-knowledge", target: { projectId: initial.projectId, knowledgeId: observed.knowledgeId, recordedAtRevision: observed.recordedAtRevision } } });
    const prior = repository.read(); repository.beginVisit(); repository.recordVisitedRevision(initial.projectId, prior.revision);
    let panel: vscode.WebviewPanel | undefined;
    let finish: (message: unknown) => void = () => undefined;
    const outcome = new Promise<unknown>(resolve => { finish = resolve; });
    const deadline = setTimeout(() => { finish({ kind: "resumption-result", ok: false, error: "Renderer journey timed out" }); }, 15_000);
    const view = new WorkView((...args) => {
      panel = vscode.window.createWebviewPanel(...args);
      panel.webview.onDidReceiveMessage((message: unknown) => {
        if (typeof message !== "object" || message === null || !("kind" in message)) return;
        if (message.kind === "resumption-result") finish(message);
        if (message.kind === "resumption-correct-fixture") {
          const entry = currentKnowledge(repository.read())[0]; assert.ok(entry);
          const project = repository.read();
          repository.dispatch({ commandId: "correction-fixture", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "correct-knowledge", target: { projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision }, submitted: { requestId: "replacement", projectId: project.projectId, contextRevision: project.revision, originalStatement: "45 days" }, affectedTaskIds: [] } });
          view.update(repository.read());
        }
      });
      return panel;
    });
    try {
      view.setVisit(initial.projectId, { kind: "previous-visit", snapshot: prior }, revision => { repository.recordVisitedRevision(initial.projectId, revision); });
      view.show(prior); assert.ok(panel);
      panel.webview.html = panel.webview.html.replace("</script>", `
(async()=>{try{
 const input=document.getElementById('goal');input.value='Unsent follow-up';input.focus();
 api.postMessage({kind:'resumption-correct-fixture'});
 const deadline=Date.now()+10000;
 while(!document.getElementById('session-brief').textContent.includes('Refund policy: 45 days')){if(Date.now()>deadline)throw Error('Corrected brief did not arrive');await new Promise(resolve=>setTimeout(resolve,10));}
 if(input.value!=='Unsent follow-up'||document.activeElement!==input)throw Error('Brief refresh stole input/focus');
 const source=[...document.querySelectorAll('#session-brief details')].find(detail=>detail.querySelector('pre')?.textContent.includes('45 days'));
 if(!source)throw Error('Exact correction source unavailable');source.open=true;
 if(!source.textContent.includes('submitted-statement')||!source.textContent.includes('supersedes'))throw Error('Provenance missing');
 if(!document.getElementById('inspection').textContent.includes('30 days'))throw Error('Original revision unavailable');
 if(document.getElementById('discussion').open)throw Error('Inspection opened discussion');
 api.postMessage({kind:'resumption-result',ok:true});
}catch(error){api.postMessage({kind:'resumption-result',ok:false,error:String(error)});}})();</script>`);
      assert.deepEqual(await outcome, { kind: "resumption-result", ok: true });
      const snapshot = repository.read();
      const reopened = new SqliteProjectRepository(database);
      try {
        const visit = reopened.beginVisit(); assert.equal(visit.kind, "previous-visit");
        assert.equal(visit.snapshot.revision, snapshot.revision);
      } finally { reopened.close(); }
    } finally { clearTimeout(deadline); view.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true }); }
  });
});
