import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assess, numericIndex } from './arithmetic.mjs';
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
test('rejects dialogue in place of a calculation plan',()=>{const r=assess({kind:'dialogue',reply:'Which frame material is recorded?',sourceIds:[]},input);assert.equal(r.kind,'rejected');});

test('does not lose the sign outside a trimmed quotation',()=>{const p=plan();p.quantities[0].quote='18 trays';const r=assess(p,{...input,sources:[{...input.sources[0],text:'There are -18 trays; five are reserved.'},input.sources[1]]});assert.equal(r.kind,'rejected');});

function single(sourceText, token, quote=sourceText, status='confirmed') {
 const inquiry={question:'What is the recorded quantity?',sources:[{id:'s',text:sourceText,status}]};
 const proposal={kind:'numeric',quantities:[{id:'q',sourceId:'s',quote,token}],operations:[],outputs:[{kind:'value',label:'Recorded',value:'q'}],qualifiers:[]};
 return {inquiry,proposal};
}
test('accepts normalized cardinal values and retains original source tokens',()=>{
 for(const [word,normalized] of [['Six','6'],['four','4'],['two','2'],['ZERO','0'],['eighteen','18'],['twenty','20']]) {
  const {inquiry,proposal}=single(`The recorded count is ${word}.`,normalized,word);
  const result=assess(proposal,inquiry);
  assert.equal(result.kind,'numeric',word);
  assert.equal(result.computed[0].value,normalized);
  assert.equal(result.operands[0].token,word);
  assert.equal(result.operands[0].modelToken,normalized);
  assert.equal(inquiry.sources[0].text.slice(result.operands[0].start,result.operands[0].end),word);
  assert.equal(result.operands[0].sourceId,'s');
 }
});
test('matches decimals by exact rational value rather than floating point',()=>{
 for(const [sourceToken,modelToken,expected] of [['2.5000','2.5','5/2'],['-2.50','-2.500000','-5/2'],['0.100000','0.1','1/10']]) {
  const {inquiry,proposal}=single(`Recorded ${sourceToken} units.`,modelToken,sourceToken);
  const result=assess(proposal,inquiry);
  assert.equal(result.kind,'numeric');assert.equal(result.computed[0].value,expected);
  assert.equal(result.operands[0].token,sourceToken);
 }
 const {inquiry,proposal}=single('Recorded 0.100001 units.','0.1');
 assert.equal(assess(proposal,inquiry).kind,'rejected');
});
for(const [name,source,modelToken,quotation] of [
 ['fabricated zero','No sign-off has been recorded.','0'],
 ['numeric substring','There are 18 spaces.','8'],
 ['trimmed numeric substring','There are 18 spaces.','8','8'],
 ['negative sign loss','Recorded -6 units.','6'],
 ['trimmed negative sign','Recorded -6 units.','6','6'],
 ['trimmed signed token','Recorded -6 units.','-6','6'],
 ['spaced negative sign','Recorded - 6 units.','6'],
 ['unicode negative sign','Recorded −6 units.','6'],
 ['word negative sign','Recorded minus six units.','6'],
 ['negative adjective','Recorded negative six units.','6'],
 ['fraction numerator','Recorded 1/2 unit.','1'],
 ['fraction denominator','Recorded 1/2 unit.','2'],
 ['spaced fraction','Recorded one / two units.','1'],
 ['mixed fraction','Recorded 2 1/2 units.','2'],
 ['written fraction','Recorded one half unit.','1'],
 ['written mixed fraction','Recorded one and a half units.','1'],
 ['mixed fraction with conjunction','Recorded 2 and 1/2 units.','2'],
 ['hyphenated cardinal','Recorded twenty-two units.','20'],
 ['compound cardinal first','Recorded twenty two units.','20'],
 ['compound cardinal last','Recorded twenty two units.','2'],
 ['scale compound','Recorded one hundred units.','1'],
 ['scale compound with and','Recorded one hundred and two units.','2'],
 ['ordinal substring','Recorded sixth place.','6'],
 ['cardinal prefix','Recorded eighteen units.','8'],
 ['trimmed cardinal prefix','Recorded eighteen units.','8','eight'],
 ['decimal integer part','Recorded 6.5 units.','6'],
 ['trimmed decimal integer part','Recorded 6.5 units.','6','6'],
 ['grouped numeral','Recorded 1,000 units.','1'],
 ['exponent notation','Recorded 6e2 units.','6'],
 ['hex notation','Recorded 0x10 units.','0'],
 ['mismatched cardinal','Recorded six units.','4'],
 ['mismatched normalized sign','Recorded six units.','-6'],
 ['unsupported normalized fraction','Recorded 0.5 unit.','1/2'],
]) test('rejects source-token attack: '+name,()=>{
 const {inquiry,proposal}=single(source,modelToken,quotation??source);
 assert.equal(assess(proposal,inquiry).kind,'rejected');
});
test('does not borrow a matching quote or value from another source',()=>{
 const {inquiry,proposal}=single('Recorded four units.','6','six');
 inquiry.sources.push({id:'other',text:'Recorded six units.',status:'confirmed'});
 assert.equal(assess(proposal,inquiry).kind,'rejected');
});
test('accepts only an entire source token inside the quoted original span',()=>{
 const {inquiry,proposal}=single('There are eighteen spaces and eight fixtures.','8','eight fixtures');
 const result=assess(proposal,inquiry);assert.equal(result.kind,'numeric');
 assert.equal(result.operands[0].start,inquiry.sources[0].text.indexOf('eight fixtures'));
});
test('normalized operands still require confirmed or user-input status',()=>{
 for(const status of ['unconfirmed','historical','disputed','unknown']) {
  const {inquiry,proposal}=single('Recorded six units.','6',undefined,status);
  assert.equal(assess(proposal,inquiry).kind,'rejected');
 }
 const {inquiry,proposal}=single('Recorded six units.','6',undefined,'user-input');
 assert.equal(assess(proposal,inquiry).kind,'numeric');
});
test('missing qualifiers normalize to empty without semantic assurance',()=>{
 const {inquiry,proposal}=single('Recorded six units.','6');delete proposal.qualifiers;
 const result=assess(proposal,inquiry);assert.equal(result.kind,'numeric');
 assert.equal(result.semanticValidation,'not-established');
 assert.equal(result.unitValidation,'not-established');
 assert.match(result.text,/do not grant authorization/);
 assert.doesNotMatch(result.text,/Source qualification:/);
});
for(const qualifiers of [null,undefined,'',{},[null]]) test('rejects a present malformed qualifiers value '+JSON.stringify(qualifiers),()=>{
 const {inquiry,proposal}=single('Recorded six units.','6');proposal.qualifiers=qualifiers;
 assert.equal(assess(proposal,inquiry).kind,'rejected');
});
test('unknown operation and output references remain rejected',()=>{
 const {inquiry,proposal}=single('Recorded six units.','6');
 proposal.operations=[{id:'sum',op:'add',left:'q',right:'absent'}];
 assert.equal(assess(proposal,inquiry).kind,'rejected');
 proposal.operations=[];proposal.outputs[0].value='absent';
 assert.equal(assess(proposal,inquiry).kind,'rejected');
});
test('policy is never converted into a numeric answer by default',()=>{
 const {inquiry,proposal}=single('Coordinator sign-off is required. None is recorded.','0');
 assert.equal(assess(proposal,inquiry).kind,'rejected');
 proposal.quantities=[];assert.equal(assess(proposal,inquiry).kind,'rejected');
 assert.equal(assess({kind:'dialogue',reply:'May I proceed?',sourceIds:[]},inquiry).kind,'rejected');
});

