import {test} from 'node:test';
import assert from 'node:assert/strict';
import {numericIndex} from './arithmetic.mjs';
import {assessIndexed} from './indexed.mjs';
const input={question:'Remainder?',sources:[{id:'a',text:'There are eighteen trays; five are reserved.',status:'confirmed'},{id:'b',text:'The request needs 11 trays. No approval is recorded.',status:'confirmed'}]};
test('indexes unchanged source tokens and normalized cardinal values',()=>{const index=numericIndex(input);assert.deepEqual(index.map(q=>q.value),['18','5','11']);assert(index.every(q=>input.sources.find(s=>s.id===q.sourceId).text.includes(q.quote)));});
test('computes selected indexed operands and derives citations',()=>{const r=assessIndexed({kind:'numeric',operations:[{op:'subtract',left:'q1',right:'q2'},{op:'subtract',left:'r1',right:'q3'}],outputs:[{kind:'value',label:'Remaining trays',value:'r2'}]},input);assert.equal(r.kind,'numeric');assert.match(r.text,/Remaining trays: 2/);assert.deepEqual(new Set(r.sourceIds),new Set(['a','b']));});
test('does not turn absent approval into numeric zero',()=>{assert(!numericIndex(input).some(q=>q.value==='0'));const r=assessIndexed({kind:'numeric',operations:[],outputs:[{kind:'value',label:'Approval',value:'0'}],qualifiers:[]},input);assert.equal(r.kind,'rejected');});
test('does not index identifiers, unsigned substrings, thousands or fractions',()=>{const index=numericIndex({question:'Identify quantities',sources:[{id:'a',text:'v18, -18 trays, 1,018 extras, 1/2 and 0.2.',status:'confirmed'}]});assert.deepEqual(index.map(q=>q.token),['-18','0.2']);});
test('rejects caller supplied quantities and unconfirmed indexed operands',()=>{const raw={kind:'numeric',operations:[],outputs:[{kind:'value',label:'Amount',value:'q1'}],qualifiers:[]};assert.equal(assessIndexed({...raw,quantities:[]},input).kind,'rejected');assert.equal(assessIndexed(raw,{...input,sources:input.sources.map(s=>({...s,status:'unconfirmed'}))}).kind,'rejected');});
test('bounds the literal index instead of truncating it',()=>{assert.throws(()=>numericIndex({question:'Identify quantities',sources:[{id:'a',text:Array(25).fill('7 trays').join(' '),status:'confirmed'}]}),/index|24/i);});

test('operation identity cannot overwrite an original quantity',()=>{const r=assessIndexed({kind:'numeric',operations:[{id:'q1',op:'add',left:'q1',right:'q2'}],outputs:[{kind:'value',label:'Bad',value:'q1'}]},input);assert.equal(r.kind,'rejected');});
