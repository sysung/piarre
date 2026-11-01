import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import {
  UnsupportedWorkerOperation,
  type ExternalRunRef,
  type ObservedRunState,
  type WorkerAdapter,
  type WorkerCapabilities,
  type WorkerObservation,
  type WorkerStartResult,
  type WorkerTask,
} from "../../../packages/core/src/worker.js";

type JsonRecord = Record<string, unknown>;

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
}

interface ActiveRun {
  readonly task: WorkerTask;
  readonly threadId: string;
  readonly turnId: string;
  readonly observations: WorkerObservation[];
  readonly commandByItem: Map<string, string>;
  readonly filePathsByItem: Map<string, readonly string[]>;
  readonly waiters: Set<() => void>;
  state: ObservedRunState;
}

export interface MediationEvidence {
  readonly cliVersion: string;
  readonly approvalPolicy: "untrusted";
  readonly sandboxPolicy: "workspaceWrite";
}

export interface CodexAppServerOptions {
  readonly command?: string;
  readonly args?: readonly string[];
  readonly timeoutMs?: number;
  readonly controls?: boolean;
  readonly mediationEvidence?: MediationEvidence;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, key: string): string | undefined {
  return isRecord(value) && typeof value[key] === "string"
    ? value[key]
    : undefined;
}

