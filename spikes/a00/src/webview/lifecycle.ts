export type OwnedResource = { close(): void };
export type VoiceState = 'idle' | 'starting' | 'active' | 'ended' | 'failed' | 'cleanup-pending';
type Attempt = { controller: AbortController; resources: Set<OwnedResource> };
export function createVoiceLifecycle(input: {
  acquire(signal: AbortSignal): Promise<OwnedResource>;
  connect(context: { signal: AbortSignal; retain(resource: OwnedResource): boolean }): Promise<void>;
  changed(state: VoiceState): void;
  failed(error: unknown): void;
}): { start(): Promise<void>; end(): void } {
  let current: Attempt | undefined;
  const close = (resource: OwnedResource): unknown | undefined => {
    try { resource.close(); return undefined; }
    catch (error) { return error; }
  };
  const release = (attempt: Attempt): unknown[] => {
    attempt.controller.abort();
    const errors: unknown[] = [];
    for (const resource of attempt.resources) {
      const error = close(resource);
      if (error === undefined) attempt.resources.delete(resource);
      else errors.push(error);
    }
    return errors;
  };
  const retain = (attempt: Attempt, resource: OwnedResource) => {
    if (current !== attempt || attempt.controller.signal.aborted) {
      const error = close(resource);
      if (error !== undefined) {
        attempt.resources.add(resource);
        current = attempt;
        input.failed(error);
        input.changed('cleanup-pending');
      }
      return false;
    }
    attempt.resources.add(resource);
    return true;
  };
  return {
    async start() {
      if (current) return;
      const attempt: Attempt = { controller: new AbortController(), resources: new Set() };
      current = attempt;
      input.changed('starting');
      try {
        const media = await input.acquire(attempt.controller.signal);
        if (!retain(attempt, media)) return;
        await input.connect({ signal: attempt.controller.signal, retain: resource => retain(attempt, resource) });
        if (current === attempt) input.changed('active');
      } catch (error) {
        const cleanupErrors = release(attempt);
        if (current !== attempt) return;
        if (cleanupErrors.length === 0) current = undefined;
        input.failed(cleanupErrors.length === 0 ? error : new AggregateError([error, ...cleanupErrors], 'Voice startup and cleanup failed.'));
        input.changed(cleanupErrors.length === 0 ? 'failed' : 'cleanup-pending');
      }
    },
    end() {
      const attempt = current;
      if (!attempt) return;
      const cleanupErrors = release(attempt);
      if (cleanupErrors.length > 0) {
        input.failed(new AggregateError(cleanupErrors, 'Voice cleanup failed.'));
        input.changed('cleanup-pending');
      } else {
        current = undefined;
        input.changed('ended');
      }
    }
  };
}