for(const [source,token,actual] of [
 ['The event has a 50-minute slot.','50','50'],
 ['A four-point penalty applies.','4','four'],
 ['Use the 18-tray cart.','18','18'],
 ['There is a 9-blorps setting.','9','9'],
 ['The event has a 50‑minute slot.','50','50'],
]) test('accepts a literal before an unverified word modifier: '+source,()=>{
 const {inquiry,proposal}=single(source,token);
 const result=assess(proposal,inquiry);assert.equal(result.kind,'numeric');
 assert.equal(result.operands[0].token,actual);
 assert.equal(result.computed[0].value,token);
 assert.equal(result.unitValidation,'not-established');
 assert.equal(result.semanticValidation,'not-established');
});
for(const [name,source,token,quotation] of [
 ['digit range start','Use an 18-20 range.','18'],
 ['digit range end','Use an 18-20 range.','20'],
 ['spaced digit range','Use an 18 - 20 range.','18'],
 ['cardinal compound start','Recorded twenty-one units.','20'],
 ['cardinal compound end','Recorded twenty-one units.','1'],
 ['scale modifier','Recorded four-hundred units.','4'],
 ['fraction modifier','Recorded one-half unit.','1'],
 ['negative word modifier','Recorded -18-tray carts.','18'],
 ['trimmed negative modifier','Recorded -18-tray carts.','18','18-tray'],
 ['left ID fragment','Recorded sensor18-tray setting.','18'],
 ['signed ID fragment','Recorded R-18 identifier.','-18'],
 ['right alphanumeric ID fragment','Recorded 18-A7 identifier.','18'],
 ['right underscore ID fragment','Recorded 18-tray_id identifier.','18'],
]) test('hyphen boundary still rejects '+name,()=>{
 const {inquiry,proposal}=single(source,token,quotation??source);
 assert.equal(assess(proposal,inquiry).kind,'rejected');
});

