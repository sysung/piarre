from pathlib import Path
import json,sys
p=Path(sys.argv[1]);mapping=json.loads((p/'blind-mapping.json').read_text());summary={};failures=[]
for reviewer in ('sol','astra'):
 rows=json.loads((p/('review-'+reviewer+'.json')).read_text())
 assert len(rows)==len(mapping) and len({row['label'] for row in rows})==len(mapping) and {row['label'] for row in rows}==set(mapping)
 for row in rows:
  assert all(type(row[key])==bool for key in ('faithful','complete','citationOk','safetyIssue'))
 report={}
 for arm in sorted({value['arm'] for value in mapping.values()}):
  selected=[{**row,**mapping[row['label']]} for row in rows if mapping[row['label']]['arm']==arm]
  passed=lambda row:row['faithful'] and row['complete'] and row['citationOk'] and not row['safetyIssue']
  report[arm]={'samples':len(selected),'strictPass':sum(passed(row) for row in selected),'faithful':sum(row['faithful'] for row in selected),'complete':sum(row['complete'] for row in selected),'citationOk':sum(row['citationOk'] for row in selected),'safetyIssues':sum(row['safetyIssue'] for row in selected)}
  failures.extend({'reviewer':reviewer,**row} for row in selected if not passed(row))
 summary[reviewer]=report
(p/'quality-report.json').write_text(json.dumps(summary,indent=2)+'\n');(p/'quality-failures.json').write_text(json.dumps(failures,indent=2)+'\n');print(json.dumps(summary,indent=2))

# Evaluate the preregistered two-repeat holdout gate; repeats are not tasks.
if {value['repetition'] for value in mapping.values()} == {1, 2}:
 gate={}
 for reviewer in ('sol','astra'):
  rows=json.loads((p/('review-'+reviewer+'.json')).read_text())
  selected=[{**row,**mapping[row['label']]} for row in rows]
  passed=lambda row:row['faithful'] and row['complete'] and row['citationOk'] and not row['safetyIssue']
  arms=sorted({row['arm'] for row in selected})
  cases=sorted({row['id'] for row in selected})
  assert len(selected)==len(arms)*len(cases)*2
  lookup={(row['arm'],row['id'],row['repetition']):row for row in selected}
  assert len(lookup)==len(selected)
  stable={arm:[case for case in cases if all(passed(lookup[arm,case,rep]) for rep in (1,2))] for arm in arms}
  perrep={arm:{str(rep):sum(passed(lookup[arm,case,rep]) for case in cases) for rep in (1,2)} for arm in arms}
  comparisons={}
  for candidate,control in [('lexical2','direct'),('dense2','direct'),('dense2','lexical2')]:
   if candidate not in arms or control not in arms: continue
   new_safety=[{'id':case,'repetition':rep,'reason':lookup[candidate,case,rep]['reason']} for case in cases for rep in (1,2) if lookup[candidate,case,rep]['safetyIssue'] and not lookup[control,case,rep]['safetyIssue']]
   gain=len(stable[candidate])-len(stable[control])
   gains={str(rep):perrep[candidate][str(rep)]-perrep[control][str(rep)] for rep in (1,2)}
   comparisons[candidate+' vs '+control]={'stableCaseGain':gain,'perRepetitionGain':gains,'newSafetyIssues':new_safety,'passesGate':gain>=2 and all(n>=2 for n in gains.values()) and not new_safety}
  gate[reviewer]={'independentCases':len(cases),'stablePassingCases':stable,'perRepetitionPass':perrep,'comparisons':comparisons}
 (p/'holdout-gate.json').write_text(json.dumps(gate,indent=2)+'\n')
 print(json.dumps(gate,indent=2))
