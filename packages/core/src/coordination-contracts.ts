import { parseSuppliedSources } from "./supplied-source.js";
import type { CoordinationAction, CoordinationEvent, WorkerSession, WorkerSpec } from "./coordination.js";

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid coordination object");
  return Object.fromEntries(Object.entries(value));
}
function fields(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) throw new Error("Invalid coordination fields");
}
function text(value: unknown, max = 10_000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Invalid coordination text");
  return value;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new Error("Invalid coordination limit");
  return value;
}
const sources = parseSuppliedSources;

function workers(value: unknown): readonly WorkerSpec[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) throw new Error("Bound fanout to 1–3 read-only assignments");
  const result = value.map((entry: unknown): WorkerSpec => {
    const worker = object(entry); fields(worker, ["assignmentId", "role", "purpose", "scope", "requestedModel", "provider", "serviceTierForTurn", "permissions"]);
    if (worker.provider !== "codex-read-only" || worker.serviceTierForTurn !== "default" || worker.permissions !== "supplied-sources-only") throw new Error("Unsupported provider, service tier or authority profile");
    if (worker.role !== "investigation" && worker.role !== "review") throw new Error("Only read-only investigation and review are supported");
    return { assignmentId: text(worker.assignmentId, 512), role: worker.role, purpose: text(worker.purpose), scope: text(worker.scope), requestedModel: text(worker.requestedModel, 128), provider: worker.provider, serviceTierForTurn: worker.serviceTierForTurn, permissions: worker.permissions };
  });
  if (new Set(result.map(worker => worker.assignmentId)).size !== result.length) throw new Error("Duplicate assignment identity");
  return result;
}
function session(value: unknown): WorkerSession {
  const entry = object(value);
  if (entry.kind === "thread") { fields(entry, ["kind", "threadId"]); return { kind: "thread", threadId: text(entry.threadId, 512) }; }
  if (entry.kind === "turn") { fields(entry, ["kind", "threadId", "turnId"]); return { kind: "turn", threadId: text(entry.threadId, 512), turnId: text(entry.turnId, 512) }; }
  throw new Error("An observed thread or turn is required");
}
export function parseCoordinationAction(value: unknown): CoordinationAction | undefined {
  if (typeof value !== "object" || value === null || !("kind" in value) || value.kind !== "coordinate") return undefined;
  const action = object(value);
  const base = ["kind", "operation"];
  if (action.operation === "capture-idea") {
    fields(action, [...base, "ideaId", "parentTaskId", "text", "returnPoint"]);
    return { kind: "coordinate", operation: action.operation, ideaId: text(action.ideaId, 512), parentTaskId: text(action.parentTaskId, 2048), text: text(action.text), returnPoint: text(action.returnPoint) };
  }
  if (action.operation === "return-idea") {
    fields(action, [...base, "ideaId", "observedAt"]);
    return { kind: "coordinate", operation: action.operation, ideaId: text(action.ideaId, 512), observedAt: integer(action.observedAt, 1, Number.MAX_SAFE_INTEGER) };
  }
  const groupId = text(action.groupId, 512);
  if (action.operation === "prepare") {
    fields(action, [...base, "groupId", "requestId", "parentTaskId", "ideaId", "sources", "workers", "durationMs", "maxTokens"]);
    return { kind: "coordinate", operation: action.operation, groupId, ideaId: action.ideaId === null ? null : text(action.ideaId, 512), requestId: text(action.requestId, 512), parentTaskId: text(action.parentTaskId, 2048), sources: sources(action.sources), workers: workers(action.workers), durationMs: integer(action.durationMs, 1_000, 120_000), maxTokens: integer(action.maxTokens, 1, 100_000) };
  }
  const observedAt = integer(action.observedAt, 1, Number.MAX_SAFE_INTEGER);
  if (action.operation === "approve") {
    fields(action, [...base, "groupId", "preparedAtRevision", "approvalId", "observedAt", "consent"]);
    if (action.consent !== "unknown-cost-and-shared-context") throw new Error("Explicit unknown-cost and data sharing approval required");
    return { kind: "coordinate", operation: action.operation, groupId, preparedAtRevision: integer(action.preparedAtRevision, 1, Number.MAX_SAFE_INTEGER), approvalId: text(action.approvalId, 512), observedAt, consent: action.consent };
  }
  if (action.operation === "compare") {
    fields(action, [...base, "groupId", "verdict", "explanation", "assignmentIds", "observedAt"]);
    if (action.verdict !== "agreement" && action.verdict !== "disagreement" && action.verdict !== "mixed") throw new Error("Invalid comparison verdict");
    if (!Array.isArray(action.assignmentIds) || action.assignmentIds.length > 3) throw new Error("Invalid comparison findings");
    return { kind: "coordinate", operation: action.operation, groupId, verdict: action.verdict, explanation: text(action.explanation), assignmentIds: action.assignmentIds.map((id: unknown) => text(id, 512)), observedAt };
  }
  const assignmentId = text(action.assignmentId, 512);
  if (action.operation === "steer") {
    fields(action, [...base, "groupId", "assignmentId", "messageId", "text", "observedAt"]);
    return { kind: "coordinate", operation: action.operation, groupId, assignmentId, messageId: text(action.messageId, 512), text: text(action.text), observedAt };
  }
  if (action.operation === "start" || action.operation === "stop" || action.operation === "review-unknown") {
    fields(action, [...base, "groupId", "assignmentId", "observedAt"]);
    return { kind: "coordinate", operation: action.operation, groupId, assignmentId, observedAt };
  }
  if (action.operation === "provider") {
    fields(action, [...base, "groupId", "assignmentId", "model", "provider", "serviceTier", "observedAt"]);
    const nullable = (value: unknown): string | null => value === null ? null : text(value, 128);
    return { kind: "coordinate", operation: action.operation, groupId, assignmentId, model: nullable(action.model), provider: nullable(action.provider), serviceTier: nullable(action.serviceTier), observedAt };
  }
  if (action.operation === "session") {
    fields(action, [...base, "groupId", "assignmentId", "session", "observedAt"]);
    return { kind: "coordinate", operation: action.operation, groupId, assignmentId, session: session(action.session), observedAt };
  }
  if (action.operation === "finish") {
    fields(action, [...base, "groupId", "assignmentId", "outcome", "observation", "sourceIndexes", "observedAt"]);
    if (action.outcome !== "completed" && action.outcome !== "interrupted" && action.outcome !== "failed" && action.outcome !== "unknown") throw new Error("Invalid worker outcome");
    if (!Array.isArray(action.sourceIndexes) || action.sourceIndexes.length > 10) throw new Error("Invalid findings citations");
    return { kind: "coordinate", operation: action.operation, groupId, assignmentId, outcome: action.outcome, observation: text(action.observation), sourceIndexes: action.sourceIndexes.map((index: unknown) => integer(index, 0, 9)), observedAt };
  }
  throw new Error("Unsupported coordination operation");
}
export function parseCoordinationEvent(value: unknown): CoordinationEvent | undefined {
  if (typeof value !== "object" || value === null || !("kind" in value) || value.kind !== "coordination-recorded") return undefined;
  const event = object(value); fields(event, ["kind", "commandId", "action"]);
  const action = parseCoordinationAction(event.action);
  if (!action) throw new Error("Invalid coordination event");
  return { kind: "coordination-recorded", commandId: text(event.commandId, 512), action };
}
