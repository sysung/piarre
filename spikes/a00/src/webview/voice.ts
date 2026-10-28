import { createVoiceLifecycle } from './lifecycle';

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
let currentTrial = 0;
let nextTrial = Date.now();
const trialHistory = new Map<string, number[]>();
const pending = new Map<number, { resolve(value: string): void; reject(error: Error): void }>();
const observe = (event: object) => vscode.postMessage({ kind: 'observe', observation: { scenario: scenario.value, source: 'probe', trial: currentTrial, ...event } });
const credential = (signal: AbortSignal) => new Promise<string>((resolve, reject) => {
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
  vscode.postMessage({ kind: 'session-request', requestId, scenario: scenario.value, trial: currentTrial });
});

const providerEvents = new Map([
  ['input_audio_buffer.speech_started', 'input-speech-started'], ['input_audio_buffer.speech_stopped', 'input-speech-stopped'],
  ['response.created', 'response-created'], ['response.done', 'response-done'],
  ['conversation.item.input_audio_transcription.completed', 'input-transcribed'],
  ['response.output_audio_transcript.done', 'output-transcribed'], ['error', 'error']
]);
const voice = createVoiceLifecycle({
  async acquire(signal) {
    const captured = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (!signal.aborted) stream = captured;
    return { close() { captured.getTracks().forEach(track => track.stop()); if (stream === captured) stream = undefined; observe({ event: 'resource-closed', resource: 'capture', liveTracks: captured.getTracks().filter(track => track.readyState === 'live').length }); } };
  },
  async connect(context) {
    const peer = new RTCPeerConnection();
    context.retain({ close() { peer.close(); audio.pause(); audio.srcObject = null; observe({ event: 'resource-closed', resource: 'transport', liveTracks: 0 }); observe({ event: 'resource-closed', resource: 'playback', liveTracks: 0 }); } });
    peer.addEventListener('connectionstatechange', () => {
      if (peer.connectionState === 'failed' && !context.signal.aborted) { observe({ event: 'failure', code: 'provider-unavailable' }); voice.end(); }
    });
    peer.ontrack = event => {
      if (context.signal.aborted) { event.track.stop(); return; }
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      void audio.play().catch(() => { status.textContent = 'Playback blocked. Click the audio play control and record the limitation.'; });
    };
    const captured = stream;
    if (!captured) throw new Error('Microphone unavailable.');
    for (const track of captured.getTracks()) peer.addTrack(track, captured);
    const channel = peer.createDataChannel('oai-events');
    context.retain({ close() { channel.close(); } });
    channel.onmessage = event => {
      let payload: unknown;
      try { payload = JSON.parse(typeof event.data === 'string' ? event.data : 'null'); } catch { return; }
      if (typeof payload !== 'object' || payload === null || !('type' in payload) || typeof payload.type !== 'string') return;
      const name = providerEvents.get(payload.type);
      if (!name) return;
      observe({ source: 'provider', event: 'provider-event', name });
      log.textContent = `${name}\n${log.textContent ?? ''}`.slice(0, 4000);
    };
    const token = await credential(context.signal);
    if (context.signal.aborted) return;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const response = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/sdp' }, body: offer.sdp ?? '', signal: context.signal });
    if (!response.ok) throw new Error('Provider connection failed.');
    const answer = await response.text();
    if (context.signal.aborted) return;
    await peer.setRemoteDescription({ type: 'answer', sdp: answer });
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clean(); reject(new DOMException('Ended', 'AbortError')); };
      const timer = setTimeout(() => { clean(); reject(new Error('Connection timeout.')); }, 15000);
      const clean = () => { clearTimeout(timer); context.signal.removeEventListener('abort', abort); peer.removeEventListener('connectionstatechange', changed); };
      const changed = () => {
        if (peer.connectionState === 'connected') { clean(); resolve(); }
        if (['failed', 'closed'].includes(peer.connectionState)) { clean(); reject(new Error('Connection failed.')); }
      };
      context.signal.addEventListener('abort', abort, { once: true });
      peer.addEventListener('connectionstatechange', changed);
      if (context.signal.aborted) abort(); else changed();
    });
    observe({ event: 'acknowledgment', operation: 'connected' });
  },
  changed(state) {
    const liveTracks = stream?.getTracks().filter(track => track.readyState === 'live').length ?? 0;
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
  currentTrial = ++nextTrial;
  trialHistory.set(scenario.value, [...(trialHistory.get(scenario.value) ?? []), currentTrial].slice(-2));
  observe({ event: 'action', action: 'start' });
  void voice.start();
};
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
