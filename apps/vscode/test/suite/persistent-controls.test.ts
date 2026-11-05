import assert from "node:assert/strict";
import * as vscode from "vscode";
import { replay } from "../../../../packages/core/src/index.js";
import { renderWorkView } from "../../src/work-view.js";

suite("Persistent direct controls", () => {
  test("global, coding and assignment stop controls remain visible and actionable through every tab and setup", async function () {
    this.timeout(20_000);
    const project = replay([{ kind: "project-created", projectId: "persistent-control", repositoryUri: "file:///controls", name: "Controls" }]);
    const panel = vscode.window.createWebviewPanel("piarre.controls.test", "Direct controls", vscode.ViewColumn.One, { enableScripts: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = new Promise<unknown>(resolve => {
        timer = setTimeout(() => { resolve({ ok: false, error: "Controls webview timed out" }); }, 15_000);
        panel.webview.onDidReceiveMessage((message: unknown) => { if (typeof message === "object" && message !== null && "kind" in message && message.kind === "test-controls-result") resolve(message); });
      });
      panel.webview.html = renderWorkView(project).replace("const api = acquireVsCodeApi();", `
const nativeApi=acquireVsCodeApi();const sent=[];
const api={postMessage:value=>{sent.push(value);return nativeApi.postMessage(value);},getState:()=>nativeApi.getState(),setState:value=>nativeApi.setState(value)};
`).replace("</script>", `
(async()=>{try{
const receive=data=>window.dispatchEvent(new MessageEvent('message',{data}));
const controls='<button data-execution-action="pause-all">Stop all and pause new work</button><button data-execution-action="stop" data-execution-id="coding-one">Stop coding</button>';
const agents='<section><h5>Reviewer</h5><button data-coordination-action="stop" data-coordination-id="group-one" data-assignment-id="worker-one">Stop this assignment</button></section>';
receive({kind:'inspection',html:'',knowledge:'',agentOverview:agents,executionControls:controls,sources:[]});
const visible=button=>{const r=button.getBoundingClientRect();if(r.width<=0||r.height<=0||button.closest('[hidden]')||button.closest('[inert]'))throw new Error('A direct control is hidden or inert');const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(top!==button&&!button.contains(top))throw new Error('Setup or pane covers a direct control');};
const strip=document.getElementById('active-execution');
if(strip.querySelectorAll('button').length!==3)throw new Error('Persistent controls omit global or assignment stop');
for(const button of strip.querySelectorAll('button'))visible(button);
receive({kind:'conversation',state:{kind:'ready',message:'Fixture connected'},sessions:[{id:'project-chat',title:'Chat',html:''}]});
for(const name of ['chat','sessions','agents','knowledge']){document.querySelector('[data-pane="'+name+'"]').click();for(const button of strip.querySelectorAll('button')){visible(button);button.click();}}
if(sent.filter(value=>value.kind==='execution'&&value.action==='pause-all').length!==4)throw new Error('Stop all did not reach its canonical action');
if(sent.filter(value=>value.kind==='execution'&&value.action==='stop'&&value.id==='coding-one').length!==4)throw new Error('Coding stop identity changed');
if(sent.filter(value=>value.kind==='coordination'&&value.action==='stop'&&value.id==='group-one'&&value.assignmentId==='worker-one').length!==4)throw new Error('Assignment stop identity changed');
if(sent.some(value=>value.kind==='send-conversation'||value.action==='approve'))throw new Error('Tab or stop interaction started work');
receive({kind:'inspection',html:'',knowledge:'',agentOverview:'',executionControls:'<button data-execution-action="pause-all">Stop all and pause new work</button>',sources:[]});
if(strip.querySelectorAll('button').length)throw new Error('Idle workspace shows a redundant persistent stop row');
api.postMessage({kind:'test-controls-result',ok:true});
}catch(error){api.postMessage({kind:'test-controls-result',ok:false,error:String(error)});}})();
</script>`);
      assert.deepEqual(await result, { kind: "test-controls-result", ok: true });
    } finally { if (timer) clearTimeout(timer); panel.dispose(); }
  });
});
