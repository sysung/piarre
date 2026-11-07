import json,secrets,collections,sys
from pathlib import Path
out=Path(sys.argv[1])
assert not (out/'blind-answers.json').exists() and not (out/'blind-mapping.json').exists(), 'Do not replace frozen labels'
rows=[json.loads(l) for l in (out/'attempts.jsonl').read_text().splitlines()]
assert rows[-1]['type']=='end'
assert rows[-1]['calls']==64
suite=json.loads((out/'suite.json').read_text())
results={}
for r in rows:
 if r['type'] in ('answer','error'):results[(r['id'],r['repetition'],r['arm'])]=r
assert len(results)==64
pack={'method':'Criteria were authored before candidate implementation. Labels conceal arm. Direct free-text citations and attached validated citations are both acceptable. Presentation may reveal arm, so blinding is partial. Score the missing-fact request by meaning, not question marks. Judge every material claim and prerequisite, not only quoted phrases. Empty citations are allowed by the fixed criteria for claim-free clarification and unavailability.','cases':[]}
mapping={}
for case in suite['cases']:
 dispatch=next(r for r in rows if r['type']=='dispatch' and r['id']==case['id'])
 source_map=dispatch['sourceMap']
 answers=[]
 for rep in (1,2):
  for arm in ('candidate','direct'):
   key=(case['id'],rep,arm);r=results[key]
   label=secrets.token_hex(6)
   mapping[label]={'id':case['id'],'repetition':rep,'arm':arm}
   ans={'label':label,'text':r.get('text','[No accepted answer: '+r.get('message','unknown')+']')}
   if 'citedIds' in r:ans['attachedCitationIds']=r['citedIds']
   answers.append(ans)
 secrets.SystemRandom().shuffle(answers)
 pack['cases'].append({'id':case['id'],'question':case['question'],'sources':source_map,'criteria':case['criteria'],'answers':answers})
(out/'blind-answers.json').write_text(json.dumps(pack,indent=2)+'\n')
(out/'blind-mapping.json').write_text(json.dumps(mapping,indent=2)+'\n')
print('Wrote',len(mapping),'anonymized answers. Runtime result counts',dict(collections.Counter(r['type'] for r in rows)))
