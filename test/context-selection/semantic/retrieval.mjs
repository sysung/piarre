import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
export const modelDigest='3e86173a1f6e9ab8e3c4a90f1ec00d80d4f07ecc532c42ff7b7f7d1419a828ab';
export const variants=Object.freeze({lexical:{method:'lexical',limit:3},dense:{method:'dense',limit:3},hybrid:{method:'hybrid',limit:3},lexical2:{method:'lexical',limit:2},dense2:{method:'dense',limit:2}});
export const embeddingModel='docker.io/ai/qwen3-embedding:0.6B-F16';
const stopwords=new Set('a an the is are was were be been do does did can could should would will may how why what which who whom where when to of for in on with from at by and or as it its this that our we somebody someone get happen happens since have has enough only any there their than then immediately'.split(' '));
const key=(project,id)=>JSON.stringify([project,id]);
const compare=(a,b)=>a<b?-1:a>b?1:0;
function nonblank(value){return typeof value==='string'&&Boolean(value.trim());}
export function documentInput(source){
 assert(source&&['id','project','title','text','standing'].every(field=>nonblank(source[field]))&&Number.isSafeInteger(source.revision)&&source.revision>0,'Invalid source');
 assert(['confirmed','observation','historical'].includes(source.standing),'Invalid source standing');
 return source.title+'\nStanding: '+source.standing+'\nRevision: '+source.revision+'\n'+source.text;
}
export function fingerprint(source){return createHash('sha256').update(JSON.stringify([source.project,source.id,documentInput(source)])).digest('hex');}
export function queryInput(question){
 assert(nonblank(question),'Invalid question');
 return 'Instruct: Given a question about a project, retrieve relevant passages that answer it.\nQuery: '+question;
}
export function validateVector(vector){
 assert(Array.isArray(vector)&&vector.length===1024&&vector.every(Number.isFinite),'Invalid embedding vector');
 const norm=Math.hypot(...vector);assert(Number.isFinite(norm)&&norm>0,'Invalid embedding vector norm');return norm;
}
export function retrieve({sources,records,project,question,queryVector,method,limit=3}){
 assert(Array.isArray(sources)&&nonblank(project)&&nonblank(question),'Invalid retrieval input');
 assert(['lexical','dense','hybrid'].includes(method),'Unknown retrieval method');
 assert(Number.isSafeInteger(limit)&&limit>=1&&limit<=3,'Invalid context limit');
 const seen=new Set();
 for(const source of sources){documentInput(source);const id=key(source.project,source.id);assert(!seen.has(id),'Duplicate project source');seen.add(id);}
 const pool=sources.filter(source=>source.project===project);
 if(pool.length===0)return [];
 let lexical=[],dense=[];
 if(method!=='dense'){
  const database=new DatabaseSync(':memory:');
  try{
   database.exec("CREATE VIRTUAL TABLE lookup USING fts5(id UNINDEXED, passage, tokenize='porter unicode61')");
   const insert=database.prepare('INSERT INTO lookup VALUES(?,?)');
   for(const source of pool)insert.run(source.id,documentInput(source));
   const terms=[...new Set((question.toLowerCase().match(/[\p{L}\p{N}_]+/gu)??[]).filter(term=>!stopwords.has(term)))];
   const match=terms.map(term=>'"'+term+'"').join(' OR ');
   const rows=match?database.prepare('SELECT id,bm25(lookup) AS score FROM lookup WHERE lookup MATCH ? ORDER BY score,id').all(match):[];
   lexical=rows.map(row=>({source:pool.find(source=>source.id===row.id),score:row.score}));
  }finally{database.close();}
 }
 if(method!=='lexical'){
  const norm=validateVector(queryVector);assert(Array.isArray(records),'Missing vector records');
  const stored=new Map();
  for(const row of records){
   assert(row&&nonblank(row.project)&&nonblank(row.id),'Invalid vector record identity');
   const id=key(row.project,row.id);assert(!stored.has(id),'Duplicate vector record');stored.set(id,row);
  }
  dense=pool.map(source=>{
   const row=stored.get(key(source.project,source.id));assert(row,'Missing source vector');
   assert.equal(row.modelDigest,modelDigest,'Embedding model changed');assert.equal(row.fingerprint,fingerprint(source),'Stale source vector');
   const sourceNorm=validateVector(row.vector);
   const score=row.vector.reduce((sum,value,i)=>sum+value*queryVector[i],0)/(sourceNorm*norm);
   assert(Number.isFinite(score),'Invalid cosine score');return {source,score};
  }).toSorted((a,b)=>b.score-a.score||compare(a.source.id,b.source.id));
 }
 if(method==='lexical')return lexical.slice(0,limit);
 if(method==='dense')return dense.slice(0,limit);
 const scores=new Map();
 for(const list of [lexical,dense])for(const [index,hit] of list.entries())scores.set(hit.source.id,(scores.get(hit.source.id)??0)+1/(60+index+1));
 return pool.map(source=>({source,score:scores.get(source.id)??0})).toSorted((a,b)=>b.score-a.score||compare(a.source.id,b.source.id)).slice(0,limit);
}
