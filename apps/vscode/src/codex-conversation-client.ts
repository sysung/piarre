import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { isAbsolute } from "node:path";
import { parseDefaultModel, parseObservedUsage, parseAccountFacts, parseModelProfiles, parseThreadMetadata, type CodexExecutionContext, type CodexDefaultModel, type CodexObservedUsage, type CodexThreadMetadata } from "./codex-account-context";

const MAX_FRAME_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const TURN_TIMEOUT_MS = 120_000;
const STARTUP_ARGS = ["app-server", "-c", "features.shell_tool=false", "-c", "features.unified_exec=false", "-c", "features.plugins=false", "-c", 'web_search="disabled"', "-c", "mcp_servers={}"];
const OUTPUT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", "sourceIndexes"],
  properties: { summary: { type: "string", minLength: 1 }, sourceIndexes: { type: "array", minItems: 1, items: { type: "integer", minimum: 0 } } },
};

const PATCH_SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", "operations"],
  properties: { summary: { type: "string", minLength: 1, maxLength: 10_000 }, operations: { type: "array", maxItems: 20,
    items: { type: "object", additionalProperties: false, required: ["fileId", "content"],
      properties: { fileId: { type: "string", minLength: 1, maxLength: 128 }, content: { anyOf: [{ type: "string", maxLength: 100_000 }, { type: "null" }] } } } } },
};
type TerminalObservation = { readonly threadId: string; readonly turnId: string; readonly status: "completed" | "interrupted" | "failed" };
type TurnInput = { readonly prompt: string; readonly cwd: string; readonly model?: string; readonly serviceTierForTurn?: "default"; readonly effort?: string; readonly onBeforeTurnStart?: (context: CodexExecutionContext) => void; readonly onProgress?: (text: string) => void; readonly onThreadStarted?: (threadId: string) => void; readonly onThreadMetadata?: (metadata: CodexThreadMetadata) => void; readonly onTurnTerminal?: (observation: TerminalObservation) => void; readonly onTurnStarted?: (threadId: string, turnId: string) => void };

type ConnectResult = { kind: "ready"; authType: "chatgpt" | "apiKey" | "unknown" } | { kind: "login-required" };
type Response = { output: unknown; threadId: string; turnId: string; status: "completed" | "interrupted" };
type Pending = { resolve(value: unknown): void; reject(error: Error): void; timer: NodeJS.Timeout };
type ActiveTurn = {
  threadId: string; turnId?: string; text?: string;
  buffered: { method: string; params: Record<string, unknown> }[];
  resolve(value: Response): void; reject(error: Error): void;
  onTurnTerminal?: (observation: TerminalObservation) => void; timer: NodeJS.Timeout; onProgress?: (text: string) => void;
};

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Malformed Codex protocol object.");
  return value as Record<string, unknown>;
}
function identifier(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) throw new Error("Malformed Codex identifier.");
  return value;
}

/** A single read-only conversation connection. Provider threads never authorize Piarre work. */
export class CodexConversationClient {
  private process?: ChildProcessWithoutNullStreams;
  private state: "disconnected" | "connecting" | "ready" | "busy" | "disposed" = "disconnected";
  private sequence = 0;
  private buffer = "";
  private readonly pending = new Map<number, Pending>();
  private active?: ActiveTurn;

  constructor(private readonly options: { command?: string; args?: readonly string[] } = {}) {}

