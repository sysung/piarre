import { z } from 'zod';
import { isScenarioId, scenarioIds, scenarios, type Experiment } from './scenarios';

const privatePattern = /(?:sk-[a-zA-Z0-9_-]{8,}|ek_[a-zA-Z0-9_-]{8,}|Bearer\s+\S+|\/Users\/|\/home\/|Authorization|client_secret|api[_-]?key\s*[:=])/i;
export const safeText = z.string().max(2000).refine(value => !privatePattern.test(value), 'Private material is not allowed in evidence.');
export const scenarioSchema = z.custom<keyof typeof scenarios>(value => typeof value === 'string' && isScenarioId(value), 'Unknown scenario.');
const trial = z.number().int().positive();
const common = { scenario: scenarioSchema, source: z.enum(['probe', 'provider', 'backend', 'operator']), trial: trial.optional() };
export const observationInputSchema = z.discriminatedUnion('event', [
  z.object({ ...common, event: z.literal('action'), action: z.enum(['start', 'end', 'dispose', 'steer', 'interrupt', 'restart', 'status-read']) }).strict(),
  z.object({ ...common, event: z.literal('acknowledgment'), operation: z.enum(['connected', 'turn-start', 'steer', 'interrupt', 'thread-read']) }).strict(),
  z.object({ ...common, event: z.literal('voice-state'), state: z.enum(['idle', 'starting', 'active', 'ended', 'failed', 'cleanup-pending']), liveTracks: z.number().int().nonnegative() }).strict(),
  z.object({ ...common, event: z.literal('resource-closed'), resource: z.enum(['capture', 'transport', 'playback']), liveTracks: z.number().int().nonnegative() }).strict(),
  z.object({ ...common, event: z.literal('provider-event'), name: z.enum(['input-speech-started', 'input-speech-stopped', 'response-created', 'response-done', 'input-transcribed', 'output-transcribed', 'error']) }).strict(),
  z.object({ ...common, event: z.literal('backend-state'), state: z.enum(['active', 'idle', 'completed', 'interrupted', 'failed', 'unknown']) }).strict(),
  z.object({ ...common, event: z.literal('fixture-check'), result: z.enum(['alpha', 'beta', 'missing', 'unexpected']), userMarkerPreserved: z.boolean(), helperStopped: z.boolean(), helperExit: z.enum(['external', 'signal', 'natural', 'running', 'unknown']).optional() }).strict(),
  z.object({ ...common, event: z.literal('writer-stopped'), mode: z.enum(['native', 'forced']), backendExited: z.boolean(), groupEmpty: z.boolean(), helperStopped: z.boolean() }).strict(),
  z.object({ ...common, event: z.literal('operator-observation'), note: safeText.min(1) }).strict(),
  z.object({ ...common, event: z.literal('failure'), code: z.enum(['permission-denied', 'provider-unavailable', 'authentication', 'quota', 'protocol', 'timeout', 'unsupported', 'cleanup-uncertain', 'invalid-trial', 'unexpected', 'aborted']) }).strict()
]);
export type ObservationInput = z.infer<typeof observationInputSchema>;
export const observationSchema = z.object({ sequence: z.number().int().positive(), elapsedMs: z.number().nonnegative() }).passthrough().transform(value => {
  const { sequence, elapsedMs, ...input } = value;
  return { ...observationInputSchema.parse(input), sequence, elapsedMs };
});
export type Observation = ObservationInput & { sequence: number; elapsedMs: number };
const refs = z.array(z.number().int().positive()).min(1);
export const findingSchema = z.discriminatedUnion('kind', [
  z.object({ scenario: scenarioSchema, kind: z.literal('verified'), observed: safeText.min(1), evidence: refs, trials: z.array(trial).max(2).optional() }).strict(),
  z.object({ scenario: scenarioSchema, kind: z.literal('unsupported'), reason: safeText.min(1), evidence: refs, trials: z.array(trial).max(2).optional() }).strict(),
  z.object({ scenario: scenarioSchema, kind: z.literal('failed'), expected: safeText.min(1), observed: safeText.min(1), evidence: refs, trials: z.array(trial).max(2).optional() }).strict(),
  z.object({ scenario: scenarioSchema, kind: z.literal('blocked'), prerequisite: safeText.min(1), evidence: z.array(z.number().int().positive()), trials: z.array(trial).max(2).optional() }).strict(),
  z.object({ scenario: scenarioSchema, kind: z.literal('not-tested'), reason: safeText.min(1) }).strict()
]);
export type Finding = z.infer<typeof findingSchema>;
const environment = {
  probeVersion: safeText.min(1), probeRevision: safeText.min(1), os: safeText.min(1), node: safeText.min(1),
  startedAt: z.string().datetime(), authMechanism: safeText.min(1), billing: safeText.min(1), usage: safeText.min(1)
};
export const manifestSchema = z.discriminatedUnion('experiment', [
  z.object({ ...environment, experiment: z.literal('voice'), editor: safeText.min(1), provider: z.literal('OpenAI Realtime'), model: safeText.min(1), audioSetup: safeText.min(1), vad: safeText.min(1) }).strict(),
  z.object({ ...environment, experiment: z.literal('coding'), backend: z.literal('Codex App Server'), backendVersion: safeText.min(1), model: safeText.min(1), sandbox: z.literal('workspace-write'), approvalPolicy: z.literal('never'), fixture: z.literal('temporary synthetic Git workspace') }).strict()
]);
export type Manifest = z.infer<typeof manifestSchema>;
export const resultSchema = z.object({ schemaVersion: z.literal(1), manifest: manifestSchema, observations: z.array(observationSchema), findings: z.array(findingSchema) }).strict();
export type ExperimentResult = z.infer<typeof resultSchema>;

