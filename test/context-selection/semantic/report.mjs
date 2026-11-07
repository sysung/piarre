import assert from 'node:assert/strict';
import {variants} from './retrieval.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(name));
const rankings=read('rankings.json'),keys=read('keys.json'),questions=read('questions.json');
assert.equal(keys.length,questions.length);const rows=[];
for(const entry of rankings.results){
 const key=keys.find(k=>k.id===entry.id);assert(key);const expected=key.criteria.requiredSourceIds;
 const selected=entry.hits.map(hit=>hit.id);rows.push({id:entry.id,project:entry.project,method:entry.method,expected,selected,recalled:expected.filter(id=>selected.includes(id)).length,complete:expected.every(id=>selected.includes(id))});
}
const summary=Object.keys(variants).map(method=>{const subset=rows.filter(r=>r.method===method),answerable=subset.filter(r=>r.expected.length>0);return {method,requiredSources:answerable.reduce((sum,r)=>sum+r.expected.length,0),recalled:answerable.reduce((sum,r)=>sum+r.recalled,0),questionsWithRequiredEvidence:answerable.length,completeCoverage:answerable.filter(r=>r.complete).length,noRequiredEvidence:subset.length-answerable.length,noRequiredEvidenceWithCandidates:subset.filter(r=>!r.expected.length&&r.selected.length).length};});
writeFileSync('retrieval-report.json',JSON.stringify({summary,rows},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(summary,null,2));
