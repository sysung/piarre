export const scenarios = {
  'voice-two-turns': { experiment: 'voice', label: 'Two turns without another Start', expected: 'Audible replies to two distinct spoken turns.' },
  'voice-during-playback': { experiment: 'voice', label: 'Recognition during playback', expected: 'Record recognition and playback interruption for the tested audio setup.' },
  'voice-normal-end': { experiment: 'voice', label: 'Normal End', expected: 'Capture tracks end, playback stops, and the connection closes.' },
  'voice-end-during-start': { experiment: 'voice', label: 'End during startup', expected: 'Late startup resources close and do not revive capture.' },
  'voice-permission-denied': { experiment: 'voice', label: 'Microphone permission denied', expected: 'Failure is visible and all acquired resources close.' },
  'voice-provider-failure': { experiment: 'voice', label: 'Provider connection failure', expected: 'Failure is visible and all acquired resources close.' },
  'voice-panel-dispose': { experiment: 'voice', label: 'Panel disposal', expected: 'Disposal closes capture and playback. Confirm the OS indicator externally.' },
  'voice-repeat': { experiment: 'voice', label: 'Repeated Start and End', expected: 'Each new capture requires explicit Start and each End releases it.' },
  'coding-start': { experiment: 'coding', label: 'Start', expected: 'A real turn creates the requested fixture result.' },
  'coding-status': { experiment: 'coding', label: 'Status', expected: 'A supported read or event reports active and terminal work.' },
  'coding-steer': { experiment: 'coding', label: 'Steer active work', expected: 'A contradictory instruction changes the active turn result.' },
  'coding-cancel': { experiment: 'coding', label: 'Cancel active work', expected: 'The backend reports interruption and owned fixture work stops.' },
  'coding-restart': { experiment: 'coding', label: 'Reconcile and restart', expected: 'After proven termination, a replacement uses the partial fixture and preserves the user marker.' }
} satisfies Record<string, { experiment: 'voice' | 'coding'; label: string; expected: string }>;

export type ScenarioId = keyof typeof scenarios;
export type Experiment = (typeof scenarios)[ScenarioId]['experiment'];
export function isScenarioId(value: string): value is ScenarioId { return Object.hasOwn(scenarios, value); }
export function scenarioIds(experiment: Experiment): ScenarioId[] {
  return Object.keys(scenarios).filter(isScenarioId).filter(id => scenarios[id].experiment === experiment);
}
