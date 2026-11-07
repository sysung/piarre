import assert from 'node:assert/strict';
import {appendFileSync,existsSync,writeFileSync} from 'node:fs';
const model='docker.io/ai/qwen3-embedding:0.6B-F16';
assert(!existsSync('attempts.jsonl'));
async function embed(input){
 appendFileSync('attempts.jsonl',JSON.stringify({type:'dispatch',model,input})+'\n');
 const response=await globalThis.fetch('http://model-runner.docker.internal/engines/v1/embeddings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,input}),signal:globalThis.AbortSignal.timeout(60000),redirect:'error'});
 const text=await response.text();writeFileSync('response-'+(Array.isArray(input)?'documents':'query')+'.json',text,{flag:'wx'});assert(response.ok,response.status+' '+text.slice(0,500));
 const result=JSON.parse(text);appendFileSync('attempts.jsonl',JSON.stringify({type:'response',observedModel:result.model,count:result.data?.length,usage:result.usage})+'\n');
 const expected=Array.isArray(input)?input.length:1;assert.equal(result.data.length,expected);
 const vectors=result.data.toSorted((a,b)=>a.index-b.index).map((row,i)=>{assert.equal(row.index,i);assert.equal(row.embedding.length,1024);assert(row.embedding.every(Number.isFinite));assert(Math.hypot(...row.embedding)>0);return row.embedding;});
 return {vectors,model:result.model};
}
const docs=await embed(['A canine is resting on a rug.','A dog is sleeping on a mat.','The engine needs a battery replacement.']);
const query=await embed('Instruct: Given a question about a project, retrieve relevant passages that answer it.\nQuery: A pet naps on the carpet.');
const cosine=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0)/(Math.hypot(...a)*Math.hypot(...b));
const scores=docs.vectors.map((v,i)=>({index:i,score:cosine(v,query.vectors[0]),norm:Math.hypot(...v)})).toSorted((a,b)=>b.score-a.score);
assert(scores[0].index!==2);assert(scores[1].index!==2);
writeFileSync('report.json',JSON.stringify({dimensions:1024,documents:3,queries:1,embeddingRequests:2,observedModels:[docs.model,query.model],scores},null,2)+'\n',{flag:'wx'});
