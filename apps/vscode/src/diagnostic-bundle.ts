import { createHash, randomUUID } from "node:crypto";
import { constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import type { ProjectEvent, ProjectSnapshot } from "../../../packages/core/src/index.js";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_EVENTS = 5_000;
const BUNDLE_NAME = /^bundle-[a-f0-9-]{36}\.json$/;
const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const reference = (value: string): string => `ref:${hash(value).slice(0, 24)}`;
export type DiagnosticDetail = "metadata" | "reviewable-content";
export type DiagnosticRetention = 0 | 1 | 7;
export interface DiagnosticInput {
  readonly snapshot: ProjectSnapshot;
  readonly events: readonly ProjectEvent[];
  readonly extensionId: string;
  readonly extensionVersion: string;
  readonly vscodeVersion: string;
  readonly repository: { readonly commit: string | null; readonly dirty: boolean | null };
  readonly providers: unknown;
  readonly detail: DiagnosticDetail;
  readonly retentionDays: DiagnosticRetention;
  readonly recordingLink?: string;
}

export function redactDiagnosticText(text: string, repositoryPath = ""): string {
  let result = text
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/=_~.:-]+/gi, "[REDACTED AUTHORIZATION]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|AKIA[A-Z0-9]{16})\b/g, "[REDACTED TOKEN]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED JWT]")
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|authorization)\s*["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;&]+)/gi, "$1[REDACTED]")
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(/([?&](?:token|key|secret|signature|password|auth)=)[^&#\s]+/gi, "$1[REDACTED]");
  for (const prefix of [repositoryPath, homedir()].filter(Boolean).sort((a, b) => b.length - a.length)) result = result.split(prefix).join("[LOCAL PATH]");
  return result;
}

function redactContent(value: unknown, repositoryPath: string, depth = 0, budget = { remaining: 40_000, bytesRemaining: MAX_BYTES }): unknown {
  if (--budget.remaining < 0 || depth > 30) throw new Error("Diagnostic content exceeds the traversal limit. Choose metadata or a smaller project.");
  if (typeof value === "string") {
    budget.bytesRemaining -= Buffer.byteLength(value);
    if (budget.bytesRemaining < 0) throw new Error("Diagnostic content exceeds 2 MiB before redaction. Nothing was saved.");
    return redactDiagnosticText(value, repositoryPath);
  }
  if (Array.isArray(value)) return value.map((item: unknown) => redactContent(item, repositoryPath, depth + 1, budget));
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]: [string, unknown]) => [
    redactDiagnosticText(key, repositoryPath), /password|secret|api[_-]?key|authorization|credential|access[_-]?token|refresh[_-]?token/i.test(key)
      ? "[REDACTED]" : redactContent(item, repositoryPath, depth + 1, budget),
  ]));
  return value;
}

function providerMetadata(value: unknown): unknown {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 32).map((item: unknown) => {
    if (!item || typeof item !== "object") return { kind: "invalid" };
    return Object.fromEntries(["role", "provider", "model"].map(key => {
      const field: unknown = Reflect.get(item, key);
      return [key, typeof field === "string" && field.length <= 4096 ? reference(field) : "unavailable"];
    }));
  });
}

