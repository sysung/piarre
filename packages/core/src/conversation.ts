import { parseSuppliedSources } from "./supplied-source.js";
import type { SuppliedReference } from "./supplied-source.js";
import type { ProjectSnapshot } from "./index.js";
import type { SubmittedStatement } from "./context.js";
import { resolveRecordReference } from "./inspection.js";

export interface ConversationSource {
  readonly reference: SuppliedReference;
  readonly text: string;
}

export const defaultSessionId = "project-chat";

export interface ConversationSession {
  readonly id: string;
  readonly title: string;
  readonly parent?: { readonly id: string; readonly throughRevision: number };
  readonly archived?: true;
}

export function conversationHistory(snapshot: ProjectSnapshot, sessionId: string): readonly ConversationTurn[] {
  const cutoffs = new Map<string, number>();
  let id = sessionId;
  let cutoff = snapshot.revision;
  while (!cutoffs.has(id)) {
    cutoffs.set(id, cutoff);
    const parent = snapshot.sessions.find(session => session.id === id)?.parent;
    if (!parent) break;
    cutoff = Math.min(cutoff, parent.throughRevision);
    id = parent.id;
  }
  return snapshot.conversation.filter(turn => (cutoffs.get(turn.sessionId ?? defaultSessionId) ?? 0) >= turn.recordedAtRevision);
}

export type SessionAction =
  | { readonly kind: "create-session"; readonly id: string; readonly title: string; readonly parentId?: string }
  | { readonly kind: "rename-session"; readonly id: string; readonly title: string }
  | { readonly kind: "archive-session"; readonly id: string };

export type ConversationRequestOrigin =
  | { readonly kind: "codex"; readonly requestedModel: string | null }
  | { readonly kind: "docker-model-runner"; readonly endpoint: string; readonly requestedModel: string; readonly configuredDigest: string };

export type ConversationReplyOrigin =
  | { readonly kind: "codex"; readonly threadId: string; readonly turnId: string }
  | { readonly kind: "docker-model-runner"; readonly observedModel: string; readonly responseId: string | null };

export function localReplyMatchesRequest(request: Extract<ConversationRequestOrigin, { kind: "docker-model-runner" }>, observedModel: string): boolean {
  const digestPath = `/bundles/sha256/${request.configuredDigest}/model/`;
  return observedModel === request.requestedModel || (observedModel.startsWith("/") && observedModel.includes(digestPath) && /^[^/]+\.gguf$/.test(observedModel.split(digestPath)[1] ?? ""));
}

export function conversationProviderLabel(turn: ConversationTurn): string {
  return turn.origin?.kind === "docker-model-runner" ? `Docker Model Runner · ${turn.origin.requestedModel}` : "Codex";
}

interface ConversationContext {
  readonly origin?: ConversationRequestOrigin;
  readonly sessionId?: string;
  readonly submitted: SubmittedStatement;
  readonly sources: readonly ConversationSource[];
  readonly recordedAtRevision: number;
}

export type ConversationTurn = ConversationContext & (
  | { readonly kind: "pending" }
  | ({ readonly kind: "answered"; readonly text: string; readonly citations: readonly SuppliedReference[] } &
      ({ readonly providerThreadId: string; readonly providerTurnId: string } | { readonly replyOrigin: ConversationReplyOrigin }))
  | { readonly kind: "interrupted" | "failed" | "unknown"; readonly reason: string }
);

export type ConversationAction =
  | SessionAction
  | { readonly kind: "begin-provider-conversation"; readonly submitted: SubmittedStatement; readonly sources: readonly ConversationSource[]; readonly sessionId?: string; readonly origin: ConversationRequestOrigin }
  | { readonly kind: "record-provider-conversation-reply"; readonly requestId: string; readonly text: string; readonly citations: readonly SuppliedReference[]; readonly origin: ConversationReplyOrigin }
  | { readonly kind: "begin-conversation"; readonly submitted: SubmittedStatement; readonly sources: readonly ConversationSource[]; readonly sessionId?: string }
  | { readonly kind: "record-conversation-reply"; readonly requestId: string; readonly text: string;
      readonly citations: readonly SuppliedReference[]; readonly providerThreadId: string; readonly providerTurnId: string }
  | { readonly kind: "end-conversation"; readonly requestId: string; readonly outcome: "interrupted" | "failed" | "unknown"; readonly reason: string };

export type ConversationEvent =
  | { readonly kind: "provider-conversation-started"; readonly submitted: SubmittedStatement; readonly sources: readonly ConversationSource[]; readonly sessionId?: string; readonly origin: ConversationRequestOrigin }
  | { readonly kind: "provider-conversation-replied"; readonly requestId: string; readonly text: string; readonly citations: readonly SuppliedReference[]; readonly origin: ConversationReplyOrigin }
  | { readonly kind: "session-recorded"; readonly action: SessionAction }
  | { readonly kind: "conversation-started"; readonly submitted: SubmittedStatement; readonly sources: readonly ConversationSource[]; readonly sessionId?: string }
  | { readonly kind: "conversation-replied"; readonly requestId: string; readonly text: string;
      readonly citations: readonly SuppliedReference[]; readonly providerThreadId: string; readonly providerTurnId: string }
  | { readonly kind: "conversation-ended"; readonly requestId: string; readonly outcome: "interrupted" | "failed" | "unknown"; readonly reason: string };

