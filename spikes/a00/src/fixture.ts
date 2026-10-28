import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

const execute = promisify(execFile);
const checkpointSchema = z.discriminatedUnion('phase', [
  z.object({ token: z.string(), pid: z.number().int().positive(), phase: z.literal('active'), elapsedMs: z.number().nonnegative() }).strict(),
  z.object({ token: z.string(), pid: z.number().int().positive(), phase: z.literal('exited'), elapsedMs: z.number().nonnegative(), exitReason: z.enum(['signal', 'natural']) }).strict()
]);
type Checkpoint = z.infer<typeof checkpointSchema>;
export function classifyHelperExit(state: Checkpoint | undefined, stopped: boolean): 'external' | 'signal' | 'natural' | 'running' | 'unknown' {
  if (state?.phase === 'exited') return state.exitReason;
  if (state?.phase === 'active' && stopped && state.elapsedMs < 11000) return 'external';
  return state?.phase === 'active' ? 'running' : 'unknown';
}
export type Fixture = { directory: string; token: string; markerHash: string };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function createFixture(): Promise<Fixture> {
  const directory = await mkdtemp(join(tmpdir(), 'piarre-a00-fixture-'));
  const token = randomBytes(16).toString('hex');
  const marker = 'Preserve this pre-existing user note exactly.\n';
  await writeFile(join(directory, 'user-note.txt'), marker);
  await copyFile(join(__dirname, '..', 'fixtures', 'work.mjs'), join(directory, 'work.mjs'));
  await writeFile(join(directory, '.gitignore'), 'checkpoint.json\n');
  await writeFile(join(directory, 'result.txt'), 'baseline\n');
  await execute('git', ['init', '--quiet'], { cwd: directory });
  await execute('git', ['add', '.'], { cwd: directory });
  await execute('git', ['-c', 'user.name=A00 Fixture', '-c', 'user.email=a00@example.invalid', 'commit', '--quiet', '-m', 'Synthetic baseline'], { cwd: directory });
  return { directory, token, markerHash: hash(marker) };
}
export async function inspectFixture(fixture: Fixture): Promise<{ result: 'alpha' | 'beta' | 'missing' | 'unexpected'; userMarkerPreserved: boolean; helperStopped: boolean; helperExit: 'external' | 'signal' | 'natural' | 'running' | 'unknown' }> {
  const result = await readFile(join(fixture.directory, 'result.txt'), 'utf8').catch(() => undefined);
  const marker = await readFile(join(fixture.directory, 'user-note.txt'), 'utf8').catch(() => '');
  const state = await checkpoint(fixture);
  const stopped = await helperStopped(fixture);
  return {
    result: result?.trim() === 'alpha' ? 'alpha' : result?.trim() === 'beta' ? 'beta' : result === undefined ? 'missing' : 'unexpected',
    userMarkerPreserved: hash(marker) === fixture.markerHash,
    helperStopped: stopped,
    helperExit: classifyHelperExit(state, stopped)
  };
}
export async function checkpoint(fixture: Fixture): Promise<Checkpoint | undefined> {
  try {
    const state = checkpointSchema.parse(JSON.parse(await readFile(join(fixture.directory, 'checkpoint.json'), 'utf8')));
    return state.token === fixture.token ? state : undefined;
  } catch { return undefined; }
}
export async function helperStopped(fixture: Fixture): Promise<boolean> {
  const state = await checkpoint(fixture);
  if (!state) return false;
  try {
    const { stdout } = await execute('ps', ['-p', String(state.pid), '-o', 'command=']);
    return !stdout.includes(`work.mjs ${fixture.token}`);
  } catch (error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 1;
  }
}
export async function stopOwnedHelper(fixture: Fixture): Promise<void> {
  const state = await checkpoint(fixture);
  if (!state || await helperStopped(fixture)) return;
  const { stdout } = await execute('ps', ['-p', String(state.pid), '-o', 'command=']);
  if (stdout.includes(`work.mjs ${fixture.token}`)) process.kill(state.pid, 'SIGTERM');
}
export async function fixtureDiff(fixture: Fixture): Promise<string> {
  const { stdout } = await execute('git', ['diff', '--', 'result.txt', 'user-note.txt', 'work.mjs', '.gitignore'], { cwd: fixture.directory });
  return stdout;
}
export type Quiescence = { backendExited: boolean; groupEmpty: boolean; helperStopped: boolean };
export function canRestart(state: Quiescence): boolean { return state.backendExited && state.groupEmpty && state.helperStopped; }
