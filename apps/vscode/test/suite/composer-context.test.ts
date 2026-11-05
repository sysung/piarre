import assert from "node:assert/strict";
import * as vscode from "vscode";
import { replay } from "../../../../packages/core/src/index.js";
import { renderWorkView } from "../../src/work-view.js";

suite("Composer context ownership", () => {
  test("accepting an older send preserves later model and context edits, including reverted text", async function () {
    this.timeout(20_000);
    const project = replay([{ kind: "project-created", projectId: "composer-context", repositoryUri: "file:///composer-context", name: "Context" }]);
    const panel = vscode.window.createWebviewPanel("piarre.composer.test", "Composer context", vscode.ViewColumn.One, { enableScripts: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = new Promise<unknown>(resolve => {
        timer = setTimeout(() => { resolve({ ok: false, error: "Composer context test timed out" }); }, 15_000);
        panel.webview.onDidReceiveMessage((message: unknown) => { if (typeof message === "object" && message !== null && "kind" in message && message.kind === "test-context-result") resolve(message); });
      });
      panel.webview.html = renderWorkView(project).replace("const api = acquireVsCodeApi();", `
const nativeApi = acquireVsCodeApi();
const outbound = [];
const api = { postMessage(value) { outbound.push(value); return nativeApi.postMessage(value); }, getState:()=>nativeApi.getState(), setState:value=>nativeApi.setState(value) };
`).replace("</script>", `
(async()=>{try {
const receive=data=>window.dispatchEvent(new MessageEvent('message',{data}));
receive({kind:'conversation',state:{kind:'ready',message:'Fixture ready'},sessions:[{id:'project-chat',title:'Project chat',html:'',artifacts:[]},{id:'other-session',title:'Other session',html:'',artifacts:[]}]});
receive({kind:'models',models:['model-one','model-two']});
receive({kind:'inspection',html:'',knowledge:'',sources:[{id:'source-one',type:'knowledge',label:'First reference'},{id:'source-two',type:'assignment',label:'Second reference'},{id:'skill-file:.agents/skills/review/SKILL.md',type:'skill',label:'Review skill excerpt'}]});
const message=document.getElementById('goal');
const setText=value=>{message.value=value;message.dispatchEvent(new Event('input'));};
const submit=()=>{document.getElementById('composer').requestSubmit(document.getElementById('send-codex'));return outbound.filter(value=>value.kind==='send-conversation').at(-1);};
const accepted=request=>{receive({kind:'send-accepted',requestId:request.requestId,sessionId:'project-chat'});receive({kind:'send-finished',requestId:request.requestId});};
setText('Second reference');document.getElementById('context-toggle').click();
if(document.querySelector('#context-records label:not([hidden]) input').value!=='source-two')throw new Error('Suggestions did not rank the agent by message relevance');
const search=document.getElementById('context-search');search.value='First';search.dispatchEvent(new Event('input'));
if(document.querySelectorAll('#context-records label:not([hidden])').length!==1||document.querySelector('#context-records label:not([hidden]) input').value!=='source-one')throw new Error('Search did not filter mixed context');
if(!document.querySelector('#context-records .source-icon svg'))throw new Error('Context types need consistent icons');
search.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
document.querySelector('[data-pane="agents"]').click();
const skillAdd=document.querySelector('#repository-skills button');
if(!skillAdd||skillAdd.closest('details'))throw new Error('Skills must be flat and referenceable');
skillAdd.click();
if(document.getElementById('chat-pane').hidden||!document.getElementById('context-chips').textContent.includes('Review skill'))throw new Error('Skill plus did not add context and return to chat');
if(outbound.some(value=>value.kind==='send-conversation'))throw new Error('Browsing context sent a request');
setText('Preserve my draft');
const first=submit();
document.getElementById('model').value='codex::model-two';document.getElementById('model').dispatchEvent(new Event('change'));
accepted(first);
if(message.value!=='Preserve my draft'||document.getElementById('model').value!=='codex::model-two')throw new Error('Accepting old send cleared a newer model draft');
const second=submit();
document.querySelector('#context-records input[value="source-two"]').click();
accepted(second);
if(message.value!=='Preserve my draft'||!document.querySelector('#context-records input[value="source-two"]').checked)throw new Error('Accepting old send cleared newer context');
const third=submit();setText('Changed');setText('Preserve my draft');accepted(third);
if(message.value!=='Preserve my draft')throw new Error('Reverted text is still a newer draft');
const unchanged=submit();accepted(unchanged);
if(message.value!=='')throw new Error('Accepted unchanged draft was not cleared');
setText('Accept while viewing another session');
const background=submit();
const openSession=id=>{document.querySelector('[data-pane="sessions"]').click();document.querySelector('#sessions [data-session="'+id+'"]').click();};
openSession('other-session');accepted(background);openSession('project-chat');
if(message.value!==''||document.getElementById('model').value!=='codex::model-two')throw new Error('Background acceptance lost the session model preference');
setText('Keep a newer background draft');const older=submit();openSession('other-session');openSession('project-chat');setText('Newer draft');openSession('other-session');accepted(older);openSession('project-chat');
if(message.value!=='Newer draft')throw new Error('Background acceptance cleared a newer session draft');
api.postMessage({kind:'test-context-result',ok:true});
}catch(error){api.postMessage({kind:'test-context-result',ok:false,error:String(error)});}})();
</script>`);
      assert.deepEqual(await result, { kind: "test-context-result", ok: true });
    } finally { if (timer) clearTimeout(timer); panel.dispose(); }
  });
});