function quoteShellArgument(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function expectedCommand(argv: readonly [string, ...string[]]): string {
  const script = argv.map(quoteShellArgument).join(" ");
  return `/bin/zsh -c ${quoteShellArgument(script)}`;
}

async function nearestExistingAncestor(candidate: string): Promise<string> {
  let current = candidate;
  for (;;) {
    try {
      await lstat(current);
      return current;
    } catch (error) {
      if (!isRecord(error) || error.code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

async function pathIsWithinRoot(root: string, candidate: string): Promise<boolean> {
  const absolute = path.resolve(root, candidate);
  const lexical = path.relative(root, absolute);
  if (lexical === ".." || lexical.startsWith(`..${path.sep}`) || path.isAbsolute(lexical))
    return false;
  const [canonicalRoot, existing] = await Promise.all([
    realpath(root),
    nearestExistingAncestor(absolute),
  ]);
  const canonicalExisting = await realpath(existing);
  const relative = path.relative(canonicalRoot, canonicalExisting);
  return !(
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  );
}

export class CodexAppServerWorker implements WorkerAdapter {
  private child?: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly runs = new Map<string, ActiveRun>();
  private readonly timeoutMs: number;
  private nextRequestId = 0;
  private initialized?: Promise<void>;
  private exited = false;
  private lines?: readline.Interface;

  constructor(private readonly options: CodexAppServerOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  private startProcess(): ChildProcessWithoutNullStreams {
    if (this.child) return this.child;
    const child = spawn(
      this.options.command ?? "codex",
      [...(this.options.args ?? ["app-server", "--stdio"])],
      { shell: false, stdio: ["pipe", "pipe", "pipe"] },
    );
    this.child = child;
    const lines = readline.createInterface({ input: child.stdout });
    this.lines = lines;
    lines.on("line", (line) => {
      this.receiveLine(line);
    });
    child.on("error", (error) => {
      this.failConnection(error);
    });
    child.on("exit", () => {
      this.failConnection(new Error("Codex app-server exited"));
    });
    return child;
  }

  async capabilities(): Promise<WorkerCapabilities> {
    await this.initialize();
    return {
      observe: true,
      steer: this.options.controls ?? true,
      interrupt: this.options.controls ?? true,
      commandMediation: this.options.mediationEvidence !== undefined,
      writableRoot: "requested-root",
    };
  }

  async start(task: WorkerTask): Promise<WorkerStartResult> {
    try {
      await this.initialize();
    } catch (error) {
      return { kind: "not-started", reason: String(error) };
    }
    let sent = false;
    try {
      sent = true;
      const thread = await this.request("thread/start", {
        cwd: task.repositoryRoot,
        ephemeral: true,
        approvalPolicy: "untrusted",
        approvalsReviewer: "user",
        sandbox: "workspace-write",
      });
      const threadId = stringField(isRecord(thread) ? thread.thread : undefined, "id");
      if (!threadId) throw new Error("Invalid thread/start response");
      const turn = await this.request("turn/start", {
        threadId,
        input: [{ type: "text", text: task.prompt }],
        cwd: task.repositoryRoot,
        approvalPolicy: "untrusted",
        approvalsReviewer: "user",
        sandboxPolicy: {
          type: "workspaceWrite",
          writableRoots: [task.grant.writableRoot],
          networkAccess: false,
        },
      });
      const turnId = stringField(isRecord(turn) ? turn.turn : undefined, "id");
      if (!turnId) throw new Error("Invalid turn/start response");
      const id = `${threadId}:${turnId}`;
      this.runs.set(id, {
        task,
        threadId,
        turnId,
        observations: [],
        commandByItem: new Map(),
        filePathsByItem: new Map(),
        waiters: new Set(),
        state: { kind: "running" },
      });
      return { kind: "started", ref: { id } };
    } catch (error) {
      return sent
        ? { kind: "indeterminate", reason: String(error) }
        : { kind: "not-started", reason: String(error) };
    }
  }

  async *observe(ref: ExternalRunRef): AsyncIterable<WorkerObservation> {
    const run = this.runs.get(ref.id);
    if (!run) return;
    let index = 0;
    while (run.state.kind === "running" || index < run.observations.length) {
      while (index < run.observations.length) {
        const observation = run.observations[index];
        index += 1;
        if (observation) yield observation;
      }
      if (run.state.kind === "running")
        await new Promise<void>((resolve) => run.waiters.add(resolve));
    }
  }

  async steer(ref: ExternalRunRef, instruction: string): Promise<void> {
    if (!(await this.capabilities()).steer)
      throw new UnsupportedWorkerOperation("steer");
    const run = this.runs.get(ref.id);
    if (!run) throw new Error("Unknown external run");
    await this.request("turn/steer", {
      threadId: run.threadId,
      turnId: run.turnId,
      input: [{ type: "text", text: instruction }],
    });
  }

  async interrupt(ref: ExternalRunRef): Promise<void> {
    if (!(await this.capabilities()).interrupt)
      throw new UnsupportedWorkerOperation("interrupt");
    const run = this.runs.get(ref.id);
    if (!run) throw new Error("Unknown external run");
    await this.request("turn/interrupt", {
      threadId: run.threadId,
      turnId: run.turnId,
    });
  }

  inspect(ref: ExternalRunRef): Promise<ObservedRunState> {
    return Promise.resolve(this.runs.get(ref.id)?.state ?? { kind: "unknown" });
  }

  close(): void {
    if (this.exited) return;
    this.lines?.close();
    this.child?.kill("SIGTERM");
    this.failConnection(new Error("Codex app-server closed"));
  }

  private initialize(): Promise<void> {
    this.initialized ??= this.request("initialize", {
      clientInfo: { name: "piarre", version: "0.0.1" },
      capabilities: { experimentalApi: true },
    }).then(() => {
      this.send({ method: "initialized", params: {} });
    });
    return this.initialized;
  }

  private request(method: string, params: JsonRecord): Promise<unknown> {
    if (this.exited) return Promise.reject(new Error("Codex app-server is unavailable"));
    const id = ++this.nextRequestId;
    this.send({ id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, this.timeoutMs);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  private send(message: JsonRecord): void {
    this.startProcess().stdin.write(`${JSON.stringify(message)}\n`);
  }

  private receiveLine(line: string): void {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      this.failConnection(new Error("Invalid JSON from Codex app-server"));
      return;
    }
    if (!isRecord(message)) return;
    if (typeof message.id === "number" && ("result" in message || "error" in message)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if ("error" in message && message.error)
        pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
      return;
    }
    if (typeof message.id === "number" && typeof message.method === "string") {
      const id = message.id;
      const method = message.method;
      const params = message.params;
      queueMicrotask(() => {
        void this.answerServerRequest(id, method, params).catch(
          () => {
            this.send({ id, result: { decision: "decline" } });
          },
        );
      });
      return;
    }
    if (typeof message.method === "string") {
      const method = message.method;
      const params = message.params;
      queueMicrotask(() => {
        this.receiveNotification(method, params);
      });
    }
  }

  private async answerServerRequest(
    id: number,
    method: string,
    params: unknown,
  ): Promise<void> {
    const itemId = stringField(params, "itemId");
    const threadId = stringField(params, "threadId");
    const turnId = stringField(params, "turnId");
    const run = [...this.runs.values()].find(
      (candidate) => candidate.threadId === threadId && candidate.turnId === turnId,
    );
    if (method === "item/commandExecution/requestApproval") {
      const command = itemId ? run?.commandByItem.get(itemId) : undefined;
      const approved =
        command !== undefined &&
        run?.task.grant.commands.some(({ argv }) => expectedCommand(argv) === command);
      this.send({ id, result: { decision: approved ? "accept" : "decline" } });
      return;
    }
    if (method === "item/fileChange/requestApproval") {
      const paths = itemId ? run?.filePathsByItem.get(itemId) : undefined;
      let approved = paths !== undefined && paths.length > 0 && run !== undefined;
      if (approved && run)
        for (const candidate of paths ?? [])
          if (!(await pathIsWithinRoot(run.task.grant.writableRoot, candidate))) {
            approved = false;
            break;
          }
      this.send({ id, result: { decision: approved ? "accept" : "decline" } });
      return;
    }
    if (method === "item/permissions/requestApproval") {
      this.send({ id, result: { decision: "decline" } });
      return;
    }
    this.send({ id, error: { code: -32601, message: "Unsupported request" } });
  }

  private receiveNotification(method: string, params: unknown): void {
    const threadId = stringField(params, "threadId");
    const turnId = stringField(params, "turnId");
    const run = [...this.runs.values()].find(
      (candidate) => candidate.threadId === threadId && candidate.turnId === turnId,
    );
    if (!run) return;
    if (method === "item/started" && isRecord(params) && isRecord(params.item)) {
      const itemId = stringField(params.item, "id");
      const type = stringField(params.item, "type");
      const command = stringField(params.item, "command");
      if (itemId && type === "commandExecution" && command)
        run.commandByItem.set(itemId, command);
      if (itemId && type === "fileChange" && Array.isArray(params.item.changes)) {
        const paths = params.item.changes.map((change) =>
          stringField(change, "path"),
        );
        if (paths.every((candidate) => candidate !== undefined))
          run.filePathsByItem.set(itemId, paths);
      }
      return;
    }
    if (method === "item/agentMessage/delta") {
      const text = stringField(params, "delta");
      if (text) this.pushObservation(run, { kind: "message", text });
      return;
    }
    if (method === "turn/completed") {
      run.state = { kind: "completed" };
      this.pushObservation(run, { kind: "completed" });
      return;
    }
    if (method === "turn/failed" || method === "error") {
      run.state = { kind: "unknown" };
      this.wake(run);
    }
  }

  private pushObservation(run: ActiveRun, observation: WorkerObservation): void {
    run.observations.push(observation);
    this.wake(run);
  }

  private wake(run: ActiveRun): void {
    for (const resolve of run.waiters) resolve();
    run.waiters.clear();
  }

  private failConnection(error: Error): void {
    if (this.exited) return;
    this.exited = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    for (const run of this.runs.values()) {
      if (run.state.kind === "running") run.state = { kind: "unknown" };
      this.wake(run);
    }
  }
}