export function parseResult(input: unknown): ExperimentResult {
  const result = resultSchema.parse(input);
  const expected = scenarioIds(result.manifest.experiment);
  if (result.findings.length !== expected.length || new Set(result.findings.map(f => f.scenario)).size !== expected.length || result.findings.some(f => !expected.includes(f.scenario))) {
    throw new Error('Every experiment scenario needs exactly one finding.');
  }
  result.observations.forEach((event, index) => {
    if (event.sequence !== index + 1 || !expected.includes(event.scenario)) throw new Error('Invalid observation sequence or experiment.');
    if (index > 0 && event.elapsedMs < (result.observations[index - 1]?.elapsedMs ?? 0)) throw new Error('Observation time moved backwards.');
  });
  for (const finding of result.findings) {
    if (result.manifest.experiment === 'voice' && finding.kind !== 'not-tested') {
      const requiredTrials = finding.scenario === 'voice-repeat' ? 2 : 1;
      if (finding.trials?.length !== requiredTrials || new Set(finding.trials).size !== requiredTrials) throw new Error('Voice findings must identify the exact trial or trials.');
    }
    if (!('evidence' in finding)) continue;
    for (const sequence of finding.evidence) {
      const event = result.observations[sequence - 1];
      if (!event || event.scenario !== finding.scenario) throw new Error('Evidence reference does not resolve to this scenario.');
      if (finding.trials && (!event.trial || !finding.trials.includes(event.trial))) throw new Error('Voice evidence does not belong to the selected trial.');
    }
    if (finding.kind === 'verified') {
      const events = result.observations.filter(event => finding.evidence.includes(event.sequence));
      if (!supportsVerifiedFinding(finding.scenario, events, result.manifest.probeVersion)) throw new Error('Verified finding lacks required effect evidence.');
    }
  }
  return result;
}

