import { localReplyMatchesRequest } from "../../../packages/core/src/conversation.js";
import { request } from "node:http";
import type { ConversationTransport } from "./conversation-transport.js";

export const localDiscussionDefaults = {
  endpoint: "http://model-runner.docker.internal/engines/v1",
  model: "docker.io/ai/qwen3.5:4b-q6_K",
  digest: "ea484046efba5fc126b1b331c2d590a20cb7d3abdfc65366a7f8b547350cd629",
} as const;
export const localPromptByteLimit = 6_000;
const responseByteLimit = 65_536;

export interface LocalDiscussionConfiguration { readonly endpoint: string; readonly model: string; readonly digest: string }

export function parseLocalDiscussionConfiguration(value: LocalDiscussionConfiguration): LocalDiscussionConfiguration {
  const endpoint = new URL(value.endpoint);
  const loopback = /^127(?:\.(?:0|[1-9][0-9]{0,2})){3}$/.test(endpoint.hostname) && endpoint.hostname.split(".").every(part => Number(part) <= 255) || endpoint.hostname === "[::1]";
  const internal = value.endpoint === localDiscussionDefaults.endpoint;
  if (endpoint.protocol !== "http:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      (!internal && (!loopback || endpoint.pathname !== "/engines/v1")) || value.endpoint !== endpoint.href.replace(/\/$/, "")) throw new Error("Local discussion requires the Docker internal endpoint or a literal loopback HTTP endpoint ending in /engines/v1.");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/:-]{0,255}$/.test(value.model) || !/^[a-f0-9]{64}$/.test(value.digest)) throw new Error("Configure a local model tag and its 64-character SHA-256 digest in machine settings.");
  return { endpoint: value.endpoint, model: value.model, digest: value.digest };
}

function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

export class DockerModelRunnerConversationClient implements ConversationTransport {
  readonly kind = "docker-model-runner";
  private readonly configuration: LocalDiscussionConfiguration;
  private pending?: AbortController;
  private unavailable = false;

  constructor(configuration: LocalDiscussionConfiguration = localDiscussionDefaults, private readonly timeoutMs = 60_000) {
    this.configuration = parseLocalDiscussionConfiguration(configuration);
  }

  origin(model: string | undefined): ReturnType<ConversationTransport["origin"]> {
    if (model !== this.configuration.model) throw new Error("Select the configured local discussion model.");
    return { kind: this.kind, endpoint: this.configuration.endpoint, requestedModel: model, configuredDigest: this.configuration.digest };
  }

  models() { return Promise.resolve([{ model: this.configuration.model }]); }

  async connect(): Promise<{ readonly kind: "ready" }> {
    const catalog = await this.exchange("/models");
    if (!object(catalog) || !Array.isArray(catalog.data)) throw new Error("Invalid local model catalog.");
    this.unavailable = false;
    return { kind: "ready" };
  }

  async respond(input: Parameters<ConversationTransport["respond"]>[0]): ReturnType<ConversationTransport["respond"]> {
    if (this.unavailable || this.pending) throw new Error("Reconnect explicitly before another local request.");
    this.origin(input.model);
    if (Buffer.byteLength(input.prompt, "utf8") > localPromptByteLimit) throw new Error("Local discussion allows 6,000 UTF-8 bytes for the complete prompt. Choose fewer sources or start a shorter session.");
    const payload = JSON.stringify({ model: input.model, messages: [{ role: "user", content: input.prompt }], stream: false, temperature: 0,
      max_tokens: 1024, chat_template_kwargs: { enable_thinking: false },
      response_format: { type: "json_schema", json_schema: { name: "sourced_discussion", strict: true, schema: {
        type: "object", properties: { summary: { type: "string", minLength: 1 }, sourceIndexes: { type: "array", items: { type: "integer", minimum: 0 }, minItems: 1 } },
        required: ["summary", "sourceIndexes"], additionalProperties: false,
      } } } });
    if (Buffer.byteLength(payload) > 32_768) throw new Error("Local request envelope is too large.");
    const envelope = await this.exchange("/chat/completions", payload, input.beforeSend);
    if (!object(envelope) || typeof envelope.model !== "string" || !Array.isArray(envelope.choices) || envelope.choices.length !== 1) throw new Error("Invalid local response envelope.");
    const observedModel = envelope.model;
    const origin = this.origin(input.model);
    if (origin.kind !== "docker-model-runner" || !localReplyMatchesRequest(origin, observedModel)) throw new Error("Local response model does not match the configured tag or digest locator.");
    const choice: unknown = envelope.choices[0];
    if (!object(choice) || choice.finish_reason !== "stop" || !object(choice.message) || choice.message.role !== "assistant" ||
        typeof choice.message.content !== "string" || choice.message.tool_calls !== undefined || choice.message.function_call !== undefined ||
        (choice.message.reasoning_content !== undefined && choice.message.reasoning_content !== "" && choice.message.reasoning_content !== null)) throw new Error("Local reply was truncated, used tools, or returned unsupported reasoning.");
    if (envelope.id !== undefined && (typeof envelope.id !== "string" || !envelope.id.trim())) throw new Error("Invalid local response identity.");
    const output: unknown = JSON.parse(choice.message.content);
    return { status: "completed", output, origin: { kind: this.kind, observedModel, responseId: typeof envelope.id === "string" ? envelope.id : null } };
  }

  private async exchange(suffix: string, payload?: string, beforeSend: () => void = () => {}): Promise<unknown> {
    if (this.pending) throw new Error("Only one local request may be in flight.");
    const abort = new AbortController();
    this.pending = abort;
    const timeout = setTimeout(() => { abort.abort(); }, this.timeoutMs);
    try {
      return await new Promise<unknown>((resolve, reject) => {
        // node:http connects directly. Environment proxy variables never receive source bytes.
        beforeSend();
        const outbound = request(new URL(`${this.configuration.endpoint}${suffix}`), { method: payload === undefined ? "GET" : "POST", signal: abort.signal,
          agent: false, headers: payload === undefined ? {} : { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } }, response => {
          if (response.statusCode !== 200 || !(response.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
            response.destroy(); reject(new Error("Local runtime returned an unsupported status or media type. No redirect or fallback was followed.")); return;
          }
          const chunks: Buffer[] = []; let bytes = 0;
          response.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > responseByteLimit) { response.destroy(new Error("Local response exceeded 65,536 bytes.")); } else chunks.push(chunk); });
          response.on("error", reject);
          response.on("end", () => { try { const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8")); resolve(parsed); } catch (error) { reject(error instanceof Error ? error : new Error("Invalid local response.")); } });
        });
        outbound.on("error", reject);
        try { outbound.end(payload); } catch (error) { outbound.destroy(); reject(error instanceof Error ? error : new Error("Invalid local response.")); }
      });
    } catch (error) { this.unavailable = true; throw error; }
    finally { clearTimeout(timeout); if (this.pending === abort) this.pending = undefined; }
  }

  interrupt(): Promise<{ readonly kind: "unconfirmed" }> { this.unavailable = true; this.pending?.abort(); return Promise.resolve({ kind: "unconfirmed" }); }
  dispose(): void { this.unavailable = true; this.pending?.abort(); }
}
