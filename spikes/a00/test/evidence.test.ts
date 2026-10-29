import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseWebviewMessage } from '../src/protocol';
import { EvidenceWriter } from '../src/evidence';
import { manifestSchema, observationInputSchema, parseResult, untestedFindings, decide, type Finding } from '../src/shared/evidence';
import { scenarioIds, scenarios, type ScenarioId } from '../src/shared/scenarios';
import { renderReport } from '../src/report';

const manifest = manifestSchema.parse({ experiment: 'voice', probeVersion: 'test', probeRevision: 'test', os: 'test', node: 'test', startedAt: new Date(0).toISOString(), authMechanism: 'test', billing: 'test', usage: 'unavailable', editor: 'test', provider: 'OpenAI Realtime', model: 'test', audioSetup: 'test', vad: 'test' });
test('unknown messages and unexpected fields are rejected at the Webview boundary', () => {
  assert.throws(() => parseWebviewMessage({ kind: 'exec', command: 'echo unsafe' }));
  assert.throws(() => parseWebviewMessage({ kind: 'ready', secret: 'redacted' }));
  assert.deepEqual(parseWebviewMessage({ kind: 'session-abort', requestId: 2 }), { kind: 'session-abort', requestId: 2 });
});
test('evidence rejects secrets, personal paths, and raw payload properties', () => {
  const base = { scenario: 'voice-two-turns', source: 'operator', event: 'operator-observation' };
  for (const note of ['sk-secret123456789', 'Bearer token', '/Users/example/project', 'api_key=example']) assert.throws(() => observationInputSchema.parse({ ...base, note }));
  assert.throws(() => observationInputSchema.parse({ scenario: 'voice-two-turns', source: 'provider', event: 'provider-event', name: 'response-done', raw: { text: 'unknown' } }));
});
test('missing scenarios and cross-scenario evidence cannot be finalized', () => {
  assert.throws(() => parseResult({ schemaVersion: 1, manifest, observations: [], findings: [] }));
  const findings = untestedFindings('voice').map(finding => finding.scenario === 'voice-normal-end' ? { scenario: finding.scenario, kind: 'verified', observed: 'Stopped', evidence: [1] } : finding);
  assert.throws(() => parseResult({ schemaVersion: 1, manifest, observations: [{ sequence: 1, elapsedMs: 0, scenario: 'voice-two-turns', source: 'probe', event: 'action', action: 'start' }], findings }));
});
test('observation time cannot move backwards', () => {
  assert.throws(() => parseResult({ schemaVersion: 1, manifest, findings: untestedFindings('voice'), observations: [
    { sequence: 1, elapsedMs: 2, scenario: 'voice-two-turns', source: 'probe', event: 'action', action: 'start' },
    { sequence: 2, elapsedMs: 1, scenario: 'voice-two-turns', source: 'probe', event: 'action', action: 'end' }
  ] }));
});
test('incremental observations survive before an atomically finalized result', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'a00-evidence-test-'));
  const writer = new EvidenceWriter(directory, manifest);
  writer.record({ scenario: 'voice-two-turns', source: 'probe', event: 'action', action: 'start' });
  await writer.flush();
  assert.equal(JSON.parse((await readFile(join(directory, 'observations.jsonl'), 'utf8')).trim()).sequence, 1);
  await writer.finalize(untestedFindings('voice'));
  const result = parseResult(JSON.parse(await readFile(join(directory, 'result.json'), 'utf8')));
  assert.equal(result.observations.length, 1);
});
test('unrun experiments produce no-go and reports require both experiment types', () => {
  assert.equal(decide(decisionResults([...untestedFindings('voice'), ...untestedFindings('coding')])).kind, 'no-go');
  const result = parseResult({ schemaVersion: 1, manifest, observations: [], findings: untestedFindings('voice') });
  assert.throws(() => renderReport([result, result]));
});
test('decision reports go only when every bounded scenario is verified', () => {
  const findings = [...scenarioIds('voice'), ...scenarioIds('coding')].map(scenario => basicFinding(scenario, 'verified'));
  assert.equal(decide(decisionResults(findings)).kind, 'go');
});
test('decision reports conditional go when native controls fail but restart is verified', () => {
  const findings = [...scenarioIds('voice'), ...scenarioIds('coding')].map(scenario => basicFinding(
    scenario,
    scenario === 'coding-steer' ? 'unsupported' : scenario === 'coding-cancel' ? 'failed' : 'verified'
  ));
  assert.equal(decide(decisionResults(findings)).kind, 'conditional-go');
  assert.equal(decide(decisionResults(findings.map(finding => finding.scenario === 'coding-restart' ? basicFinding(finding.scenario, 'blocked') : finding))).kind, 'no-go');
});
test('an acknowledgment and a note alone cannot verify a live capability', () => {
  const findings = untestedFindings('voice').map(finding => finding.scenario === 'voice-two-turns' ? { scenario: finding.scenario, kind: 'verified', observed: 'Heard audio', evidence: [1, 2] } : finding);
  assert.throws(() => parseResult({ schemaVersion: 1, manifest, findings, observations: [
    { sequence: 1, elapsedMs: 0, scenario: 'voice-two-turns', source: 'probe', event: 'acknowledgment', operation: 'connected' },
    { sequence: 2, elapsedMs: 1, scenario: 'voice-two-turns', source: 'operator', event: 'operator-observation', note: 'Heard audio' }
  ] }));
});
test('voice verification cannot combine effects from separate trials', () => {
  const findings = untestedFindings('voice').map(finding => finding.scenario === 'voice-two-turns' ? { scenario: finding.scenario, kind: 'verified', observed: 'Two replies', trials: [1], evidence: [1, 2, 3, 4] } : finding);
  assert.throws(() => parseResult({ schemaVersion: 1, manifest, findings, observations: [
    { sequence: 1, elapsedMs: 0, scenario: 'voice-two-turns', source: 'probe', trial: 1, event: 'action', action: 'start' },
    { sequence: 2, elapsedMs: 1, scenario: 'voice-two-turns', source: 'provider', trial: 1, event: 'provider-event', name: 'response-done' },
    { sequence: 3, elapsedMs: 2, scenario: 'voice-two-turns', source: 'provider', trial: 2, event: 'provider-event', name: 'response-done' },
    { sequence: 4, elapsedMs: 3, scenario: 'voice-two-turns', source: 'operator', trial: 1, event: 'operator-observation', note: 'Two replies' }
  ] }));
});
test('voice-repeat requires two complete successful cycles', () => {
  const findings = untestedFindings('voice').map(finding => finding.scenario === 'voice-repeat' ? { scenario: finding.scenario, kind: 'verified', observed: 'Repeated', trials: [1, 2], evidence: [1, 2, 3, 4, 5, 6, 7, 8] } : finding);
  assert.throws(() => parseResult({ schemaVersion: 1, manifest, findings, observations: [
    { sequence: 1, elapsedMs: 0, scenario: 'voice-repeat', source: 'probe', trial: 1, event: 'action', action: 'start' },
    { sequence: 2, elapsedMs: 1, scenario: 'voice-repeat', source: 'probe', trial: 1, event: 'voice-state', state: 'active', liveTracks: 1 },
    { sequence: 3, elapsedMs: 2, scenario: 'voice-repeat', source: 'probe', trial: 1, event: 'action', action: 'end' },
    { sequence: 4, elapsedMs: 3, scenario: 'voice-repeat', source: 'probe', trial: 1, event: 'resource-closed', resource: 'capture', liveTracks: 0 },
    { sequence: 5, elapsedMs: 4, scenario: 'voice-repeat', source: 'probe', trial: 1, event: 'voice-state', state: 'ended', liveTracks: 0 },
    { sequence: 6, elapsedMs: 5, scenario: 'voice-repeat', source: 'probe', trial: 2, event: 'action', action: 'start' },
    { sequence: 7, elapsedMs: 6, scenario: 'voice-repeat', source: 'probe', trial: 2, event: 'failure', code: 'permission-denied' },
    { sequence: 8, elapsedMs: 7, scenario: 'voice-repeat', source: 'operator', trial: 2, event: 'operator-observation', note: 'Second cycle failed' }
  ] }));
});
test('coding cancellation rejects a helper that may have exited naturally', () => {
  const codingManifest = manifestSchema.parse({ experiment: 'coding', probeVersion: '0.0.2', probeRevision: 'test', os: 'test', node: 'test', startedAt: new Date(0).toISOString(), authMechanism: 'test', billing: 'test', usage: 'unavailable', backend: 'Codex App Server', backendVersion: 'test', model: 'test', sandbox: 'workspace-write', approvalPolicy: 'never', fixture: 'temporary synthetic Git workspace' });
  const findings = untestedFindings('coding').map(finding => finding.scenario === 'coding-cancel' ? { scenario: finding.scenario, kind: 'verified', observed: 'Stopped', evidence: [1, 2] } : finding);
  assert.throws(() => parseResult({ schemaVersion: 1, manifest: codingManifest, findings, observations: [
    { sequence: 1, elapsedMs: 0, scenario: 'coding-cancel', source: 'backend', event: 'backend-state', state: 'interrupted' },
    { sequence: 2, elapsedMs: 1, scenario: 'coding-cancel', source: 'probe', event: 'fixture-check', result: 'unexpected', userMarkerPreserved: true, helperStopped: true, helperExit: 'natural' }
  ] }));
});
test('the report CLI round-trips validated unrun results and copies the evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'a00-report-test-'));
  const voice = { schemaVersion: 1, manifest, observations: [], findings: untestedFindings('voice') };
  const codingManifest = manifestSchema.parse({ experiment: 'coding', probeVersion: 'test', probeRevision: 'test', os: 'test', node: 'test', startedAt: new Date(0).toISOString(), authMechanism: 'test', billing: 'test', usage: 'unavailable', backend: 'Codex App Server', backendVersion: 'test', model: 'test', sandbox: 'workspace-write', approvalPolicy: 'never', fixture: 'temporary synthetic Git workspace' });
  const coding = { schemaVersion: 1, manifest: codingManifest, observations: [], findings: untestedFindings('coding') };
  await writeFile(join(directory, 'voice-input.json'), JSON.stringify(voice));
  await writeFile(join(directory, 'coding-input.json'), JSON.stringify(coding));
  await promisify(execFile)(process.execPath, ['--import', 'tsx', 'src/report.ts', join(directory, 'voice-input.json'), join(directory, 'coding-input.json'), join(directory, 'bundle', 'report.md')]);
  const report = await readFile(join(directory, 'bundle', 'report.md'), 'utf8');
  assert.match(report, /Investigation incomplete. Recommendation no-go/);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'bundle', 'voice', 'result.json'), 'utf8')), voice);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'bundle', 'coding', 'result.json'), 'utf8')), coding);
});

