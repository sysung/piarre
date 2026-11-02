import type { ProjectSnapshot } from "./index.js";
import type { SubmittedStatement } from "./context.js";
import { resolveRecordReference, type RecordReference } from "./inspection.js";

export interface ConversationSource {
  readonly reference: RecordReference;
  readonly text: string;
}

interface ConversationContext {
  readonly submitted: SubmittedStatement;
  readonly sources: readonly ConversationSource[];
  readonly recordedAtRevision: number;
}

export type ConversationTurn = ConversationContext & (
  | { readonly kind: "pending" }
  | { readonly kind: "answered"; readonly text: string; readonly citations: readonly RecordReference[];
      readonly providerThreadId: string; readonly providerTurnId: string }
  | { readonly kind: "interrupted" | "failed" | "unknown"; readonly reason: string }
);

export type ConversationAction =
  | { readonly kind: "begin-conversation"; readonly submitted: SubmittedStatement; readonly sources: readonly ConversationSource[] }
  | { readonly kind: "record-conversation-reply"; readonly requestId: string; readonly text: string;
      readonly citations: readonly RecordReference[]; readonly providerThreadId: string; readonly providerTurnId: string }
  | { readonly kind: "end-conversation"; readonly requestId: string; readonly outcome: "interrupted" | "failed" | "unknown"; readonly reason: string };

export type ConversationEvent =
  | { readonly kind: "conversation-started"; readonly submitted: SubmittedStatement; readonly sources: readonly ConversationSource[] }
  | { readonly kind: "conversation-replied"; readonly requestId: string; readonly text: string;
      readonly citations: readonly RecordReference[]; readonly providerThreadId: string; readonly providerTurnId: string }
  | { readonly kind: "conversation-ended"; readonly requestId: string; readonly outcome: "interrupted" | "failed" | "unknown"; readonly reason: string };

function sameSource(left: RecordReference, right: RecordReference): boolean {
  return left.projectId === right.projectId && left.kind === right.kind && left.recordId === right.recordId && left.revision === right.revision;
}

export function applyConversationEvent(snapshot: ProjectSnapshot, event: ConversationEvent): ProjectSnapshot {
  const revision = snapshot.revision + 1;
  if (event.kind === "conversation-started") {
    if (event.submitted.projectId !== snapshot.projectId || event.submitted.contextRevision !== snapshot.revision ||
        snapshot.conversation.some((turn) => turn.submitted.requestId === event.submitted.requestId || turn.kind === "pending")) {
      throw new Error("Invalid conversation start or context revision");
    }
    for (const source of event.sources) {
      const resolved = resolveRecordReference(snapshot, source.reference);
      if (resolved.kind !== "resolved" || resolved.text !== source.text) throw new Error("Invalid conversation source");
    }
    return { ...snapshot, revision, conversation: [...snapshot.conversation,
      { kind: "pending", submitted: event.submitted, sources: event.sources, recordedAtRevision: revision }] };
  }
  const turn = snapshot.conversation.find((item) => item.submitted.requestId === event.requestId);
  if (!turn || turn.kind !== "pending") throw new Error("Conversation turn is no longer pending");
  let next: ConversationTurn;
  if (event.kind === "conversation-replied") {
    if (event.citations.some((reference) => !turn.sources.some((source) => sameSource(source.reference, reference)))) {
      throw new Error("Conversation reply cites an unavailable source");
    }
    next = { ...turn, kind: "answered", text: event.text, citations: event.citations,
      providerThreadId: event.providerThreadId, providerTurnId: event.providerTurnId };
  } else {
    next = { ...turn, kind: event.outcome, reason: event.reason };
  }
  return { ...snapshot, revision, conversation: snapshot.conversation.map((item) => item === turn ? next : item) };
}

export function conversationEvent(action: ConversationAction): ConversationEvent {
  switch (action.kind) {
    case "begin-conversation": return { kind: "conversation-started", submitted: action.submitted, sources: action.sources };
    case "record-conversation-reply": return { kind: "conversation-replied", requestId: action.requestId, text: action.text,
      citations: action.citations, providerThreadId: action.providerThreadId, providerTurnId: action.providerTurnId };
    case "end-conversation": return { kind: "conversation-ended", requestId: action.requestId, outcome: action.outcome, reason: action.reason };
  }
}
