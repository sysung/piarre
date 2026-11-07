import assert from 'node:assert/strict';
import {readFileSync,appendFileSync,existsSync} from 'node:fs';
const inputs=JSON.parse(readFileSync('inputs.json'));assert.equal(inputs.length,8);assert(!existsSync('attempts.jsonl'));
const emit=row=>appendFileSync('attempts.jsonl',JSON.stringify({...row,time:new Date().toISOString()})+'\n');
let calls=0;
for(const item of inputs){
 const request={model:'docker.io/ai/qwen3.5:4b-q6_K',messages:[{role:'user',content:item.prompt}],max_tokens:1024,stream:false,temperature:0,chat_template_kwargs:{enable_thinking:false}};
 assert(calls<8);emit({type:'dispatch',id:item.id,repetition:item.repetition,call:++calls,request,selectedSourceIds:item.selectedSourceIds});
 const start=Date.now();
 const response=await globalThis.fetch('http://model-runner.docker.internal/engines/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal:globalThis.AbortSignal.timeout(60000),redirect:'error'});
 assert(response.ok,String(response.status));const envelope=await response.json();
 assert(envelope.model.includes('/bundles/sha256/ea484046efba5fc126b1b331c2d590a20cb7d3abdfc65366a7f8b547350cd629/model/'));
 emit({type:'answer',id:item.id,repetition:item.repetition,envelope,elapsedMs:Date.now()-start});
}
emit({type:'end',calls});