function basicFinding(scenario: ScenarioId, kind: Finding['kind']): Finding {
  switch (kind) {
    case 'verified': return { scenario, kind, observed: 'Observed.', evidence: [1] };
    case 'unsupported': return { scenario, kind, reason: 'Unsupported.', evidence: [1] };
    case 'failed': return { scenario, kind, expected: 'Expected.', observed: 'Failed.', evidence: [1] };
    case 'blocked': return { scenario, kind, prerequisite: 'Required.', evidence: [] };
    case 'not-tested': return { scenario, kind, reason: 'Not tested.' };
  }
}

function decisionResults(findings: Finding[]) {
  return (['voice', 'coding'] satisfies ('voice' | 'coding')[]).map(experiment => {
    const observations: object[] = [];
    const experimentFindings = findings.filter(finding => scenarios[finding.scenario].experiment === experiment).map(finding => {
      if (finding.kind === 'not-tested') return finding;
      const evidence: number[] = [];
      for (const trial of finding.scenario === 'voice-repeat' ? [1, 2] : [1]) {
        const events = experiment === 'voice' ? [
          { event: 'action', action: 'start' }, { event: 'voice-state', state: 'starting', liveTracks: 1 },
          { event: 'voice-state', state: 'active', liveTracks: 1 },
          { event: 'provider-event', name: 'input-speech-started' }, { event: 'provider-event', name: 'response-created' },
          { event: 'provider-event', name: 'response-done' }, { event: 'provider-event', name: 'response-done' },
          { event: 'failure', code: 'permission-denied' }, { event: 'voice-state', state: 'failed', liveTracks: 0 },
          { event: 'action', action: 'end' }, { event: 'action', action: 'dispose' },
          { event: 'voice-state', state: 'ended', liveTracks: 0 }, { event: 'resource-closed', resource: 'capture', liveTracks: 0 },
          { event: 'operator-observation', source: 'operator', note: 'Fixture observation.' }
        ] : [
          { event: 'backend-state', state: 'active' }, { event: 'backend-state', state: 'completed' },
          { event: 'backend-state', state: 'interrupted' }, { event: 'acknowledgment', operation: 'steer' },
          { event: 'fixture-check', result: 'alpha', userMarkerPreserved: true, helperStopped: true, helperExit: 'signal' },
          { event: 'fixture-check', result: 'beta', userMarkerPreserved: true, helperStopped: true, helperExit: 'signal' },
          { event: 'writer-stopped', mode: 'forced', backendExited: true, groupEmpty: true, helperStopped: true }
        ];
        for (const event of events) {
          const sequence = observations.length + 1;
          observations.push({ scenario: finding.scenario, source: 'probe', trial, ...event, sequence, elapsedMs: sequence });
          evidence.push(sequence);
        }
      }
      return { ...finding, evidence, ...(experiment === 'voice' ? { trials: finding.scenario === 'voice-repeat' ? [1, 2] : [1] } : {}) };
    });
    const resultManifest = experiment === 'voice' ? manifest : manifestSchema.parse({
      probeVersion: 'test', probeRevision: 'test', os: 'test', node: 'test', startedAt: new Date(0).toISOString(), authMechanism: 'test', billing: 'test', usage: 'unavailable', model: 'test', experiment: 'coding', backend: 'Codex App Server', backendVersion: 'test', sandbox: 'workspace-write', approvalPolicy: 'never', fixture: 'temporary synthetic Git workspace'
    });
    return parseResult({ schemaVersion: 1, manifest: resultManifest, observations, findings: experimentFindings });
  });
}

