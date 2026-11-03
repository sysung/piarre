import type { CodexExecutionContext, CodexUsageWindow } from "./provider-account-context.js";
import type { ExecutionAction, ExecutionEvent, ExecutionPlanDraft, CheckEvidence, ExecutionCheck, ExecutionCriterion, WorkspaceRequest } from "./execution.js";
import type { FileBaseline } from "./execution-patch.js";
import { validateFileManifest } from "./execution-patch.js";
import type { KnowledgeVersion } from "./context.js";

function invalid(): never { throw new Error("Invalid execution contract"); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function fields(value: unknown, names: readonly string[]): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).length !== names.length || !Object.keys(value).every(key => names.includes(key))) invalid(); return value;
}
function text(value: unknown, maximum = 10_000): string { if (typeof value !== "string" || !value.trim() || value.length > maximum) invalid(); return value; }
function integer(value: unknown, minimum = 1, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) invalid(); return value;
}
function epoch(value: unknown): number { return integer(value, 1, 8_639_999_999_880_000); }
function enumeration<T extends string>(value: unknown, values: readonly T[]): T { const found = values.find(item => item === value); if (found === undefined) invalid(); return found; }
function list<T>(value: unknown, parse: (item: unknown) => T, maximum = 100): readonly T[] { if (!Array.isArray(value) || value.length > maximum) invalid(); return value.map((item: unknown) => parse(item)); }
function unique(values: readonly string[]): readonly string[] { if (new Set(values).size !== values.length) invalid(); return values; }
function argv(value: unknown): readonly [string, ...string[]] { const values = list(value, item => text(item), 50); const first = values[0]; if (!first) invalid(); return [first, ...values.slice(1)]; }
function sha(value: unknown): string { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) invalid(); return value; }
function absolute(value: unknown): string {
  const path = text(value, 4096);
  if (!path.startsWith("/") || path.includes("\u0000") || path.includes("\\") || path.split("/").slice(1).some(part => !part || part === "." || part === "..")) invalid(); return path;
}
function baseline(value: unknown): FileBaseline {
  if (!isRecord(value)) invalid();
  if (value.kind === "absent") { const row = fields(value, ["kind", "fileId", "relativePath"]); return { kind: "absent", fileId: text(row.fileId, 128), relativePath: text(row.relativePath, 4096) }; }
  const row = fields(value, ["kind", "fileId", "relativePath", "sha256", "bytes"]);
  if (row.kind !== "existing") invalid();
  return { kind: "existing", fileId: text(row.fileId, 128), relativePath: text(row.relativePath, 4096), sha256: sha(row.sha256), bytes: integer(row.bytes, 0, 64_000) };
}
function version(value: unknown): KnowledgeVersion {
  const row = fields(value, ["projectId", "knowledgeId", "recordedAtRevision"]);
  return { projectId: text(row.projectId), knowledgeId: text(row.knowledgeId), recordedAtRevision: integer(row.recordedAtRevision) };
}
function criterion(value: unknown): ExecutionCriterion {
  const row = fields(value, ["criterionId", "text"]); return { criterionId: text(row.criterionId, 512), text: text(row.text) };
}
function check(value: unknown): ExecutionCheck {
  const row = fields(value, ["checkId", "argv", "criterionIds"]);
  return { checkId: text(row.checkId, 512), argv: argv(row.argv), criterionIds: unique(list(row.criterionIds, item => text(item, 512))) };
}
function accountContext(value: unknown): CodexExecutionContext {
  const row = fields(value, ["observedAt", "model", "usage", "taskForecast"]);
  const observedAt = text(row.observedAt, 40);
  if (!Number.isFinite(Date.parse(observedAt)) || new Date(observedAt).toISOString() !== observedAt) invalid();
  if (!isRecord(row.model)) invalid();
  const model = row.model.kind === "unknown" ? fields(row.model, ["kind"]) : fields(row.model, ["kind", "model"]);
  if (model.kind !== "unknown" && model.kind !== "resolved-default") invalid();
  if (!isRecord(row.usage)) invalid();
  const usage = row.usage.kind === "unknown" ? fields(row.usage, ["kind"]) : fields(row.usage, ["kind", "source", "windows"]);
  if (usage.kind !== "unknown" && (usage.kind !== "observed" || usage.source !== "account/rateLimits/read")) invalid();
  const windows = usage.kind === "observed" ? list(usage.windows, (item): CodexUsageWindow => {
    const window = fields(item, ["source", "usedPercent", "windowDurationMins", "resetsAt"]);
    return { source: enumeration(window.source, ["primary", "secondary"]), usedPercent: integer(window.usedPercent, 0, 100),
      windowDurationMins: window.windowDurationMins === null ? null : integer(window.windowDurationMins),
      resetsAt: window.resetsAt === null ? null : integer(window.resetsAt, 0, 8_640_000_000_000) };
  }, 2) : [];
  if (usage.kind === "observed" && windows.length === 0) invalid(); unique(windows.map(window => window.source));
  const forecast = fields(row.taskForecast, ["kind"]); if (forecast.kind !== "unknown") invalid();
  return { observedAt, model: model.kind === "unknown" ? { kind: "unknown" } : { kind: "resolved-default", model: text(model.model, 128) },
    usage: usage.kind === "unknown" ? { kind: "unknown" } : { kind: "observed", source: "account/rateLimits/read", windows }, taskForecast: { kind: "unknown" } };
}
function plan(value: unknown): ExecutionPlanDraft {
  const row = fields(value, ["taskId", "objective", "criteria", "knowledge", "files", "checks", "candidateRoot", "controlDirectory", "captureHash", "baselineCheckpoint", "sourceRoot", "provider", "accountContext", "durationMs", "maxTokens"]);
  const baselineCheckpoint = fields(row.baselineCheckpoint, ["checkpointId", "manifestHash"]);
  const provider = fields(row.provider, ["kind", "authType", "requestedModel"]);
  if (provider.kind !== "codex-readonly-patch") invalid();
  const files = list(row.files, baseline, 20); validateFileManifest(files);
  const criteria = list(row.criteria, criterion, 50); if (criteria.length === 0) invalid(); unique(criteria.map(item => item.criterionId));
  const checks = list(row.checks, check, 5); unique(checks.map(item => item.checkId));
  if (checks.some(item => item.criterionIds.length === 0 || item.criterionIds.some(id => !criteria.some(criterion => criterion.criterionId === id)))) invalid();
  const knowledge = list(row.knowledge, version, 100); unique(knowledge.map(item => item.knowledgeId));
  return { taskId: text(row.taskId), objective: text(row.objective), criteria, knowledge, files, checks,
    candidateRoot: absolute(row.candidateRoot), controlDirectory: absolute(row.controlDirectory), captureHash: sha(row.captureHash), baselineCheckpoint: { checkpointId: text(baselineCheckpoint.checkpointId), manifestHash: sha(baselineCheckpoint.manifestHash) }, sourceRoot: absolute(row.sourceRoot),
    provider: { kind: "codex-readonly-patch", authType: enumeration(provider.authType, ["chatgpt", "apiKey", "unknown"]), requestedModel: text(provider.requestedModel, 128) },
    accountContext: accountContext(row.accountContext),
    durationMs: integer(row.durationMs, 1000, 120_000), maxTokens: integer(row.maxTokens, 1, 1_000_000) };
}
function evidence(value: unknown): CheckEvidence {
  const row = fields(value, ["checkId", "nonce", "termination", "kind", "criterionIds", "argv", "exitCode", "signal", "stdout", "stderr", "manifestHash", "observedAt"]);
  if (typeof row.stdout !== "string" || typeof row.stderr !== "string" || row.stdout.length > 64_000 || row.stderr.length > 64_000) invalid();
  return { checkId: text(row.checkId), nonce: text(row.nonce), termination: enumeration(row.termination, ["observed", "not-started", "unconfirmed"]), kind: enumeration(row.kind, ["passed", "failed", "unknown", "not-tested"]),
    criterionIds: unique(list(row.criterionIds, item => text(item, 512))), argv: argv(row.argv),
    exitCode: row.exitCode === null ? null : integer(row.exitCode, -255, 255), signal: row.signal === null ? null : text(row.signal, 256),
    stdout: row.stdout, stderr: row.stderr, manifestHash: sha(row.manifestHash), observedAt: epoch(row.observedAt) };
}
function workspaceRequest(value: unknown): WorkspaceRequest {
  if (!isRecord(value)) invalid();
  if (value.kind === "integrate") {
    const row = fields(value, ["kind", "resultId", "resultRevision", "expectedManifestHash", "targetManifestHash"]);
    return { kind: "integrate", resultId: text(row.resultId), resultRevision: integer(row.resultRevision), expectedManifestHash: sha(row.expectedManifestHash), targetManifestHash: sha(row.targetManifestHash) };
  }
  const row = fields(value, ["kind", "target", "checkpointId", "expectedManifestHash", "targetManifestHash"]);
  if (row.kind !== "restore") invalid();
  return { kind: "restore", target: enumeration(row.target, ["source", "candidate"]), checkpointId: text(row.checkpointId), expectedManifestHash: sha(row.expectedManifestHash), targetManifestHash: sha(row.targetManifestHash) };
}
export function parseExecutionAction(value: unknown): ExecutionAction | undefined {
  if (!isRecord(value) || typeof value.kind !== "string") return undefined;
  switch (value.kind) {
    case "prepare-execution-plan": { const row = fields(value, ["kind", "plan"]); return { kind: value.kind, plan: plan(row.plan) }; }
    case "approve-execution": { const row = fields(value, ["kind", "planId", "planRevision", "runId", "approvedAt", "expiresAt", "ownerPid", "ownerId"]); return { kind: value.kind, planId: text(row.planId), planRevision: integer(row.planRevision), runId: text(row.runId), approvedAt: epoch(row.approvedAt), expiresAt: epoch(row.expiresAt), ownerPid: integer(row.ownerPid), ownerId: text(row.ownerId) }; }
    case "request-execution": { const row = fields(value, ["kind", "runId", "requestedAt"]); return { kind: value.kind, runId: text(row.runId), requestedAt: epoch(row.requestedAt) }; }
    case "observe-execution-provider": { const row = fields(value, ["kind", "runId", "model", "modelProvider", "observedAt"]); return { kind: value.kind, runId: text(row.runId), model: text(row.model, 128), modelProvider: text(row.modelProvider, 128), observedAt: epoch(row.observedAt) }; }
    case "bind-execution-thread": { const row = fields(value, ["kind", "runId", "threadId"]); return { kind: value.kind, runId: text(row.runId), threadId: text(row.threadId, 512) }; }
    case "bind-execution-turn": { const row = fields(value, ["kind", "runId", "threadId", "turnId"]); return { kind: value.kind, runId: text(row.runId), threadId: text(row.threadId, 512), turnId: text(row.turnId, 512) }; }
    case "begin-candidate-apply": { const row = fields(value, ["kind", "runId", "observedAt"]); return { kind: value.kind, runId: text(row.runId), observedAt: epoch(row.observedAt) }; }
    case "begin-execution-check": { const row = fields(value, ["kind", "runId", "checkId", "nonce", "requestedAt", "controlDirectory"]); return { kind: value.kind, runId: text(row.runId), checkId: text(row.checkId), nonce: text(row.nonce), requestedAt: epoch(row.requestedAt), controlDirectory: absolute(row.controlDirectory) }; }
    case "bind-check-process": { const row = fields(value, ["kind", "runId", "checkId", "nonce", "pid", "watchdogPid", "startedAt", "controlDirectory"]); return { kind: value.kind, runId: text(row.runId), checkId: text(row.checkId), nonce: text(row.nonce), pid: integer(row.pid), watchdogPid: integer(row.watchdogPid), startedAt: epoch(row.startedAt), controlDirectory: absolute(row.controlDirectory) }; }
    case "record-execution-check": { const row = fields(value, ["kind", "runId", "evidence"]); return { kind: value.kind, runId: text(row.runId), evidence: evidence(row.evidence) }; }
    case "mark-execution-unknown": { const row = fields(value, ["kind", "runId", "reason"]); return { kind: value.kind, runId: text(row.runId), reason: text(row.reason) }; }
    case "reconcile-execution-process": { const row = fields(value, ["kind", "runId", "nonce", "reason", "evidence"]); return { kind: value.kind, runId: text(row.runId), nonce: text(row.nonce), reason: text(row.reason), evidence: row.evidence === null ? null : evidence(row.evidence) }; }
    case "finish-execution": { const row = fields(value, ["kind", "runId", "summary", "outcome", "manifestHash"]); return { kind: value.kind, runId: text(row.runId), summary: text(row.summary), outcome: enumeration(row.outcome, ["needs-review", "failed", "no-change", "unknown"]), manifestHash: sha(row.manifestHash) }; }
    case "accept-execution-result": { const row = fields(value, ["kind", "runId", "resultId", "resultRevision"]); return { kind: value.kind, runId: text(row.runId), resultId: text(row.resultId), resultRevision: integer(row.resultRevision) }; }
    case "begin-workspace-operation": { const row = fields(value, ["kind", "runId", "request"]); return { kind: value.kind, runId: text(row.runId), request: workspaceRequest(row.request) }; }
    case "finish-workspace-operation": { const row = fields(value, ["kind", "runId", "operationId", "manifestHash", "observedAt"]); return { kind: value.kind, runId: text(row.runId), operationId: text(row.operationId), manifestHash: sha(row.manifestHash), observedAt: epoch(row.observedAt) }; }
    case "abandon-workspace-operation": { const row = fields(value, ["kind", "runId", "operationId", "observedManifestHash", "reason"]); return { kind: value.kind, runId: text(row.runId), operationId: text(row.operationId), observedManifestHash: sha(row.observedManifestHash), reason: text(row.reason) }; }
    case "mark-workspace-unknown":
    case "invalidate-execution-workspace": { const row = fields(value, ["kind", "runId", "reason"]); return { kind: value.kind, runId: text(row.runId), reason: text(row.reason) }; }
    case "set-scheduling-paused": { const row = fields(value, ["kind", "paused"]); if (typeof row.paused !== "boolean") invalid(); return { kind: value.kind, paused: row.paused }; }
    default: return undefined;
  }
}
export function parseExecutionEvent(value: unknown): ExecutionEvent | undefined {
  if (!isRecord(value) || value.kind !== "execution-recorded") return undefined;
  const row = fields(value, ["kind", "commandId", "action"]);
  const action = parseExecutionAction(row.action); if (!action) invalid();
  return { kind: "execution-recorded", commandId: text(row.commandId), action };
}
