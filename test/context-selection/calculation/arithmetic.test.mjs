import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assess } from './arithmetic.mjs';
const input={question:'What remains?',sources:[{id:'a',text:'There are 18 trays; five are reserved.',status:'confirmed'},{id:'b',text:'The request needs 11 trays. Supervisor approval is required and has not been recorded.',status:'confirmed'}]};
const plan=()=>({kind:'numeric',quantities:[{id:'q1',sourceId:'a',quote:'18 trays',token:'18'},{id:'q2',sourceId:'a',quote:'five are reserved',token:'five'},{id:'q3',sourceId:'b',quote:'11 trays',token:'11'}],operations:[{id:'available',op:'subtract',left:'q1',right:'q2'},{id:'remaining',op:'subtract',left:'available',right:'q3'}],outputs:[{kind:'comparison',label:'Requested trays within available capacity',left:'q3',relation:'le',right:'available'},{kind:'value',label:'Remaining trays',value:'remaining'}],qualifiers:[{sourceId:'b',quote:'Supervisor approval is required and has not been recorded.'}]});
test('computes and cites original quantities without granting permission',()=>{const result=assess(plan(),input);assert.equal(result.kind,'numeric');assert.match(result.text,/11 <= 13: true/);assert.match(result.text,/Remaining trays: 2/);assert.match(result.text,/approval is required and has not been recorded/);assert.deepEqual(new Set(result.sourceIds),new Set(['a','b']));assert.equal(result.semanticValidation,'not-established');});
test('does exact decimal arithmetic',()=>{const p=plan();p.quantities=[{id:'x',sourceId:'a',quote:'0.1 and 0.2',token:'0.1'},{id:'y',sourceId:'a',quote:'0.1 and 0.2',token:'0.2'}];p.operations=[{id:'sum',op:'add',left:'x',right:'y'}];p.outputs=[{kind:'value',label:'Sum',value:'sum'}];p.qualifiers=[];const r=assess(p,{question:'Sum?',sources:[{id:'a',text:'Use 0.1 and 0.2.',status:'confirmed'}]});assert.equal(r.kind,'numeric');assert.match(r.text,/Sum: 3\/10/);});
for(const [name,change] of [
 ['invented quotation',p=>{p.quantities[0].quote='19 trays';}],
 ['numeric substring',p=>{p.quantities[0].token='8';}],
 ['trimmed numeric substring',p=>{p.quantities[0].quote='8';p.quantities[0].token='8';}],
 ['unknown source',p=>{p.quantities[0].sourceId='outside';}],
 ['forward reference',p=>{p.operations[0].left='remaining';}],
 ['duplicate quantity',p=>{p.quantities[1].id='q1';}],
 ['duplicate operation',p=>{p.operations[0].id='q1';}],
 ['executable operator',p=>{p.operations[0].op='process.exit()';}],
 ['inline constant',p=>{p.operations[0].right=5;}],
 ['extra output fields',p=>{p.outputs[0].approved=true;}],
 ['unconfirmed operand',p=>{p.quantities[0].sourceId='u';}],
 ['invented qualification',p=>{p.qualifiers[0].quote='Approval is granted.';}],
 ['excessive row count',p=>{p.operations=Array.from({length:21},(_,i)=>({id:'r'+i,op:'add',left:'q1',right:'q1'}));}],
 ['division by zero',p=>{p.operations=[{id:'zero',op:'subtract',left:'q1',right:'q1'},{id:'bad',op:'divide',left:'q1',right:'zero'}];p.outputs=[{kind:'value',label:'Bad',value:'bad'}];}],
 ['overflow',p=>{p.operations=Array.from({length:10},(_,i)=>({id:'r'+i,op:'multiply',left:i?'r'+(i-1):'q1',right:'q1'}));p.outputs=[{kind:'value',label:'Large',value:'r9'}];}],
]) test('rejects '+name,()=>{const p=plan();change(p);const r=assess(p,{...input,sources:[...input.sources,{id:'u',text:'18 trays',status:'unconfirmed'}]});assert.equal(r.kind,'rejected');});
test('preserves an ordinary clarification as a proposal, not verified meaning',()=>{const r=assess({kind:'dialogue',reply:'Which frame material is recorded?',sourceIds:[]},input);assert.equal(r.kind,'dialogue');assert.equal(r.semanticValidation,'not-established');});

test('does not lose the sign outside a trimmed quotation',()=>{const p=plan();p.quantities[0].quote='18 trays';const r=assess(p,{...input,sources:[{...input.sources[0],text:'There are -18 trays; five are reserved.'},input.sources[1]]});assert.equal(r.kind,'rejected');});
