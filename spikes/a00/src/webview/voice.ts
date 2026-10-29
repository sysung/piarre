import { createVoiceLifecycle } from './lifecycle';
import { createVoiceTransport } from './transport';
import { voiceProviderSchema } from '../shared/provider';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };
const vscode = acquireVsCodeApi();
function element<T extends HTMLElement>(id: string, ctor: { new(): T }): T {
  const value = document.getElementById(id);
  if (!(value instanceof ctor)) throw new Error('Missing control.');
  return value;
}
const start = element('start', HTMLButtonElement);
const end = element('end', HTMLButtonElement);
const scenario = element('scenario', HTMLSelectElement);
const outcome = element('outcome', HTMLSelectElement);
const note = element('note', HTMLTextAreaElement);
const status = element('status', HTMLParagraphElement);
const log = element('log', HTMLPreElement);
const audio = element('audio', HTMLAudioElement);
let stream: MediaStream | undefined;
let sessionRequest = 0;
const provider = voiceProviderSchema.parse(document.body.dataset.provider);
const simulate = element('simulate', HTMLButtonElement);
const inject = element('inject', HTMLButtonElement);
let transport: ReturnType<typeof createVoiceTransport> | undefined;
let activeAttempt = { scenario: scenario.value, trial: 0 };
let active = false;
let responding = false;
let nextTrial = Date.now();
const trialHistory = new Map<string, number[]>();
const pending = new Map<number, { resolve(value: string): void; reject(error: Error): void }>();
const observeFor = (attempt: typeof activeAttempt) => (event: object) => {
  vscode.postMessage({ kind: 'observe', observation: { ...attempt, source: provider === 'mock' ? 'mock' : 'probe', ...event } });
  if ('event' in event && event.event === 'provider-event' && 'name' in event) log.textContent = `${provider === 'mock' ? 'mock · ' : ''}${String(event.name)}\n${log.textContent ?? ''}`.slice(0, 4000);
};
const observe = (event: object) => observeFor(activeAttempt)(event);
const controls = () => { simulate.disabled = !active || responding; inject.disabled = !active; };
const credential = (signal: AbortSignal, attempt: typeof activeAttempt) => new Promise<string>((resolve, reject) => {
  const requestId = ++sessionRequest;
  const abort = () => {
    pending.delete(requestId);
    vscode.postMessage({ kind: 'session-abort', requestId });
    reject(new DOMException('Ended', 'AbortError'));
  };
  if (signal.aborted) { abort(); return; }
  signal.addEventListener('abort', abort, { once: true });
  pending.set(requestId, {
    resolve(value) { signal.removeEventListener('abort', abort); resolve(value); },
    reject(error) { signal.removeEventListener('abort', abort); reject(error); }
  });
  vscode.postMessage({ kind: 'session-request', requestId, ...attempt });
});

const voice = createVoiceLifecycle({
  async acquire(signal) {
    const observe = observeFor(activeAttempt);
    const captured = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (!signal.aborted) stream = captured;
    return { close() { captured.getTracks().forEach(track => track.stop()); if (stream === captured) stream = undefined; observe({ event: 'resource-closed', resource: 'capture', liveTracks: captured.getTracks().filter(track => track.readyState === 'live').length }); } };
  },
  async connect(context) {
    const attempt = activeAttempt;
    const observe = observeFor(attempt);
    const common = { ...context, observe, failed: () => voice.end() };
    if (provider === 'mock') {
      transport = createVoiceTransport({ ...common, provider, failed() { voice.end(); status.textContent = 'Mock provider failure injected. Capture and playback ended.'; }, responding(value) { responding = value; controls(); }, tone() {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 440;
        gain.gain.value = 0.08;
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        void context.resume().catch(() => { if (!common.signal.aborted) status.textContent = 'Mock tone playback blocked.'; });
        return { close() { oscillator.stop(); oscillator.disconnect(); gain.disconnect(); void context.close(); } };
      } });
    } else {
      const captured = stream;
      if (!captured) throw new Error('Microphone unavailable.');
      transport = createVoiceTransport({ ...common, provider, stream: captured, audio, credential: signal => credential(signal, attempt), notice(text) { if (!context.signal.aborted) status.textContent = text; } });
    }
    await transport.connect();
  },
  changed(state) {
    const liveTracks = stream?.getTracks().filter(track => track.readyState === 'live').length ?? 0;
    active = state === 'active';
    controls();
    start.disabled = state === 'starting' || state === 'active' || state === 'cleanup-pending';
    scenario.disabled = start.disabled;
    status.textContent = `${state}. Live tracks ${liveTracks}.`;
    observe({ event: 'voice-state', state, liveTracks });
  },
  failed(error) {
    const code = error instanceof DOMException && error.name === 'NotAllowedError' ? 'permission-denied' : 'provider-unavailable';
    observe({ event: 'failure', code });
  }
});
start.onclick = () => {
  if (start.disabled) return;
  activeAttempt = Object.freeze({ scenario: scenario.value, trial: ++nextTrial });
  trialHistory.set(activeAttempt.scenario, [...(trialHistory.get(activeAttempt.scenario) ?? []), activeAttempt.trial].slice(-2));
  observe({ event: 'action', action: 'start' });
  void voice.start();
};
simulate.onclick = () => { transport?.respond(); };
inject.onclick = () => { transport?.fail(); };
end.onclick = () => { observe({ event: 'action', action: 'end' }); voice.end(); };
element('save', HTMLButtonElement).onclick = () => {
  const trials = trialHistory.get(scenario.value) ?? [];
  vscode.postMessage({ kind: 'finding', scenario: scenario.value, outcome: outcome.value, note: note.value, trials: scenario.value === 'voice-repeat' ? trials.slice(-2) : trials.slice(-1) });
};
window.addEventListener('pagehide', () => voice.end());
window.addEventListener('message', (event: MessageEvent<unknown>) => {
  const message = event.data;
  if (typeof message !== 'object' || message === null || !('kind' in message)) return;
  if (message.kind === 'history' && 'trials' in message && typeof message.trials === 'object' && message.trials !== null) {
    for (const [key, value] of Object.entries(message.trials)) if (Array.isArray(value) && value.every(item => typeof item === 'number')) trialHistory.set(key, value.slice(-2));
  } else if (message.kind === 'session' && 'requestId' in message && typeof message.requestId === 'number' && 'secret' in message && typeof message.secret === 'string') {
    pending.get(message.requestId)?.resolve(message.secret); pending.delete(message.requestId);
  } else if (message.kind === 'session-error' && 'requestId' in message && typeof message.requestId === 'number') {
    pending.get(message.requestId)?.reject(new Error('Session authorization failed.')); pending.delete(message.requestId);
  } else if (message.kind === 'notice' && 'text' in message && typeof message.text === 'string') { status.textContent = message.text; }
});
vscode.postMessage({ kind: 'ready' });
