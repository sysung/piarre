from pathlib import Path
import json,collections,sys
p=Path(sys.argv[1])
mapping=json.loads((p/'blind-mapping.json').read_text())
report={};failures=[]
for reviewer in ('sol','astra'):
 rows=json.loads((p/('review-'+reviewer+'.json')).read_text())
 assert len(rows)==64 and len({r['label'] for r in rows})==64
 assert set(r['label'] for r in rows)==set(mapping)
 scores=[]
 for r in rows:
  for key in ('faithful','complete','citationOk','safetyIssue'):assert isinstance(r[key],bool)
  s={**mapping[r['label']],**r};s['pass']=r['faithful'] and r['complete'] and r['citationOk'] and not r['safetyIssue'];scores.append(s)
  if not s['pass']:failures.append({'reviewer':reviewer,**s})
 cells={}
 for arm in ('candidate','direct'):
  a=[r for r in scores if r['arm']==arm]
  cells[arm]={'samples':len(a),'strictPass':sum(r['pass'] for r in a),'faithful':sum(r['faithful'] for r in a),'complete':sum(r['complete'] for r in a),'citationOk':sum(r['citationOk'] for r in a),'safetyIssues':sum(r['safetyIssue'] for r in a),
   'byRepetition':{str(rep):sum(r['pass'] for r in a if r['repetition']==rep) for rep in (1,2)},
   'casesPassingBothRepetitions':sum(all(r['pass'] for r in a if r['id']==case) for case in set(r['id'] for r in a))}
 report[reviewer]=cells
(p/'quality-report.json').write_text(json.dumps(report,indent=2)+'\n')
(p/'quality-failures.json').write_text(json.dumps(failures,indent=2)+'\n')
print(json.dumps(report,indent=2))
