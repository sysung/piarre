import type { ConversationReplyOrigin, ConversationRequestOrigin } from "../../../packages/core/src/conversation.js";
import { CodexConversationClient } from "./codex-conversation-client.js";

export type DiscussionRoute = "codex" | "docker-model-runner";
export interface ConversationTransport {
  readonly kind: DiscussionRoute;
  connect(): Promise<{ readonly kind: "ready" | "login-required" }>;
  models(): Promise<readonly { readonly model: string }[]>;
  origin(model: string | undefined): ConversationRequestOrigin;
  respond(input: { readonly prompt: string; readonly cwd: string; readonly model?: string; readonly beforeSend: () => void }): Promise<
    | { readonly status: "completed"; readonly output: unknown; readonly origin: ConversationReplyOrigin }
    | { readonly status: "interrupted"; readonly origin: Extract<ConversationReplyOrigin, { kind: "codex" }> }>;
  interrupt(): Promise<{ readonly kind: "confirmed" | "unconfirmed" }>;
  dispose(): void;
}

type CodexClient = Pick<CodexConversationClient, "connect" | "respond" | "interrupt" | "dispose"> & Partial<Pick<CodexConversationClient, "readExecutionContext">>;

export function codexDiscussionTransport(client: CodexClient = new CodexConversationClient()): ConversationTransport {
  return {
    kind: "codex",
    connect: () => client.connect(),
    models: async () => (await client.readExecutionContext?.())?.modelProfiles ?? [],
    origin: model => ({ kind: "codex", requestedModel: model ?? null }),
    respond: async ({ beforeSend, ...input }) => {
      beforeSend();
      const result = await client.respond({ ...input, onThreadStarted: beforeSend });
      const origin = { kind: "codex" as const, threadId: result.threadId, turnId: result.turnId };
      return result.status === "interrupted" ? { status: "interrupted", origin } : { status: "completed", output: result.output, origin };
    },
    interrupt: async () => { await client.interrupt(); return { kind: "confirmed" }; },
    dispose: () => { client.dispose(); },
  };
}
