import assert from 'node:assert/strict';
import {test} from 'node:test';
import {retrieve} from './retrieval.mjs';

const source=(id,text,standing='confirmed',project='stress')=>({id,project,title:id,text,standing,revision:1});
const rank=(sources,question,limit=2)=>retrieve({sources,project:'stress',question,method:'lexical',limit});

test('top two cannot cover an answer requiring three independently sourced prerequisites',()=>{
 const sources=[source('a','Launch requires an owner.'),source('b','Launch requires security approval.'),source('c','Launch requires a rollback plan.')];
 const selected=rank(sources,'Launch requires');
 assert.equal(selected.length,2);
 assert.equal(new Set(selected.map(hit=>hit.source.id)).size,2);
 assert.equal(rank(sources,'Launch requires',3).length,3);
 // Retrieval completeness is a separate metric: no answer quality is inferred here.
 assert.equal(sources.filter(s=>!selected.some(hit=>hit.source.id===s.id)).length,1);
});

test('unmatched paraphrase stays a retrieval miss rather than invented evidence',()=>{
 const sources=[source('policy','Reimbursements require supervisor authorization.')];
 assert.deepEqual(rank(sources,'Who can sign off on returning a customer payment?'),[]);
});

test('conflicting and historical records retain their original standing',()=>{
 const sources=[source('old','Refund window is 30 days.','historical'),source('new','Refund window is 45 days.'),source('disputed','Refund window is 60 days.')];
 const selected=rank(sources,'Refund window',3);
 assert.equal(selected.length,3);
 assert(selected.every(hit=>sources.includes(hit.source)));
 assert.equal(selected.find(hit=>hit.source.id==='old').source.standing,'historical');
});

test('an observation about approval is not promoted into authorization',()=>{
 const observed=source('approval','The launch approval might have been granted.','observation');
 assert.equal(rank([observed],'launch approval')[0].source,observed);
 assert.equal(observed.standing,'observation');
});

test('large distractor pool never admits an identical ID from another project',()=>{
 const target=source('policy','Emergency evacuation uses the north stairwell.');
 const distractors=Array.from({length:120},(_,i)=>source('inventory-'+i,'Warehouse inventory item '+i+' is awaiting a quarterly audit.'));
 const foreign=source('policy','Emergency evacuation uses the south stairwell.','confirmed','foreign');
 const hits=rank([...distractors,foreign,target],'Emergency evacuation stairwell');
 assert.equal(hits[0].source,target);
 assert(hits.every(hit=>hit.source.project==='stress'));
});

test('deleting or replacing a lexical source cannot resurrect its old text',()=>{
 const old=source('approval','Launch approval is granted.');
 assert.equal(rank([old],'launch approval')[0].source,old);
 assert.deepEqual(rank([],'launch approval'),[]);
 const withdrawn={...old,text:'Launch approval is withdrawn. Do not launch.',revision:2};
 assert.equal(rank([withdrawn],'launch approval')[0].source,withdrawn);
});
