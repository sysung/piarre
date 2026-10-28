import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canRestart, classifyHelperExit, createFixture, inspectFixture, fixtureDiff } from '../src/fixture';

test('restart refuses any uncertain writer boundary', () => {
  assert.equal(canRestart({ backendExited: true, groupEmpty: true, helperStopped: true }), true);
  for (const missing of ['backendExited', 'groupEmpty', 'helperStopped']) {
    const state = { backendExited: true, groupEmpty: true, helperStopped: true, [missing]: false };
    assert.equal(canRestart(state), false);
  }
});
test('a disposable Git fixture preserves and verifies the actual user marker', async () => {
  const fixture = await createFixture();
  assert.equal((await inspectFixture(fixture)).userMarkerPreserved, true);
  await writeFile(join(fixture.directory, 'result.txt'), 'beta\n');
  assert.equal((await inspectFixture(fixture)).result, 'beta');
  assert.match(await fixtureDiff(fixture), /\+beta/);
  assert.equal(await readFile(join(fixture.directory, 'user-note.txt'), 'utf8'), 'Preserve this pre-existing user note exactly.\n');
  await writeFile(join(fixture.directory, 'user-note.txt'), 'overwritten');
  assert.equal((await inspectFixture(fixture)).userMarkerPreserved, false);
});
test('fixture inspection distinguishes external termination from graceful and natural exits', async () => {
  const fixture = await createFixture();
  assert.equal(classifyHelperExit({ token: fixture.token, pid: process.pid, phase: 'active', elapsedMs: 100 }, true), 'external');
  await writeFile(join(fixture.directory, 'checkpoint.json'), JSON.stringify({ token: fixture.token, pid: process.pid, phase: 'exited', elapsedMs: 100, exitReason: 'signal' }));
  assert.equal((await inspectFixture(fixture)).helperExit, 'signal');
  await writeFile(join(fixture.directory, 'checkpoint.json'), JSON.stringify({ token: fixture.token, pid: process.pid, phase: 'exited', elapsedMs: 12000, exitReason: 'natural' }));
  assert.equal((await inspectFixture(fixture)).helperExit, 'natural');
});