test('mock manifests require no credential, no billing, and the fixed mock model', () => {
  const mock = { ...manifest, provider: 'Local deterministic mock', model: 'piarre-deterministic-mock-v1', authMechanism: 'None. No credential is read.', billing: 'None. Local simulation has no provider billing.' };
  const parsed = manifestSchema.parse(mock);
  assert.equal(parsed.experiment === 'voice' && parsed.provider, 'Local deterministic mock');
  for (const change of [{ model: 'gpt-realtime' }, { billing: 'Charged' }, { authMechanism: 'API credential' }]) assert.throws(() => manifestSchema.parse({ ...mock, ...change }));
});
test('mock evidence remains no-go even when every bounded finding is verified', () => {
  const results = decisionResults([...scenarioIds('voice'), ...scenarioIds('coding')].map(scenario => basicFinding(scenario, 'verified')));
  const mockResults = results.map(result => result.manifest.experiment === 'voice' ? parseResult({ ...result, manifest: { ...result.manifest, provider: 'Local deterministic mock', model: 'piarre-deterministic-mock-v1', authMechanism: 'None. No credential is read.', billing: 'None. Local simulation has no provider billing.' }, observations: result.observations.map(event => ({ ...event, source: event.source === 'operator' ? 'operator' : 'mock' })) }) : result);
  assert.equal(decide(mockResults).kind, 'no-go');
  assert.match(renderReport(mockResults), /Local deterministic mock/);
  assert.match(renderReport(mockResults), /Recommendation no-go/);
});

test('simulated observations cannot be presented as live OpenAI evidence', () => {
  assert.throws(() => parseResult({ schemaVersion: 1, manifest, findings: untestedFindings('voice'), observations: [
    { sequence: 1, elapsedMs: 0, scenario: 'voice-two-turns', source: 'mock', trial: 1, event: 'action', action: 'start' }
  ] }));
});
test('simulated observations cannot be presented as coding evidence', async () => {
  const result = JSON.parse(await readFile('evidence/coding-2026-10-28/result.json', 'utf8'));
  result.observations.push({ sequence: result.observations.length + 1, elapsedMs: result.observations.at(-1).elapsedMs + 1, scenario: 'coding-start', source: 'mock', event: 'backend-state', state: 'completed' });
  assert.throws(() => parseResult(result));
});
test('committed live coding evidence still parses', async () => {
  const result = parseResult(JSON.parse(await readFile('evidence/coding-2026-10-28/result.json', 'utf8')));
  assert.equal(result.manifest.experiment, 'coding');
});
