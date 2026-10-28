import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir, platform, release } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { CodexProbeClient, RpcFailure } from './codex';
import { EvidenceWriter } from './evidence';
import { canRestart, checkpoint, createFixture, fixtureDiff, helperStopped, inspectFixture, stopOwnedHelper, type Fixture, type Quiescence } from './fixture';
import { manifestSchema, untestedFindings, type Finding } from './shared/evidence';
import { scenarios, type ScenarioId } from './shared/scenarios';
import { sourceRevision } from './revision';

const execute = promisify(execFile);
type CodingCase = 'start' | 'steer' | 'cancel-restart';
const commandPrompt = (fixture: Fixture) => `Work only in this synthetic workspace. Preserve user-note.txt and work.mjs exactly. Do not install packages, use network, read secrets, use other tools, or delegate. Run node work.mjs ${fixture.token} and wait for it to finish. Then write exactly alpha to result.txt. Do not write result.txt before the command finishes.`;
export async function runCodingProbe(input: { outputDirectory: string; cases: CodingCase[]; signal: AbortSignal }): Promise<void> {
  if (process.platform === 'win32') throw new Error('This process ownership probe currently supports macOS and Linux.');
  const { stdout } = await execute('codex', ['--version']);
  const writer = new EvidenceWriter(input.outputDirectory, manifestSchema.parse({
    experiment: 'coding', probeVersion: '0.0.2', probeRevision: await sourceRevision(join(__dirname, '..')), os: `${platform()} ${release()}`, node: process.version,
    startedAt: new Date().toISOString(), authMechanism: 'Codex supported local login or configured API credential', billing: 'Existing Codex backend account. Bounded turns may consume plan usage or API charges.', usage: 'Unavailable. Inspect account usage separately.',
    backend: 'Codex App Server', backendVersion: stdout.trim(), model: 'backend default, pending initialization', sandbox: 'workspace-write', approvalPolicy: 'never', fixture: 'temporary synthetic Git workspace'
  }));
  let findings = untestedFindings('coding');
  const setFinding = (finding: Finding) => { findings = findings.map(previous => previous.scenario === finding.scenario ? finding : previous); };
  const evidence = (scenario: ScenarioId) => writer.observations.filter(event => event.scenario === scenario).map(event => event.sequence);
  const conclude = (scenario: ScenarioId, verified: boolean, observed: string) => {
    if (verified) setFinding({ scenario, kind: 'verified', observed, evidence: evidence(scenario) });
    else setFinding({ scenario, kind: 'failed', expected: scenarios[scenario].expected, observed, evidence: evidence(scenario) });
  };
  await writer.finalize(findings);
  for (const codingCase of input.cases) {
    input.signal.throwIfAborted();
    const scenario: ScenarioId = codingCase === 'start' ? 'coding-start' : codingCase === 'steer' ? 'coding-steer' : 'coding-cancel';
    const fixture = await createFixture();
    process.stdout.write(`Case ${codingCase}. Preserved fixture ${fixture.directory}\n`);
    let client: CodexProbeClient | undefined;
    let stopped: Quiescence | undefined;
    let cleanupUncertain = false;
    try {
      const deadline = AbortSignal.any([input.signal, AbortSignal.timeout(120000)]);
      let activeThread: string | undefined;
      client = new CodexProbeClient({ cwd: fixture.directory, observe(event) {
        if (event.threadId !== activeThread) return;
        writer.record({ scenario, source: 'backend', event: 'backend-state', state: event.state });
        if (codingCase === 'start') writer.record({ scenario: 'coding-status', source: 'backend', event: 'backend-state', state: event.state });
      } });
      await client.initialize();
      writer.manifest.authMechanism = await client.authMechanism();
      const thread = await client.startThread(fixture.directory);
      activeThread = thread.id;
      if (writer.manifest.experiment === 'coding') writer.manifest.model = thread.model;
      writer.record({ scenario, source: 'probe', event: 'action', action: 'start' });
      const turnId = await client.startTurn(thread.id, codingCase === 'start' ? 'Work only in this synthetic workspace. Write exactly alpha to result.txt. Preserve user-note.txt and work.mjs. Do not install, use network, read secrets, or delegate.' : commandPrompt(fixture));
      writer.record({ scenario, source: 'backend', event: 'acknowledgment', operation: 'turn-start' });
      if (codingCase === 'start') {
        writer.record({ scenario: 'coding-status', source: 'probe', event: 'action', action: 'status-read' });
        await client.request('thread/read', { threadId: thread.id, includeTurns: false });
        writer.record({ scenario: 'coding-status', source: 'backend', event: 'acknowledgment', operation: 'thread-read' });
        const terminal = await client.waitTerminal(turnId, deadline);
        const snapshot = await inspectFixture(fixture);
        writer.record({ scenario, source: 'probe', event: 'fixture-check', ...snapshot });
        conclude(scenario, terminal.state === 'completed' && snapshot.result === 'alpha' && snapshot.userMarkerPreserved, 'Terminal turn state and actual fixture contents checked.');
        conclude('coding-status', client.events.some(event => event.kind === 'status' && event.threadId === thread.id && event.state === 'active') && terminal.state === 'completed', 'Status was read through thread/read and observed through active and terminal notifications.');
      } else {
        await waitForActiveCheckpoint(fixture, client, turnId, deadline);
        const operation = codingCase === 'steer' ? 'steer' : 'interrupt';
        writer.record({ scenario, source: 'probe', event: 'action', action: operation });
        if (codingCase === 'steer') {
          await client.request('turn/steer', { threadId: thread.id, expectedTurnId: turnId, input: [{ type: 'text', text: 'Change the current task now. After the active helper finishes, write exactly beta instead of alpha to result.txt. Preserve user-note.txt.', text_elements: [] }] });
          writer.record({ scenario, source: 'backend', event: 'acknowledgment', operation });
          const terminal = await client.waitTerminal(turnId, deadline);
          const snapshot = await inspectFixture(fixture);
          writer.record({ scenario, source: 'probe', event: 'fixture-check', ...snapshot });
          conclude(scenario, terminal.state === 'completed' && snapshot.result === 'beta' && snapshot.userMarkerPreserved, snapshot.result === 'beta' ? 'The active turn produced beta after the contradictory instruction.' : 'Steering was acknowledged, but the active turn did not produce beta.');
        } else {
          let nativeStopped = false;
          try {
            await client.request('turn/interrupt', { threadId: thread.id, turnId });
            writer.record({ scenario, source: 'backend', event: 'acknowledgment', operation });
            const terminal = await client.waitTerminal(turnId, AbortSignal.any([deadline, AbortSignal.timeout(10000)]));
            for (let attempt = 0; attempt < 20 && !await helperStopped(fixture); attempt++) await delay(50, undefined, { signal: deadline });
            const snapshot = await inspectFixture(fixture);
            writer.record({ scenario, source: 'probe', event: 'fixture-check', ...snapshot });
            nativeStopped = terminal.state === 'interrupted' && snapshot.helperStopped && (snapshot.helperExit === 'external' || snapshot.helperExit === 'signal');
            conclude(scenario, nativeStopped && snapshot.userMarkerPreserved, nativeStopped ? 'The turn was interrupted and the owned helper stopped.' : 'Interrupt was acknowledged but native termination of the owned helper was not proven.');
          } catch (error) {
            const unsupported = error instanceof RpcFailure && error.code === -32601;
            writer.record({ scenario, source: 'probe', event: 'failure', code: unsupported ? 'unsupported' : 'protocol' });
            setFinding(unsupported ? { scenario, kind: 'unsupported', reason: 'The interrupt method was rejected as method-not-found.', evidence: evidence(scenario) } : { scenario, kind: 'failed', expected: scenarios[scenario].expected, observed: 'Native interrupt did not establish termination. The separately labeled forced stop fallback follows.', evidence: evidence(scenario) });
          }
          stopped = { ...await client.stop(), helperStopped: await helperStopped(fixture) };
          await stopOwnedHelper(fixture);
          for (let attempt = 0; attempt < 20 && !await helperStopped(fixture); attempt++) await delay(50);
          stopped.helperStopped = await helperStopped(fixture);
          writer.record({ scenario: 'coding-restart', source: 'probe', event: 'writer-stopped', mode: nativeStopped ? 'native' : 'forced', ...stopped });
          await writeFile(join(input.outputDirectory, 'cancel-before-restart.diff'), await fixtureDiff(fixture));
          if (canRestart(stopped)) {
            client = undefined;
            await restartFixture({ fixture, writer, signal: deadline });
            const after = await inspectFixture(fixture);
            writer.record({ scenario: 'coding-restart', source: 'probe', event: 'fixture-check', ...after });
            conclude('coding-restart', after.result === 'beta' && after.userMarkerPreserved && after.helperStopped, 'Stopped the owned backend and process group, inspected the partial diff, then ran a replacement task against that partial fixture.');
          } else setFinding({ scenario: 'coding-restart', kind: 'blocked', prerequisite: 'The previous writer and helper must be demonstrably stopped.', evidence: evidence('coding-restart') });
        }
      }
    } catch (error) {
      const code = error instanceof RpcFailure && error.code === -32601 ? 'unsupported' : input.signal.aborted ? 'aborted' : 'protocol';
      writer.record({ scenario, source: 'probe', event: 'failure', code });
      if (code === 'unsupported') setFinding({ scenario, kind: 'unsupported', reason: 'The tested backend rejected the attempted method as method-not-found.', evidence: evidence(scenario) });
      else setFinding({ scenario, kind: 'failed', expected: scenarios[scenario].expected, observed: 'The experiment could not establish the expected effect. Inspect sanitized events and the preserved fixture.', evidence: evidence(scenario) });
    } finally {
      if (client) { stopped = { ...await client.stop(), helperStopped: codingCase === 'start' || await helperStopped(fixture) }; }
      await stopOwnedHelper(fixture);
      if (stopped) {
        stopped.helperStopped = codingCase === 'start' || await helperStopped(fixture);
        cleanupUncertain = !canRestart(stopped);
        if (cleanupUncertain) writer.record({ scenario, source: 'probe', event: 'failure', code: 'cleanup-uncertain' });
      }
      await writeFile(join(input.outputDirectory, `${codingCase}.diff`), await fixtureDiff(fixture));
      await writer.finalize(findings);
    }
    if (cleanupUncertain) throw new Error('The previous coding writer did not reach a proven stopped state. Remaining cases are blocked.');
  }
  process.stdout.write(`Coding result ${join(input.outputDirectory, 'result.json')}\n`);
}

