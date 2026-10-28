import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceLifecycle, type OwnedResource, type VoiceState } from '../src/webview/lifecycle';

function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Not initialized.'); };
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
test('End stops a microphone stream acquired after End without connecting it', async () => {
  const media = deferred<OwnedResource>();
  let closed = 0;
  let connected = 0;
  const states: VoiceState[] = [];
  const voice = createVoiceLifecycle({ acquire: () => media.promise, async connect() { connected++; }, changed: state => states.push(state), failed: () => assert.fail('Unexpected failure') });
  const start = voice.start();
  voice.end();
  media.resolve({ close() { closed++; } });
  await start;
  assert.equal(closed, 1);
  assert.equal(connected, 0);
  assert.deepEqual(states, ['starting', 'ended']);
});
test('End is idempotent and a new explicit Start can acquire again', async () => {
  let acquired = 0;
  let closed = 0;
  const voice = createVoiceLifecycle({ async acquire() { acquired++; return { close() { closed++; } }; }, async connect() {}, changed() {}, failed() { assert.fail('Unexpected failure'); } });
  await voice.start(); await voice.start(); voice.end(); voice.end();
  assert.equal(acquired, 1); assert.equal(closed, 1);
  await voice.start(); voice.end();
  assert.equal(acquired, 2); assert.equal(closed, 2);
});
test('a stale authorization completion cannot activate an ended session', async () => {
  const credential = deferred<void>();
  const states: VoiceState[] = [];
  let closed = 0;
  const voice = createVoiceLifecycle({ async acquire() { return { close() { closed++; } }; }, async connect({ signal, retain }) {
    await credential.promise;
    retain({ close() { closed++; } });
    assert.equal(signal.aborted, true);
  }, changed: state => states.push(state), failed() { assert.fail('Unexpected failure'); } });
  const startup = voice.start();
  await Promise.resolve(); voice.end(); credential.resolve(); await startup;
  assert.equal(closed, 2); assert.deepEqual(states, ['starting', 'ended']);
});
test('connection failure closes every acquired resource', async () => {
  let closed = 0;
  let failures = 0;
  const voice = createVoiceLifecycle({ async acquire() { return { close() { closed++; } }; }, async connect({ retain }) { retain({ close() { closed++; } }); throw new Error('Connection failed'); }, changed() {}, failed() { failures++; } });
  await voice.start(); voice.end();
  assert.equal(closed, 2); assert.equal(failures, 1);
});
test('a failed microphone acquisition can be retried', async () => {
  const states: VoiceState[] = [];
  let attempts = 0;
  let failures = 0;
  let closed = 0;
  const voice = createVoiceLifecycle({
    async acquire() {
      attempts++;
      if (attempts === 1) throw new Error('Permission denied');
      return { close() { closed++; } };
    },
    async connect() {},
    changed: state => states.push(state),
    failed() { failures++; }
  });
  await voice.start();
  await voice.start();
  voice.end();
  assert.equal(attempts, 2);
  assert.equal(failures, 1);
  assert.equal(closed, 1);
  assert.deepEqual(states, ['starting', 'failed', 'starting', 'active', 'ended']);
});
test('End reports failed when any owned resource cannot close', async () => {
  const states: VoiceState[] = [];
  let failures = 0;
  let closed = 0;
  const voice = createVoiceLifecycle({
    async acquire() { return { close() { closed++; throw new Error('Close failed'); } }; },
    async connect({ retain }) { retain({ close() { closed++; } }); },
    changed: state => states.push(state),
    failed() { failures++; }
  });
  await voice.start();
  voice.end();
  assert.equal(closed, 2);
  assert.equal(failures, 1);
  assert.deepEqual(states, ['starting', 'active', 'cleanup-pending']);
});
test('failed cleanup blocks Start and repeated End retries unresolved resources', async () => {
  const states: VoiceState[] = [];
  let acquired = 0;
  let closeCalls = 0;
  let failClose = true;
  const voice = createVoiceLifecycle({
    async acquire() {
      acquired++;
      return { close() { closeCalls++; if (failClose) throw new Error('Close failed'); } };
    },
    async connect() {},
    changed: state => states.push(state),
    failed() {}
  });
  await voice.start();
  voice.end();
  await voice.start();
  assert.equal(acquired, 1);
  failClose = false;
  voice.end();
  await voice.start();
  assert.equal(acquired, 2);
  assert.equal(closeCalls, 2);
  assert.deepEqual(states, ['starting', 'active', 'cleanup-pending', 'ended', 'starting', 'active']);
});