function supportsVerifiedFinding(scenario: keyof typeof scenarios, events: readonly Observation[], probeVersion: string): boolean {
  const countAction = (action: 'start' | 'end' | 'dispose') => events.filter(event => event.event === 'action' && event.action === action).length;
  const manual = events.some(event => event.event === 'operator-observation' && event.source === 'operator');
  const ended = events.some(event => event.event === 'voice-state' && event.state === 'ended' && event.liveTracks === 0);
  const closedCapture = events.some(event => event.event === 'resource-closed' && event.resource === 'capture' && event.liveTracks === 0);
  switch (scenario) {
    case 'voice-two-turns': return manual && countAction('start') > 0 && events.filter(event => event.event === 'provider-event' && event.name === 'response-done').length >= 2;
    case 'voice-during-playback': return manual && events.some(event => event.event === 'provider-event' && event.name === 'input-speech-started') && events.some(event => event.event === 'provider-event' && event.name === 'response-created');
    case 'voice-normal-end': return manual && countAction('end') > 0 && ended && closedCapture;
    case 'voice-end-during-start': return manual && countAction('end') > 0 && ended && events.some(event => event.event === 'voice-state' && event.state === 'starting');
    case 'voice-permission-denied': return manual && events.some(event => event.event === 'failure' && event.code === 'permission-denied') && events.some(event => event.event === 'voice-state' && event.state === 'failed' && event.liveTracks === 0);
    case 'voice-provider-failure': return manual && events.some(event => event.event === 'failure') && closedCapture;
    case 'voice-panel-dispose': return manual && countAction('dispose') > 0;
    case 'voice-repeat': {
      const trials = [...new Set(events.map(event => event.trial).filter((value): value is number => value !== undefined))];
      return manual && trials.length === 2 && trials.every(value => {
        const cycle = events.filter(event => event.trial === value);
        return cycle.some(event => event.event === 'action' && event.action === 'start')
          && cycle.some(event => event.event === 'voice-state' && event.state === 'active')
          && cycle.some(event => event.event === 'action' && event.action === 'end')
          && cycle.some(event => event.event === 'voice-state' && event.state === 'ended' && event.liveTracks === 0)
          && cycle.some(event => event.event === 'resource-closed' && event.resource === 'capture' && event.liveTracks === 0);
      });
    }
    case 'coding-start': return events.some(event => event.event === 'backend-state' && event.state === 'completed') && events.some(event => event.event === 'fixture-check' && event.result === 'alpha' && event.userMarkerPreserved);
    case 'coding-status': return events.some(event => event.event === 'backend-state' && event.state === 'active') && events.some(event => event.event === 'backend-state' && event.state === 'completed');
    case 'coding-steer': return events.some(event => event.event === 'acknowledgment' && event.operation === 'steer') && events.some(event => event.event === 'fixture-check' && event.result === 'beta' && event.userMarkerPreserved) && events.some(event => event.event === 'backend-state' && event.state === 'completed');
    case 'coding-cancel': return events.some(event => event.event === 'backend-state' && event.state === 'interrupted') && events.some(event => event.event === 'fixture-check' && event.helperStopped && event.userMarkerPreserved && (probeVersion === '0.0.1' || event.helperExit === 'external' || event.helperExit === 'signal'));
    case 'coding-restart': return events.some(event => event.event === 'writer-stopped' && event.backendExited && event.groupEmpty && event.helperStopped) && events.some(event => event.event === 'fixture-check' && event.result === 'beta' && event.userMarkerPreserved);
  }
}

export type Decision =
  | { kind: 'go'; reason: string }
  | { kind: 'conditional-go'; reason: string }
  | { kind: 'no-go'; reason: string };

export function decide(findings: readonly Finding[]): Decision {
  const get = (scenario: keyof typeof scenarios) => findings.find(finding => finding.scenario === scenario)?.kind;
  const voiceReady = scenarioIds('voice').every(id => get(id) === 'verified');
  if (!voiceReady || get('coding-start') !== 'verified' || get('coding-status') !== 'verified') return { kind: 'no-go', reason: 'Required voice, start, or status evidence remains unverified.' };
  if (get('coding-steer') === 'verified' && get('coding-cancel') === 'verified' && get('coding-restart') === 'verified') return { kind: 'go', reason: 'All required bounded experiments are verified.' };
  if (get('coding-restart') === 'verified' && ['verified', 'unsupported', 'failed'].includes(get('coding-steer') ?? '') && ['verified', 'unsupported', 'failed'].includes(get('coding-cancel') ?? '')) return { kind: 'conditional-go', reason: 'Use the verified stop, reconcile, and restart fallback. Native control limitations remain.' };
  return { kind: 'no-go', reason: 'Coding control or safe replacement remains unverified.' };
}

export function untestedFindings(experiment: Experiment): Finding[] {
  return scenarioIds(experiment).map(scenario => ({ scenario, kind: 'not-tested', reason: 'The live procedure has not been observed.' }));
}
