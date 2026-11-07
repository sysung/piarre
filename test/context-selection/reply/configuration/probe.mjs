import assert from 'node:assert/strict';
import { readFileSync,appendFileSync,existsSync } from 'node:fs';
const inputs=JSON.parse(readFileSync('inputs.json'));
assert.equal(inputs.length,5);assert(!existsSync('attempts.jsonl'));
const profiles=[{name:'greedy',temperature:0},{name:'recommended',temperature:.7,top_p:.8,top_k:20,min_p:0,presence_penalty:1.5,repeat_penalty:1},
 {name:'recommended-json',temperature:.7,top_p:.8,top_k:20,min_p:0,presence_penalty:1.5,repeat_penalty:1,response_format:{type:'json_object'}}];
const emit=row=>appendFileSync('attempts.jsonl',JSON.stringify({...row,time:new Date().toISOString()})+'\n');
let calls=0;
for(const [index,item] of inputs.entries()){
 const order=[...profiles.slice(index%3),...profiles.slice(0,index%3)];
 for(const selected of order){
  const {name,...settings}=selected;
  const request={model:'docker.io/ai/qwen3.5:4b-q6_K',messages:[{role:'user',content:item.prompt}],max_tokens:1024,stream:false,chat_template_kwargs:{enable_thinking:false},...settings};
  assert(calls<15);emit({type:'dispatch',id:item.id,profile:name,call:++calls,request});
  const start=Date.now();
  const response=await globalThis.fetch('http://model-runner.docker.internal/engines/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal:globalThis.AbortSignal.timeout(60000),redirect:'error'});
  assert(response.ok,String(response.status));
  const envelope=await response.json();
  assert(envelope.model.includes('/bundles/sha256/ea484046efba5fc126b1b331c2d590a20cb7d3abdfc65366a7f8b547350cd629/model/'));
  emit({type:'answer',id:item.id,profile:name,envelope,elapsedMs:Date.now()-start});
 }
}
emit({type:'end',calls});
