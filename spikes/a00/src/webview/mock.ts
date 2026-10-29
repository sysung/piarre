import type { OwnedResource } from './lifecycle';

export type MockEvent =
  | { event: 'acknowledgment'; operation: 'connected' }
  | { event: 'provider-event'; name: 'response-created' | 'response-done' }
  | { event: 'failure'; code: 'provider-unavailable' }
  | { event: 'resource-closed'; resource: 'transport' | 'playback'; liveTracks: 0 };

export function createMockTransport(input: {
  signal: AbortSignal;
  retain(resource: OwnedResource): boolean;
  observe(event: MockEvent): void;
  tone(): OwnedResource;
  failed(): void;
  responding(value: boolean): void;
}): { connect(): Promise<void>; respond(): boolean; fail(): void } {
  let connected = false;
  let responding = false;
  let tone: OwnedResource | undefined;
  let responseTimer: ReturnType<typeof setTimeout> | undefined;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let cancelStartup: (() => void) | undefined;
  let closed = false;
  const close = () => {
    if (closed && !tone) return;
    closed = true;
    connected = false;
    clearTimeout(startupTimer);
    clearTimeout(responseTimer);
    cancelStartup?.();
    tone?.close();
    tone = undefined;
    responding = false;
    input.responding(false);
    input.observe({ event: 'resource-closed', resource: 'transport', liveTracks: 0 });
    input.observe({ event: 'resource-closed', resource: 'playback', liveTracks: 0 });
    input.signal.removeEventListener('abort', close);
  };
  return {
    async connect() {
      if (!input.retain({ close })) return;
      input.signal.addEventListener('abort', close, { once: true });
      if (input.signal.aborted) { close(); return; }
      await new Promise<void>((resolve, reject) => {
        cancelStartup = () => reject(new DOMException('Ended', 'AbortError'));
        startupTimer = setTimeout(() => { cancelStartup = undefined; resolve(); }, 750);
      });
      if (closed || input.signal.aborted) return;
      connected = true;
      input.observe({ event: 'acknowledgment', operation: 'connected' });
    },
    respond() {
      if (!connected || closed || responding || input.signal.aborted) return false;
      responding = true;
      input.responding(true);
      input.observe({ event: 'provider-event', name: 'response-created' });
      try { tone = input.tone(); }
      catch { input.observe({ event: 'failure', code: 'provider-unavailable' }); input.failed(); return false; }
      responseTimer = setTimeout(() => {
        if (closed || input.signal.aborted) return;
        tone?.close();
        tone = undefined;
        responding = false;
        input.responding(false);
        input.observe({ event: 'provider-event', name: 'response-done' });
      }, 300);
      return true;
    },
    fail() {
      if (!connected || closed || input.signal.aborted) return;
      input.observe({ event: 'failure', code: 'provider-unavailable' });
      input.failed();
    }
  };
}
