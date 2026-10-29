import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceLifecycle, type VoiceState } from '../src/webview/lifecycle';
import { createVoiceTransport } from '../src/webview/transport';
import { parseVoiceConfiguration } from '../src/shared/provider';

function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', () => assert.fail('Mock mode must not make network requests.'));
  const events: { trial: number; event: string; name?: string; code?: string; resource?: string }[] = [];
  const states: VoiceState[] = [];
  let trial = 0;
  let captureLive = false;
  let toneLive = false;
  let responding = false;
  let transport: ReturnType<typeof createVoiceTransport> | undefined;
  const voice = createVoiceLifecycle({
    async acquire() { captureLive = true; return { close() { captureLive = false; } }; },
    async connect(context) {
      const attempt = ++trial;
      transport = createVoiceTransport({ ...context, provider: 'mock', observe: event => events.push({ ...event, trial: attempt }),
        tone() { toneLive = true; return { close() { toneLive = false; } }; },
        responding(value) { responding = value; }, failed: () => voice.end()
      });
      await transport.connect();
    },
    changed: state => states.push(state), failed: error => assert.fail(String(error))
  });
  return { voice, events, states, respond: () => transport?.respond(), fail: () => transport?.fail(), live: () => ({ captureLive, toneLive, responding }) };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('provider configuration validates once into a frozen discriminated variant', () => {
  const mock = parseVoiceConfiguration({ provider: 'mock' });
  assert.deepEqual(mock, { provider: 'mock' });
  assert.equal(Object.isFrozen(mock), true);
  assert.deepEqual(parseVoiceConfiguration({ provider: 'openai', model: 'gpt-realtime' }), { provider: 'openai', model: 'gpt-realtime' });
  for (const input of [{ provider: 'other' }, { provider: 'openai' }, { provider: 'mock', model: 'gpt-realtime' }]) assert.throws(() => parseVoiceConfiguration(input));
});
test('mock startup waits 750 ms and End cancels startup without later activation', async t => {
  const run = setup(t);
  const startup = run.voice.start();
  await flush();
  t.mock.timers.tick(749);
  await flush();
  assert.deepEqual(run.states, ['starting']);
  run.voice.end();
  await startup;
  const ended = [...run.events];
  t.mock.timers.tick(1000);
  await flush();
  assert.deepEqual(run.events, ended);
  assert.deepEqual(run.states, ['starting', 'ended']);
  assert.deepEqual(run.live(), { captureLive: false, toneLive: false, responding: false });
  assert.equal(run.respond(), false);
});
test('mock responses emit created before done, reject overlap, and allow another response', async t => {
  const run = setup(t);
  const startup = run.voice.start();
  await flush(); t.mock.timers.tick(750); await startup;
  assert.equal(run.states.at(-1), 'active');
  assert.equal(run.respond(), true);
  assert.equal(run.respond(), false);
  assert.deepEqual(run.events.filter(event => event.name).map(event => event.name), ['response-created']);
  assert.equal(run.live().toneLive, true);
  t.mock.timers.tick(300);
  assert.deepEqual(run.events.filter(event => event.name).map(event => event.name), ['response-created', 'response-done']);
  assert.equal(run.live().toneLive, false);
  assert.equal(run.respond(), true);
  run.voice.end();
});
test('injected failure stops capture, tone, and pending response through the shared lifecycle', async t => {
  const run = setup(t);
  const startup = run.voice.start();
  await flush(); t.mock.timers.tick(750); await startup;
  run.respond(); run.fail();
  assert.equal(run.states.at(-1), 'ended');
  assert.equal(run.events.filter(event => event.code === 'provider-unavailable').length, 1);
  assert.deepEqual(run.live(), { captureLive: false, toneLive: false, responding: false });
  const ended = [...run.events];
  t.mock.timers.tick(1000);
  assert.deepEqual(run.events, ended);
  run.fail();
  assert.deepEqual(run.events, ended);
});
test('End cancels old response events and repeated cycles keep their attempt identity', async t => {
  const run = setup(t);
  const first = run.voice.start();
  await flush(); t.mock.timers.tick(750); await first;
  run.respond(); run.voice.end();
  const firstEvents = run.events.filter(event => event.trial === 1);
  const second = run.voice.start();
  await flush(); t.mock.timers.tick(750); await second;
  run.respond(); t.mock.timers.tick(300);
  run.voice.end();
  assert.deepEqual(run.events.filter(event => event.trial === 1), firstEvents);
  assert.deepEqual(run.events.filter(event => event.trial === 2 && event.name).map(event => event.name), ['response-created', 'response-done']);
  assert.deepEqual(run.states, ['starting', 'active', 'ended', 'starting', 'active', 'ended']);
  assert.deepEqual(run.live(), { captureLive: false, toneLive: false, responding: false });
});
