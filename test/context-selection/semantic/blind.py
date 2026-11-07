from pathlib import Path
import json,secrets,sys
p=Path(sys.argv[1])
assert not (p/'blind-answers.json').exists() and not (p/'blind-mapping.json').exists()
rows=[json.loads(line) for line in (p/'answers.jsonl').read_text().splitlines()]
plan=json.loads((p/'answer-plan.json').read_text())
assert rows[-1]['type']=='end' and rows[-1]['calls']==len(plan['jobs'])
questions=json.loads((p/'questions.json').read_text());sources=json.loads((p/'sources.json').read_text());keys=json.loads((p/'keys.json').read_text())
pack={'method':'Criteria were independently authored before outputs. Labels conceal arms. Supplied-source count may reveal the full-pool control, so review is partially blinded. Judge meaning, not exact phrasing or punctuation. Clear declarative requests count as clarification. Every material claim must be supported by actually supplied original evidence. Rejected responses are incomplete; do not score discarded content as accepted. No private criteria entered inference.','cases':[]};mapping={}
for question in questions:
 answers=[]
 for job in [j for j in plan['jobs'] if j['id']==question['id']]:
  match=lambda row:row.get('id')==job['id'] and row.get('arm')==job['arm'] and row.get('repetition')==job['repetition']
  outcome=next(row for row in rows if row['type'] in ('answer','error') and match(row))
  dispatch=next(row for row in rows if row['type']=='dispatch' and match(row))
  label=secrets.token_hex(6);mapping[label]={key:job[key] for key in ('id','arm','repetition')}
  answers.append({'label':label,'text':outcome.get('text','[No accepted answer: '+outcome.get('reason','unknown')+']'),'suppliedSourceIds':[source['id'] for source in dispatch['selected']]})
 secrets.SystemRandom().shuffle(answers)
 pack['cases'].append({**question,'sources':[source for source in sources if source['project']==question['project']],'criteria':next(key['criteria'] for key in keys if key['id']==question['id']),'answers':answers})
assert len(mapping)==len(plan['jobs'])
(p/'blind-answers.json').write_text(json.dumps(pack,indent=2)+'\n');(p/'blind-mapping.json').write_text(json.dumps(mapping,indent=2)+'\n')
print('Anonymized',len(mapping),'answers')