async function waitForActiveCheckpoint(fixture: Fixture, client: CodexProbeClient, turnId: string, signal: AbortSignal): Promise<void> {
  for (;;) {
    signal.throwIfAborted();
    if (client.events.some(event => event.kind === 'terminal' && event.turnId === turnId)) throw new Error('The turn ended before the control request.');
    const state = await checkpoint(fixture);
    if (state?.phase === 'active' && !await helperStopped(fixture)) return;
    await delay(50, undefined, { signal });
  }
}
async function restartFixture(input: { fixture: Fixture; writer: EvidenceWriter; signal: AbortSignal }): Promise<void> {
  let activeThread: string | undefined;
  const client = new CodexProbeClient({ cwd: input.fixture.directory, observe(event) { if (event.threadId === activeThread) input.writer.record({ scenario: 'coding-restart', source: 'backend', event: 'backend-state', state: event.state }); } });
  try {
    input.writer.record({ scenario: 'coding-restart', source: 'probe', event: 'action', action: 'restart' });
    await client.initialize();
    const thread = await client.startThread(input.fixture.directory);
    activeThread = thread.id;
    const turn = await client.startTurn(thread.id, 'Inspect the actual partial fixture. Write exactly beta to result.txt and preserve user-note.txt and work.mjs exactly. Do not run the helper again. Do not install, use network, read secrets, or delegate.');
    const terminal = await client.waitTerminal(turn, input.signal);
    if (terminal.state !== 'completed') throw new Error('Replacement did not complete.');
  } finally {
    const stopped = await client.stop();
    if (!stopped.backendExited || !stopped.groupEmpty) throw new Error('The replacement backend did not reach a proven stopped state.');
  }
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (!args.includes('--confirm-live') || args.some(arg => !['--confirm-live', '--case', 'start', 'steer', 'cancel-restart', 'all'].includes(arg))) {
    throw new Error('Usage: npm run probe:coding -- --confirm-live [--case start|steer|cancel-restart|all]. This launches billed real backend turns in synthetic temporary fixtures.');
  }
  const index = args.indexOf('--case');
  const selected = index < 0 ? 'all' : args[index + 1];
  let cases: CodingCase[];
  switch (selected) { case 'all': cases = ['start', 'steer', 'cancel-restart']; break; case 'start': case 'steer': case 'cancel-restart': cases = [selected]; break; default: throw new Error('Invalid case.'); }
  const directory = await mkdtemp(join(tmpdir(), 'piarre-a00-coding-'));
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once('SIGINT', abort); process.once('SIGTERM', abort);
  try { await runCodingProbe({ outputDirectory: resolve(directory), cases, signal: controller.signal }); }
  finally { process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort); }
}
if (require.main === module) void main().catch(error => { process.stderr.write(error instanceof Error && error.message.startsWith('Usage:') ? error.message + '\n' : 'Coding probe failed. Inspect preserved incremental evidence.\n'); process.exitCode = 1; });
