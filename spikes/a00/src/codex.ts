import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';

const execute = promisify(execFile);
const envelope = z.object({ id: z.union([z.string(), z.number()]).optional(), method: z.string().optional(), params: z.unknown().optional(), result: z.unknown().optional(), error: z.object({ code: z.number() }).passthrough().optional() });
const turn = z.object({ id: z.string(), status: z.enum(['inProgress', 'completed', 'interrupted', 'failed']) });
const notification = z.discriminatedUnion('method', [
  z.object({ method: z.literal('turn/completed'), params: z.object({ threadId: z.string(), turn }) }),
  z.object({ method: z.literal('thread/status/changed'), params: z.object({ threadId: z.string(), status: z.discriminatedUnion('type', [z.object({ type: z.literal('active') }), z.object({ type: z.literal('idle') }), z.object({ type: z.literal('notLoaded') }), z.object({ type: z.literal('systemError') })]) }) })
]);
export class RpcFailure extends Error { constructor(readonly code: number) { super('Backend request failed.'); } }
export type BackendEvent = { kind: 'status'; threadId: string; state: 'active' | 'idle' | 'unknown' } | { kind: 'terminal'; threadId: string; turnId: string; state: 'completed' | 'interrupted' | 'failed' | 'unknown' };
export class CodexProbeClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly requests = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: NodeJS.Timeout }>();
  private nextId = 0;
  readonly events: BackendEvent[] = [];
  private exited = false;
  constructor(input: { cwd: string; observe(event: BackendEvent): void; executable?: string }) {
    this.child = spawn(input.executable ?? 'codex', ['app-server', '--listen', 'stdio://'], { cwd: input.cwd, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = createInterface({ input: this.child.stdout });
    this.child.stderr.resume();
    lines.on('line', line => {
      let raw: unknown;
      try { raw = JSON.parse(line); } catch { return; }
      const decoded = envelope.safeParse(raw);
      if (!decoded.success) return;
      const message = decoded.data;
      if (message.id !== undefined && message.method === undefined && typeof message.id === 'number') {
        const pending = this.requests.get(message.id);
        if (!pending) return;
        this.requests.delete(message.id); clearTimeout(pending.timer);
        if (message.error) pending.reject(new RpcFailure(message.error.code)); else pending.resolve(message.result);
        return;
      }
      if (message.id !== undefined && message.method !== undefined) {
        this.send({ id: message.id, error: { code: -32601, message: 'A00 probe does not grant interactive approval.' } });
        return;
      }
      const parsed = notification.safeParse(raw);
      if (!parsed.success) return;
      const value = parsed.data;
      let event: BackendEvent;
      if (value.method === 'turn/completed') event = { kind: 'terminal', threadId: value.params.threadId, turnId: value.params.turn.id, state: value.params.turn.status === 'inProgress' ? 'unknown' : value.params.turn.status };
      else event = { kind: 'status', threadId: value.params.threadId, state: value.params.status.type === 'active' ? 'active' : value.params.status.type === 'idle' ? 'idle' : 'unknown' };
      this.events.push(event); input.observe(event);
    });
    this.child.on('error', () => this.failPending());
    this.child.on('exit', () => { this.exited = true; lines.close(); this.failPending(); });
  }
  private failPending(): void { for (const request of this.requests.values()) { clearTimeout(request.timer); request.reject(new Error('Backend exited.')); } this.requests.clear(); }
  private send(value: unknown): void { if (!this.child.stdin.destroyed) this.child.stdin.write(JSON.stringify(value) + '\n'); }
  request(method: string, params: unknown): Promise<unknown> {
    if (this.exited) return Promise.reject(new Error('Backend exited.'));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.requests.delete(id); reject(new Error('Backend request timeout.')); }, 20000);
      this.requests.set(id, { resolve, reject, timer });
      this.send({ id, method, params });
    });
  }
  async initialize(): Promise<void> {
    await this.request('initialize', { clientInfo: { name: 'piarre-a00', title: 'Piarre A00', version: '0.0.2' }, capabilities: { experimentalApi: true, requestAttestation: false } });
    this.send({ method: 'initialized', params: {} });
  }
  async authMechanism(): Promise<string> {
    const response = z.object({ account: z.discriminatedUnion('type', [
      z.object({ type: z.literal('apiKey') }),
      z.object({ type: z.literal('chatgpt'), planType: z.string() }),
      z.object({ type: z.literal('amazonBedrock'), usesCodexManagedCredentials: z.boolean() })
    ]).nullable() }).parse(await this.request('account/read', { refreshToken: false }));
    if (!response.account) return 'No authenticated Codex account reported';
    switch (response.account.type) {
      case 'apiKey': return 'Codex API key';
      case 'chatgpt': return `ChatGPT account, ${response.account.planType} plan`;
      case 'amazonBedrock': return response.account.usesCodexManagedCredentials ? 'Amazon Bedrock with Codex-managed credentials' : 'Amazon Bedrock with user-managed credentials';
    }
  }
  async startThread(cwd: string): Promise<{ id: string; model: string }> {
    const response = z.object({ thread: z.object({ id: z.string() }), model: z.string().optional() }).parse(await this.request('thread/start', { cwd, runtimeWorkspaceRoots: [cwd], approvalPolicy: 'never', sandbox: 'workspace-write', ephemeral: true }));
    return { id: response.thread.id, model: response.model ?? 'backend default, not reported' };
  }
  async startTurn(threadId: string, text: string): Promise<string> {
    const response = z.object({ turn }).parse(await this.request('turn/start', { threadId, input: [{ type: 'text', text, text_elements: [] }] }));
    return response.turn.id;
  }
  async waitTerminal(turnId: string, signal: AbortSignal): Promise<Extract<BackendEvent, { kind: 'terminal' }>> {
    for (;;) {
      signal.throwIfAborted();
      const event = this.events.find((value): value is Extract<BackendEvent, { kind: 'terminal' }> => value.kind === 'terminal' && value.turnId === turnId);
      if (event) return event;
      if (this.exited) throw new Error('Backend exited before terminal event.');
      await delay(50, undefined, { signal });
    }
  }
  async stop(): Promise<{ backendExited: boolean; groupEmpty: boolean }> {
    const pid = this.child.pid;
    if (!pid) return { backendExited: this.exited, groupEmpty: false };
    const groupEmpty = async () => {
      try {
        const { stdout } = await execute('ps', ['-axo', 'pid=,pgid=']);
        return !stdout.split('\n').some(line => Number(line.trim().split(/\s+/)[1]) === pid);
      } catch { return false; }
    };
    const signalGroup = (signal: NodeJS.Signals) => { try { process.kill(-pid, signal); } catch (error) { if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ESRCH')) throw error; } };
    signalGroup('SIGTERM');
    for (let attempt = 0; attempt < 40; attempt++) { if (this.exited && await groupEmpty()) return { backendExited: true, groupEmpty: true }; await delay(50); }
    signalGroup('SIGKILL');
    for (let attempt = 0; attempt < 40; attempt++) { if (this.exited && await groupEmpty()) return { backendExited: true, groupEmpty: true }; await delay(50); }
    return { backendExited: this.exited, groupEmpty: await groupEmpty() };
  }
}