export function createDiagnosticBundle(input: DiagnosticInput): string {
  if (input.snapshot.revision !== input.events.length) throw new Error("Diagnostic snapshot and event revision disagree.");
  if (![0, 1, 7].includes(input.retentionDays)) throw new Error("Unsupported diagnostic retention.");
  if (input.events.length > 50_000 || input.snapshot.executionRuns.length > 500 || input.snapshot.executionRuns.reduce((total, run) => total + run.evidence.length, 0) > 5_000) throw new Error("Project exceeds the diagnostic collection limit.");
  const capturedAt = new Date().toISOString();
  const repositoryPath = input.snapshot.repositoryUri.startsWith("file:") ? new URL(input.snapshot.repositoryUri).pathname : "";
  let recording: unknown = null;
  if (input.recordingLink) {
    const url = new URL(input.recordingLink);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || input.recordingLink.length > 2048) throw new Error("Use an HTTPS recording link without credentials, query parameters, or fragments.");
    recording = { link: redactDiagnosticText(url.href, repositoryPath), capturedByPiarre: false };
  }
  const runs = input.snapshot.executionRuns.map(run => ({
    run: reference(run.runId), task: reference(run.grant.plan.taskId), plan: reference(run.grant.plan.planId), planRevision: run.grant.plan.recordedAtRevision,
    state: run.state.kind, process: run.process.kind, workspace: run.workspace.kind, reviewFreshness: run.reviewFreshness.kind, acceptance: run.acceptance.kind,
    approval: { approvedAt: run.grant.approvedAt, deadlineAt: run.grant.deadlineAt },
    provider: run.providerObservation.kind === "observed" ? { kind: "observed", model: reference(run.providerObservation.model), provider: reference(run.providerObservation.modelProvider), observedAt: run.providerObservation.observedAt } : { kind: "unobserved" },
    checks: run.evidence.map(check => ({ check: reference(check.checkId), criteria: check.criterionIds.map(reference), kind: check.kind, termination: check.termination,
      exitCode: check.exitCode, observedAt: check.observedAt, manifestHash: /^[a-f0-9]{64}$/.test(check.manifestHash) ? check.manifestHash : reference(check.manifestHash) })),
  }));
  const bundle = {
    manifest: {
      schemaVersion: 1, bundleId: randomUUID(), capturedAt, payloadSha256: "",
      extension: { id: input.extensionId === "sysung.piarre-candidate" ? "sysung.piarre-candidate" : "sysung.piarre", version: /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(input.extensionVersion) ? input.extensionVersion : "unknown" },
      vscodeVersion: /^\d+\.\d+\.\d+$/.test(input.vscodeVersion) ? input.vscodeVersion : "unknown",
      source: { project: reference(input.snapshot.projectId), repository: reference(input.snapshot.repositoryUri), projectRevision: input.snapshot.revision,
        commit: input.repository.commit && /^[a-f0-9]{40,64}$/.test(input.repository.commit) ? input.repository.commit : null, dirty: input.repository.dirty },
      synchronization: "Snapshot and event order come from one SQLite SELECT. Event revisions are ordering, not wall-clock timestamps. Repository metadata is a separate observation.",
      detail: input.detail, retentionDays: input.retentionDays,
      included: ["ordered event kinds and revisions", "pseudonymous project/task/run/check references", "run states and check outcomes", "approval/check observation times", "workspace hashes", "pseudonymous configured and observed providers/models", ...(input.detail === "reviewable-content" ? ["redacted snapshot, event content, provider configuration"] : [])],
      omitted: ["credentials and environment", "raw SQLite/WAL", "filesystem contents and arbitrary raw logs", "recording media", ...(input.detail === "metadata" ? ["user statements, prompts, command arguments, output, paths, memory text, configuration strings"] : [])],
      eventCoverage: { firstRevision: Math.max(1, input.events.length - MAX_EVENTS + 1), lastRevision: input.events.length, omittedEarlierEvents: Math.max(0, input.events.length - MAX_EVENTS) },
      privacy: "Local only. No remote analysis or upload occurs. Content mode uses best-effort secret patterns; review before sharing. Copies and provider retention are separate.",
      limits: { maximumBytes: MAX_BYTES, maximumEvents: MAX_EVENTS, maximumRuns: 500 },
    },
    providers: providerMetadata(input.providers),
    events: input.events.slice(-MAX_EVENTS).map((event, index) => ({ revision: Math.max(0, input.events.length - MAX_EVENTS) + index + 1, kind: event.kind })),
    runs, recording,
    ...(input.detail === "reviewable-content" ? { content: redactContent({ snapshot: input.snapshot, events: input.events.slice(-MAX_EVENTS), providers: input.providers }, repositoryPath) } : {}),
  };
  bundle.manifest.payloadSha256 = hash(JSON.stringify({ providers: bundle.providers, events: bundle.events, runs: bundle.runs, recording: bundle.recording, content: bundle.content }));
  const serialized = JSON.stringify(bundle, null, 2) + "\n";
  if (Buffer.byteLength(serialized) > MAX_BYTES) throw new Error("Diagnostic bundle exceeds 2 MiB. Choose metadata or a smaller project. Nothing was saved.");
  return serialized;
}

export class DiagnosticBundleStore {
  private readonly directory: string;
  constructor(storageRoot: string) {
    mkdirSync(storageRoot, { recursive: true, mode: 0o700 });
    this.directory = path.join(realpathSync(storageRoot), "diagnostics");
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    if (lstatSync(this.directory).isSymbolicLink()) throw new Error("Diagnostic storage must not contain symbolic links.");
  }
  private target(name: string): string {
    if (!BUNDLE_NAME.test(name)) throw new Error("Invalid diagnostic bundle name.");
    const target = path.join(this.directory, name);
    if (existsSync(target) && (!lstatSync(target).isFile() || lstatSync(target).isSymbolicLink())) throw new Error("Diagnostic bundle must be a regular file.");
    return target;
  }
  save(serialized: string): string {
    if (Buffer.byteLength(serialized) > MAX_BYTES) throw new Error("Diagnostic bundle exceeds 2 MiB.");
    if (this.list().length >= 20) throw new Error("Diagnostic retention is full (20 bundles). Delete old bundles before collecting more.");
    const name = `bundle-${randomUUID()}.json`;
    writeFileSync(this.target(name), serialized, { flag: "wx", mode: 0o600 });
    return name;
  }
  read(name: string): string {
    const fd = openSync(this.target(name), constants.O_RDONLY | constants.O_NOFOLLOW);
    try { if (fstatSync(fd).size > MAX_BYTES) throw new Error("Oversized diagnostic file."); return readFileSync(fd).toString("utf8"); } finally { closeSync(fd); }
  }
  list(): readonly string[] { return readdirSync(this.directory).filter(name => BUNDLE_NAME.test(name)).sort(); }
  export(name: string, destination: string): void {
    const content = this.read(name);
    writeFileSync(destination, content, { flag: "wx", mode: 0o600 });
    if (readFileSync(destination, "utf8") !== content) throw new Error("Diagnostic export readback failed.");
  }
  delete(name: string): void {
    const target = this.target(name);
    rmSync(target, { force: true });
    if (existsSync(target)) throw new Error("Diagnostic deletion could not be verified.");
  }
  expire(now = Date.now()): number {
    let deleted = 0;
    for (const name of this.list()) {
      const data: unknown = JSON.parse(this.read(name));
      if (!data || typeof data !== "object" || !("manifest" in data) || !data.manifest || typeof data.manifest !== "object" || !("capturedAt" in data.manifest) || !("retentionDays" in data.manifest)) continue;
      const { capturedAt, retentionDays } = data.manifest;
      if (typeof capturedAt !== "string" || typeof retentionDays !== "number" || ![1, 7].includes(retentionDays)) continue;
      if (Date.parse(capturedAt) + retentionDays * 86_400_000 <= now) { this.delete(name); deleted++; }
    }
    return deleted;
  }
  path(name: string): string { return this.target(name); }
}