function sameSource(left: SuppliedReference, right: SuppliedReference): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function applyConversationEvent(snapshot: ProjectSnapshot, event: ConversationEvent): ProjectSnapshot {
  const revision = snapshot.revision + 1;
  if (event.kind === "session-recorded") {
    const action = event.action;
    const existing = snapshot.sessions.find(session => session.id === action.id);
    const pending = snapshot.conversation.find(turn => turn.kind === "pending");
    const pendingSession = pending && (pending.sessionId ?? defaultSessionId);
    if (action.kind === "create-session") {
      const parent = snapshot.sessions.find(session => session.id === action.parentId && !session.archived);
      if (existing || (action.parentId !== undefined && (!parent || pendingSession === parent.id))) throw new Error("Session cannot be created");
      return { ...snapshot, revision, sessions: [...snapshot.sessions, { id: action.id, title: action.title,
        ...(parent && { parent: { id: parent.id, throughRevision: snapshot.revision } }) }] };
    }
    if (!existing || existing.archived || (action.kind === "archive-session" && pendingSession === existing.id)) throw new Error("Session cannot be changed");
    return { ...snapshot, revision, sessions: snapshot.sessions.map(session => session === existing
      ? action.kind === "rename-session" ? { ...session, title: action.title } : { ...session, archived: true as const }
      : session) };
  }
  if (event.kind === "conversation-started" || event.kind === "provider-conversation-started") {
    if (!snapshot.sessions.some(session => session.id === (event.sessionId ?? defaultSessionId) && !session.archived)) throw new Error("Session is unavailable");
    if (event.submitted.projectId !== snapshot.projectId || event.submitted.contextRevision !== snapshot.revision ||
        snapshot.conversation.some((turn) => turn.submitted.requestId === event.submitted.requestId || turn.kind === "pending")) {
      throw new Error("Invalid conversation start or context revision");
    }
    const sources = parseSuppliedSources(event.sources);
    for (const source of sources) {
      if (source.reference.kind === "file") {
        if (source.reference.projectId !== snapshot.projectId || source.reference.revision > snapshot.revision) throw new Error("Invalid file context identity");
        continue;
      }
      const resolved = resolveRecordReference(snapshot, source.reference);
      if (resolved.kind !== "resolved" || resolved.text !== source.text) throw new Error("Invalid conversation source");
    }
    return { ...snapshot, revision, conversation: [...snapshot.conversation,
      { kind: "pending", submitted: event.submitted, sources, recordedAtRevision: revision, ...(event.kind === "provider-conversation-started" && { origin: event.origin }), ...(event.sessionId && { sessionId: event.sessionId }) }] };
  }
  const turn = snapshot.conversation.find((item) => item.submitted.requestId === event.requestId);
  if (!turn || turn.kind !== "pending") throw new Error("Conversation turn is no longer pending");
  let next: ConversationTurn;
  if (event.kind === "conversation-replied" || event.kind === "provider-conversation-replied") {
    if ((event.kind === "provider-conversation-replied" && (!turn.origin || turn.origin.kind !== event.origin.kind)) ||
        (event.kind === "conversation-replied" && turn.origin)) throw new Error("Conversation provider identity changed");
    if (event.kind === "provider-conversation-replied" && event.origin.kind === "docker-model-runner" && turn.origin?.kind === "docker-model-runner" && !localReplyMatchesRequest(turn.origin, event.origin.observedModel)) throw new Error("Local response model differs from the recorded request");
    if (event.citations.some((reference) => !turn.sources.some((source) => sameSource(source.reference, reference)))) {
      throw new Error("Conversation reply cites an unavailable source");
    }
    next = { ...turn, kind: "answered", text: event.text, citations: event.citations,
      ...(event.kind === "conversation-replied" ? { providerThreadId: event.providerThreadId, providerTurnId: event.providerTurnId } : { replyOrigin: event.origin }) };
  } else {
    next = { ...turn, kind: event.outcome, reason: event.reason };
  }
  return { ...snapshot, revision, conversation: snapshot.conversation.map((item) => item === turn ? next : item) };
}

export function conversationEvent(action: ConversationAction): ConversationEvent {
  switch (action.kind) {
    case "create-session":
    case "rename-session":
    case "archive-session": return { kind: "session-recorded", action };
    case "begin-provider-conversation": return { ...action, kind: "provider-conversation-started" };
    case "record-provider-conversation-reply": return { ...action, kind: "provider-conversation-replied" };
    case "begin-conversation": return { kind: "conversation-started", submitted: action.submitted, sources: action.sources, ...(action.sessionId && { sessionId: action.sessionId }) };
    case "record-conversation-reply": return { kind: "conversation-replied", requestId: action.requestId, text: action.text,
      citations: action.citations, providerThreadId: action.providerThreadId, providerTurnId: action.providerTurnId };
    case "end-conversation": return { kind: "conversation-ended", requestId: action.requestId, outcome: action.outcome, reason: action.reason };
  }
}
