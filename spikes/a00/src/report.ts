import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { readResult } from './evidence';
import { decide, type ExperimentResult } from './shared/evidence';
import { scenarios } from './shared/scenarios';

const cell = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ').replace(/[<>]/g, '');
export function renderReport(results: readonly ExperimentResult[]): string {
  if (results.length !== 2 || new Set(results.map(r => r.manifest.experiment)).size !== 2) throw new Error('Provide one voice result and one coding result.');
  const findings = results.flatMap(result => result.findings);
  const decision = decide(findings);
  const complete = findings.every(finding => !['not-tested', 'blocked'].includes(finding.kind));
  const rows = results.flatMap(result => result.findings.map(finding => {
    const detail = 'observed' in finding ? finding.observed : 'reason' in finding ? finding.reason : finding.prerequisite;
    const refs = 'evidence' in finding ? `${result.manifest.experiment}/result.json, observation sequences ${finding.evidence.join(', ')}` : '';
    return `| ${finding.scenario} | ${cell(scenarios[finding.scenario].expected)} | ${finding.kind} | ${cell(detail)} | ${cell(refs)} |`;
  }));
  return `# A00 capability findings\n\nInvestigation ${complete ? 'completed' : 'incomplete'}. Recommendation ${decision.kind}.\n\n${decision.reason}\n\nThe recommendation applies only to the configurations and bounded fixtures below.\n\n${results.map(result => '## ' + result.manifest.experiment + ' configuration\n\n```json\n' + JSON.stringify(result.manifest, null, 2) + '\n```').join('\n\n')}\n\n## Capability matrix\n\n| Scenario | Expected | Outcome | Observed or limitation | Evidence |\n|---|---|---|---|---|\n${rows.join('\n')}\n\n## Limits\n\nThe coding CLI does not prove extension-host process launch or authentication inheritance. Native thread resume is not tested. A completed investigation with failed audio does not fulfill the issue's working-audio criterion. Raw audio and video are not collected.\n`;
}

async function main(): Promise<void> {
  const [voice, coding, destination] = process.argv.slice(2);
  if (!voice || !coding || !destination || process.argv.length !== 5) throw new Error('Usage: npm run report -- <voice/result.json> <coding/result.json> <report.md>');
  const results = await Promise.all([readResult(resolve(voice)), readResult(resolve(coding))]);
  await mkdir(dirname(resolve(destination)), { recursive: true });
  for (const result of results) {
    const directory = join(dirname(resolve(destination)), result.manifest.experiment);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  }
  await writeFile(resolve(destination), renderReport(results));
  process.stdout.write(`Report written to ${resolve(destination)}\n`);
}
if (require.main === module) void main().catch(() => { process.stderr.write('Report failed. Check paths, schema, evidence references, and scenario completeness.\n'); process.exitCode = 1; });
