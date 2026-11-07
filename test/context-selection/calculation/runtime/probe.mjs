import assert from 'node:assert/strict';
import {existsSync,appendFileSync} from 'node:fs';
assert(!existsSync('signals.jsonl'));
for(const enabled of [false,true]){
 const request={model:'docker.io/ai/qwen3.5:4b-q6_K',messages:[{role:'user',content:'Calculate 48 - 8 - (5 * 7). Give the final number.'}],temperature:0,max_tokens:256,stream:false,chat_template_kwargs:{enable_thinking:enabled}};
 appendFileSync('signals.jsonl',JSON.stringify({type:'dispatch',enabled,request})+'\n');
 const response=await globalThis.fetch('http://model-runner.docker.internal/engines/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal:globalThis.AbortSignal.timeout(60000),redirect:'error'});
 assert(response.ok,String(response.status));const e=await response.json();assert(e.model.includes('/bundles/sha256/ea484046efba5fc126b1b331c2d590a20cb7d3abdfc65366a7f8b547350cd629/model/'));
 const c=e.choices[0];appendFileSync('signals.jsonl',JSON.stringify({type:'signal',enabled,model:e.model,finishReason:c.finish_reason,content:c.message.content,reasoningChars:typeof c.message.reasoning_content==='string'?c.message.reasoning_content.length:0,usage:e.usage})+'\n');
}
