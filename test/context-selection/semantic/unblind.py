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