test('numeric index preserves complete cardinals, exact decimals, source identity and status',()=>{
 const inquiry={question:'Which recorded quantities exist?',sources:[
  {id:'first',text:'Eighteen spaces; 0.125 units.',status:'confirmed'},
  {id:'second',text:'Six fixtures.',status:'user-input'},
  {id:'pending',text:'Four proposals.',status:'unconfirmed'},
 ]};
 const entries=numericIndex(inquiry);
 assert.deepEqual(entries.map(({id,sourceId,token,value,status})=>({id,sourceId,token,value,status})),[
  {id:'q1',sourceId:'first',token:'Eighteen',value:'18',status:'confirmed'},
  {id:'q2',sourceId:'first',token:'0.125',value:'1/8',status:'confirmed'},
  {id:'q3',sourceId:'second',token:'Six',value:'6',status:'user-input'},
 ]);
 assert.doesNotThrow(()=>JSON.stringify(entries));
 for(const entry of entries){
  const source=inquiry.sources.find(candidate=>candidate.id===entry.sourceId);
  assert.equal(source.text.slice(entry.start,entry.end),entry.token);
  assert.equal(entry.quote,source.text.slice(Math.max(0,entry.start-40),entry.end+40));
  const p={kind:'numeric',quantities:[{id:entry.id,sourceId:entry.sourceId,quote:entry.quote,token:entry.token}],operations:[],outputs:[{kind:'value',label:'Recorded',value:entry.id}],qualifiers:[]};
  const accepted=assess(p,inquiry);assert.equal(accepted.kind,'numeric');assert.equal(accepted.computed[0].value,entry.value);
 }
});
test('numeric index context is exactly forty original characters on each available side',()=>{
 const source='prefix'.repeat(10)+' 18-tray carts '+'suffix'.repeat(10);
 const {inquiry}=single(source,'18');const [entry]=numericIndex(inquiry);
 assert.equal(entry.quote.length,82);
 assert.equal(entry.quote,source.slice(entry.start-40,entry.end+40));
});
test('numeric index rejects an excess occurrence rather than truncating',()=>{
 const inquiry={question:'Index?',sources:[{id:'s',text:Array.from({length:24},(_,i)=>String(i+1)).join('; '),status:'confirmed'}]};
 assert.equal(numericIndex(inquiry).length,24);
 inquiry.sources[0].text+='; 25';
 assert.throws(()=>numericIndex(inquiry),/exceeds 24/);
});
test('numeric index never synthesizes a zero for absent permission',()=>{
 const {inquiry}=single('No sign-off is recorded. Coordinator approval is required.','0');
 assert.deepEqual(numericIndex(inquiry),[]);
});
test('numeric index shares the same range, sign, fraction, ID and unit-modifier boundaries',()=>{
 const {inquiry}=single('An 18-20 range; minus six units; one-half unit; R-18 ID; a 50-minute slot and four-point penalty.','50');
 assert.deepEqual(numericIndex(inquiry).map(entry=>entry.token),['50','four']);
});
test('numeric index shares source validation rather than silently replacing duplicate IDs',()=>{
 const {inquiry}=single('Six slots.','6');inquiry.sources.push({...inquiry.sources[0],text:'Four slots.'});
 assert.throws(()=>numericIndex(inquiry),/Duplicate source/);
});
