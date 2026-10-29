import type { ObservationInput } from '../shared/evidence';
import type { OwnedResource } from './lifecycle';
import { createMockTransport, type MockEvent } from './mock';

type ProviderEventName = Extract<ObservationInput, { event: 'provider-event' }>['name'];
type TransportEvent = MockEvent | { source: 'provider'; event: 'provider-event'; name: ProviderEventName };
type Connection = { signal: AbortSignal; retain(resource: OwnedResource): boolean; observe(event: TransportEvent): void; failed(): void };
export function createVoiceTransport(input: Connection & (
  | { provider: 'mock'; tone(): OwnedResource; responding(value: boolean): void }
  | { provider: 'openai'; stream: MediaStream; audio: HTMLAudioElement; credential(signal: AbortSignal): Promise<string>; notice(text: string): void }
)): { connect(): Promise<void>; respond(): boolean; fail(): void } {
  switch (input.provider) {
    case 'mock': return createMockTransport(input);
    case 'openai': return { async connect() {
        const peer = new RTCPeerConnection();
        input.retain({ close() { peer.close(); input.audio.pause(); input.audio.srcObject = null; input.observe({ event: 'resource-closed', resource: 'transport', liveTracks: 0 }); input.observe({ event: 'resource-closed', resource: 'playback', liveTracks: 0 }); } });
        peer.addEventListener('connectionstatechange', () => {
          if (peer.connectionState === 'failed' && !input.signal.aborted) { input.observe({ event: 'failure', code: 'provider-unavailable' }); input.failed(); }
        });
        peer.ontrack = event => {
          if (input.signal.aborted) { event.track.stop(); return; }
          input.audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
          void input.audio.play().catch(() => { input.notice('Playback blocked. Click the audio play control and record the limitation.'); });
        };
        const captured = input.stream;
        if (!captured) throw new Error('Microphone unavailable.');
        for (const track of captured.getTracks()) peer.addTrack(track, captured);
        const channel = peer.createDataChannel('oai-events');
        input.retain({ close() { channel.close(); } });
        channel.onmessage = event => {
          if (input.signal.aborted) return;
          let payload: unknown;
          try { payload = JSON.parse(typeof event.data === 'string' ? event.data : 'null'); } catch { return; }
          if (typeof payload !== 'object' || payload === null || !('type' in payload) || typeof payload.type !== 'string') return;
          const name = providerEvents.get(payload.type);
          if (!name) return;
          input.observe({ source: 'provider', event: 'provider-event', name });
        };
        const token = await input.credential(input.signal);
        if (input.signal.aborted) return;
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        const response = await fetch('https://api.openai.com/v1/realtime/calls', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/sdp' }, body: offer.sdp ?? '', signal: input.signal });
        if (!response.ok) throw new Error('Provider connection failed.');
        const answer = await response.text();
        if (input.signal.aborted) return;
        await peer.setRemoteDescription({ type: 'answer', sdp: answer });
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clean(); reject(new DOMException('Ended', 'AbortError')); };
          const timer = setTimeout(() => { clean(); reject(new Error('Connection timeout.')); }, 15000);
          const clean = () => { clearTimeout(timer); input.signal.removeEventListener('abort', abort); peer.removeEventListener('connectionstatechange', changed); };
          const changed = () => {
            if (peer.connectionState === 'connected') { clean(); resolve(); }
            if (['failed', 'closed'].includes(peer.connectionState)) { clean(); reject(new Error('Connection failed.')); }
          };
          input.signal.addEventListener('abort', abort, { once: true });
          peer.addEventListener('connectionstatechange', changed);
          if (input.signal.aborted) abort(); else changed();
        });
        input.observe({ event: 'acknowledgment', operation: 'connected' });
    }, respond: () => false, fail() {} };
  }
}

const providerEvents = new Map<string, ProviderEventName>([
  ['input_audio_buffer.speech_started', 'input-speech-started'], ['input_audio_buffer.speech_stopped', 'input-speech-stopped'],
  ['response.created', 'response-created'], ['response.done', 'response-done'],
  ['conversation.item.input_audio_transcription.completed', 'input-transcribed'],
  ['response.output_audio_transcript.done', 'output-transcribed'], ['error', 'error']
]);