  async connect(): Promise<ConnectResult> {
    if (this.state !== "disconnected") throw new Error("Codex connection is already active or disposed.");
    this.state = "connecting";
    const child = spawn(this.options.command ?? "codex", [...(this.options.args ?? STARTUP_ARGS)], { shell: false, stdio: "pipe", env: Object.fromEntries(["PATH", "HOME", "USER", "TMPDIR", "CODEX_HOME", "SYSTEMROOT"].flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]])) });
    this.process = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { if (this.process === child) this.receive(chunk); });
    child.stderr.resume();
    child.stdin.on("error", () => { if (this.process === child) this.fail(new Error("Codex input disconnected.")); });
    child.on("error", () => { if (this.process === child) this.fail(new Error("Codex could not start.")); });
    child.on("close", () => { if (this.process === child) this.fail(new Error("Codex disconnected before completion.")); });
    try {
      await this.request("initialize", { clientInfo: { name: "piarre", version: "0.0.1" }, capabilities: { experimentalApi: false } });
      this.send({ method: "initialized", params: {} });
      const account = object(await this.request("account/read", { refreshToken: false }));
      if (typeof account.requiresOpenaiAuth !== "boolean") throw new Error("Malformed Codex account response.");
      if (account.account === null || account.account === undefined) {
        if (account.requiresOpenaiAuth) { this.dispose(); return { kind: "login-required" }; }
      }
      const type = account.account === null || account.account === undefined ? undefined : object(account.account).type;
      if (type !== undefined && typeof type !== "string") throw new Error("Malformed Codex account type.");
      await this.checkTools();
      this.state = "ready";
      return { kind: "ready", authType: type === "chatgpt" || type === "apiKey" ? type : "unknown" };
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  /** Explicit preflight only; connection and activation never query usage/model metadata. */
  async readExecutionContext(): Promise<CodexExecutionContext> { return this.readContext(false); }

  private async readContext(forTurn: boolean): Promise<CodexExecutionContext> {
    if (this.state !== "ready" && !(forTurn && this.state === "busy")) throw new Error("Connect Codex explicitly before reading execution context; no turn may be active.");
    this.state = "busy";
    let model: CodexDefaultModel = { kind: "unknown" };
    let usage: CodexObservedUsage;
    let facts: CodexExecutionContext["facts"];

    try {
      const account = object(await this.request("account/read", { refreshToken: false }));
      const accountType = account.account === null || account.account === undefined ? undefined : object(account.account).type;
      const authType = accountType === "chatgpt" || accountType === "apiKey" ? accountType : "unknown";
      const pages: unknown[] = [];
      let cursor: string | undefined;
      const seen = new Set<string>();
      try {
        for (let page = 0; page < 4; page++) {
          const result = object(await this.request("model/list", { limit: 100, includeHidden: false, ...(cursor === undefined ? {} : { cursor }) }));
          pages.push(result);
          if (result.nextCursor === null || result.nextCursor === undefined) { model = parseDefaultModel(pages, true); break; }
          if (typeof result.nextCursor !== "string" || !result.nextCursor || result.nextCursor.length > 512 || seen.has(result.nextCursor)) break;
          cursor = result.nextCursor;
          seen.add(cursor);
        }
      } catch { model = { kind: "unknown" }; }
      try { const observation = await this.request("account/rateLimits/read", {}); usage = parseObservedUsage(observation); facts = parseAccountFacts(observation, account.account); }
      catch { usage = { kind: "unknown" }; }
      return { observedAt: new Date().toISOString(), authType, model, modelProfiles: parseModelProfiles(pages), usage, ...(facts ? { facts } : {}) };
    } finally {
      if (this.process) this.state = forTurn ? "busy" : "ready";
    }
  }

  respond(input: TurnInput): Promise<Response> { return this.requestTurn(input, OUTPUT_SCHEMA); }

  proposePatch(input: TurnInput): Promise<Response> { return this.requestTurn(input, PATCH_SCHEMA); }

  private async requestTurn(input: TurnInput, outputSchema: typeof OUTPUT_SCHEMA | typeof PATCH_SCHEMA): Promise<Response> {
    if (this.state !== "ready") throw new Error("Connect Codex explicitly before starting one conversation turn.");
    if (!input.prompt.trim() || !isAbsolute(input.cwd)) throw new Error("A prompt and absolute working directory are required.");
    this.state = "busy";
    try {
      const started = object(await this.request("thread/start", {
        cwd: input.cwd, model: input.model, ephemeral: true, sandbox: "read-only", approvalPolicy: "never",
        config: { web_search: "disabled", features: { shell_tool: false, unified_exec: false, plugins: false } },
      }));
      const threadId = identifier(object(started.thread).id);
      input.onThreadMetadata?.(parseThreadMetadata(started));
      const sandbox = object(started.sandbox);
      if (sandbox.type !== "readOnly" || sandbox.networkAccess === true || started.approvalPolicy !== "never") throw new Error("Codex did not confirm read-only policy.");
      await this.checkTools(threadId);
      if (input.onBeforeTurnStart) input.onBeforeTurnStart(await this.readContext(true));
      input.onThreadStarted?.(threadId);
      const completion = new Promise<Response>((resolve, reject) => {
        this.active = { threadId, buffered: [], resolve, reject, onProgress: input.onProgress, onTurnTerminal: input.onTurnTerminal,
          timer: setTimeout(() => { this.fail(new Error("Codex turn timed out; completion is unknown.")); }, TURN_TIMEOUT_MS) };
      });
      // Attach rejection handling before turn/start, which can race terminal notifications.
      void completion.catch(() => undefined);
      const result = object(await this.request("turn/start", {
        threadId, cwd: input.cwd, model: input.model, ...(input.serviceTierForTurn ? { serviceTierForTurn: input.serviceTierForTurn } : {}), ...(input.effort ? { effort: input.effort } : {}), input: [{ type: "text", text: input.prompt }],
        sandboxPolicy: { type: "readOnly", networkAccess: false }, approvalPolicy: "never", outputSchema,
      }));
      const turn = object(result.turn);
      const active = this.active;
      if (!active) throw new Error("Codex disconnected while starting the turn.");
      active.turnId = identifier(turn.id);
      input.onTurnStarted?.(threadId, active.turnId);
      for (const event of active.buffered.splice(0)) this.notification(event.method, event.params);
      if (this.active && turn.status !== undefined && turn.status !== "inProgress") this.notification("turn/completed", { threadId, turn });
      return await completion;
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error("Codex turn failed."));
      throw error;
    } finally {
      if (this.process) this.state = "ready";
    }
  }

  async interrupt(): Promise<void> {
    const active = this.active;
    if (!active?.turnId) throw new Error("No acknowledged Codex turn to interrupt.");
    await this.request("turn/interrupt", { threadId: active.threadId, turnId: active.turnId });
  }

  dispose(): void {
    this.fail(new Error("Codex connection disposed; completion is unknown."));
    this.state = "disposed";
  }

  private async checkTools(threadId?: string): Promise<void> {
    const result = object(await this.request("mcpServerStatus/list", { threadId }));
    if (!Array.isArray(result.data) || result.data.length !== 0 || (result.nextCursor !== null && result.nextCursor !== undefined)) {
      throw new Error("External Codex tools are configured; conversation is blocked.");
    }
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.fail(new Error("Codex request timed out; completion is unknown.")); }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); } catch { this.fail(new Error("Codex input disconnected.")); }
    });
  }

  private send(value: unknown): void {
    if (!this.process || this.process.stdin.destroyed) throw new Error("Codex is disconnected.");
    this.process.stdin.write(`${JSON.stringify(value)}\n`);
  }

  private receive(chunk: string): void {
    if (!this.process) return;
    this.buffer += chunk;
    try {
      let newline: number;
      while ((newline = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, newline);
        this.buffer = this.buffer.slice(newline + 1);
        if (Buffer.byteLength(line) > MAX_FRAME_BYTES) throw new Error("Codex frame exceeds size limit.");
        this.frame(object(JSON.parse(line)));
      }
      if (Buffer.byteLength(this.buffer) > MAX_FRAME_BYTES) throw new Error("Codex frame exceeds size limit.");
    } catch { this.fail(new Error("Malformed or oversized Codex protocol frame.")); }
  }

  private frame(frame: Record<string, unknown>): void {
    if (typeof frame.method === "string") {
      if ("id" in frame) {
        if (typeof frame.id !== "string" && typeof frame.id !== "number") throw new Error("Malformed server request.");
        // A protocol error denies every server-initiated capability, including new methods.
        this.send({ id: frame.id, error: { code: -32601, message: "Piarre conversation denies all server tool and approval requests." } });
        return;
      }
      this.notification(frame.method, object(frame.params));
      return;
    }
    if (typeof frame.id !== "number") throw new Error("Malformed Codex response id.");
    const pending = this.pending.get(frame.id);
    if (!pending) throw new Error("Unexpected Codex response id.");
    this.pending.delete(frame.id);
    clearTimeout(pending.timer);
    if ("error" in frame) pending.reject(new Error("Codex rejected the request."));
    else if ("result" in frame) pending.resolve(frame.result);
    else { pending.reject(new Error("Malformed Codex response.")); throw new Error("Malformed response."); }
  }

  private notification(method: string, params: Record<string, unknown>): void {
    if (method === "mcpServerStatus/updated") { this.fail(new Error("Codex tool inventory changed; conversation is blocked.")); return; }
    const active = this.active;
    if (!active || !["turn/started", "turn/completed", "item/completed"].includes(method)) return;
    if (identifier(params.threadId) !== active.threadId) throw new Error("Unexpected Codex thread id.");
    if (!active.turnId) {
      if (active.buffered.length >= 256) throw new Error("Too many premature Codex notifications.");
      active.buffered.push({ method, params });
      return;
    }
    if (method === "item/completed") {
      if (identifier(params.turnId) !== active.turnId) throw new Error("Unexpected Codex turn id.");
      this.item(object(params.item), active);
      return;
    }
    const turn = object(params.turn);
    if (identifier(turn.id) !== active.turnId) throw new Error("Unexpected Codex turn id.");
    if (method !== "turn/completed") return;
    if (!Array.isArray(turn.items)) throw new Error("Malformed terminal Codex turn.");
    if (turn.status === "completed" || turn.status === "interrupted" || turn.status === "failed") active.onTurnTerminal?.({ threadId: active.threadId, turnId: active.turnId, status: turn.status });
    for (const item of turn.items) this.item(object(item), active);
    if (turn.status !== "completed" && turn.status !== "interrupted") {
      this.fail(new Error("Codex turn failed or was cancelled.")); return;
    }
    let output: unknown = null;
    if (turn.status === "completed") {
      if (!active.text) throw new Error("Codex completed without a final message.");
      try { output = JSON.parse(active.text); } catch { throw new Error("Codex final message is not valid JSON."); }
    }
    clearTimeout(active.timer);
    this.active = undefined;
    active.resolve({ output, threadId: active.threadId, turnId: active.turnId, status: turn.status });
  }

  private item(item: Record<string, unknown>, active: ActiveTurn): void {
    identifier(item.id);
    if (typeof item.type !== "string") throw new Error("Malformed Codex item.");
    if (item.type === "agentMessage" && (item.phase === "final_answer" || item.phase === null || item.phase === undefined)) {
      if (typeof item.text !== "string") throw new Error("Malformed Codex message.");
      if (active.text !== item.text) { active.text = item.text; active.onProgress?.(item.text); }
    } else if (!["reasoning", "userMessage", "agentMessage"].includes(item.type)) {
      throw new Error("Unexpected Codex tool activity; conversation is blocked.");
    }
  }

  private fail(error: Error): void {
    const child = this.process;
    this.process = undefined;
    this.state = this.state === "disposed" ? "disposed" : "disconnected";
    this.buffer = "";
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
    if (this.active) { clearTimeout(this.active.timer); this.active.reject(error); this.active = undefined; }
    child?.kill();
  }
}
