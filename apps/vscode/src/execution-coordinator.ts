import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { currentKnowledge, type ProjectSnapshot } from "../../../packages/core/src/index.js";
import { hasUncertainProvider, planFreshness, executionDependenciesReady, type ExecutionAction, type ExecutionCheck, type ExecutionCriterion, type ExecutionRun, type CheckEvidence } from "../../../packages/core/src/execution.js";
import { createExecutionForecast, executionForecastText, type SpendingConsent } from "../../../packages/core/src/execution-forecast.js";
import { type ProviderConfiguration } from "../../../packages/core/src/inspection.js";
import type { CodexExecutionContext } from "../../../packages/core/src/provider-account-context.js";
import { parsePatchProposal } from "../../../packages/core/src/execution-patch.js";
import { CandidateWorkspace } from "./candidate-workspace.js";
import { digest, imageHash } from "./candidate-journal.js";
import { WorkspaceIntegration } from "./workspace-integration.js";
import { CandidateCheckRunner, inspectCheckControl, type CandidateCheckResult } from "./candidate-check-runner.js";
import type { CodexConversationClient } from "./codex-conversation-client.js";
import type { SqliteProjectRepository } from "./sqlite-project-repository.js";

import { activeRecovery, supersededOperation, type RecoverySelection } from "../../../packages/core/src/recovery.js";
import { captureRetainedVersion, inspectRetainedInodes, inspectVersion, prepareRecoveryFiles, previewRecoveryFiles, replayRecoveryFiles, type RecoveryPreview } from "./recovery-files.js";
import { checkEscrowLayout, publicationParents } from "./scoped-publication.js";

type Client = Pick<CodexConversationClient, "connect" | "readExecutionContext" | "proposePatch" | "interrupt" | "dispose">;
type Runner = Pick<CandidateCheckRunner, "capability" | "run" | "interrupt">;
export class ExecutionReviewCancelled extends Error {}
const disposedOwners = new Set<string>();
const pendingPublicationOwners = new Set<string>();
interface Options {
  readonly repository: SqliteProjectRepository;
  readonly storageDirectory: string;
  readonly createClient: () => Client;
  readonly createRunner?: () => Runner;
  readonly publish: (snapshot: ProjectSnapshot) => void;
  readonly readProviderConfiguration?: () => ProviderConfiguration;
  readonly confirmSpending?: (disclosure: string) => Promise<"consent" | "cancel">;
  readonly hasDirtyDocuments?: (absolutePaths: readonly string[]) => boolean;
}
export class ExecutionCoordinator {
  private disposed = false;
  private lastSnapshot: ProjectSnapshot | undefined;
  private readonly closedClients = new WeakSet<Client>();
  private readonly preparing = new Set<Client>();
  private readonly ownerId = randomUUID();
  private readonly reviewingPlans = new Set<string>();
  private readonly prepared = new Map<string, { client: Client; authType: "chatgpt" | "apiKey" | "unknown"; expiresAt: number; timer: NodeJS.Timeout }>();
  private readonly recoveryPreviews = new Map<string, RecoveryPreview>();
  private readonly publishing = new Set<string>();
  private readonly active = new Map<string, { client: Client; runner: Runner; stopped: boolean; deadlineTimer?: NodeJS.Timeout }>();
  constructor(private readonly options: Options) {}
  private beginPublication(runId: string): void { this.publishing.add(runId); pendingPublicationOwners.add(this.ownerId); }
  private endPublication(runId: string): void { this.publishing.delete(runId); if (!this.publishing.size) pendingPublicationOwners.delete(this.ownerId); }
  private isDisposed(): boolean { return this.disposed; }
  private snapshot(): ProjectSnapshot {
    if (!this.disposed) return this.lastSnapshot = this.options.repository.read();
    if (this.lastSnapshot) return this.lastSnapshot;
    throw new Error("Execution coordinator is disposed.");
  }
  private record(project: ProjectSnapshot, action: ExecutionAction, commandId: string): ProjectSnapshot {
    const result = this.options.repository.dispatch({ commandId, projectId: project.projectId, expectedProjectRevision: project.revision, action });
    if (result.kind !== "applied") throw new Error(`Execution authority was not acquired: ${result.kind}`);
    return this.lastSnapshot = result.snapshot;
  }
  private dispatch(action: ExecutionAction, commandId: string = randomUUID()): void {
    this.clean();
    this.options.publish(this.record(this.snapshot(), action, commandId));
  }
  private disposeClient(client: Client): void {
    if (this.closedClients.has(client)) return;
    this.closedClients.add(client);
    client.dispose();
  }
  private clean(candidate?: CandidateWorkspace): void {
    if (this.disposed) throw new Error("Execution coordinator is disposed.");
    if (candidate && this.options.hasDirtyDocuments?.(candidate.files.flatMap(file => [path.join(candidate.sourceRoot, file.baseline.relativePath), path.join(candidate.root, file.baseline.relativePath)]))) throw new Error("Save or discard dirty editor documents in this execution scope before execution or workspace changes.");
  }
  private run(runId: string): ExecutionRun { const run = this.snapshot().executionRuns.find(item => item.runId === runId); if (!run) throw new Error("Execution run does not exist."); return run; }
  candidateForRun(runId: string): CandidateWorkspace {
    const plan = this.run(runId).grant.plan;
    return CandidateWorkspace.reopen({ controlDirectory: plan.controlDirectory, storageDirectory: this.options.storageDirectory, expectedCaptureHash: plan.captureHash });
  }
  inspection({ runId }: { readonly runId: string }) {
    const candidate = this.candidateForRun(runId);
    return { run: this.run(runId), root: candidate.root, sourceRoot: candidate.sourceRoot, files: candidate.files, diff: candidate.diff(), manifestHash: candidate.manifestHash(), original: candidate.inspectOriginal(), integration: new WorkspaceIntegration({ candidate }).preview() };
  }
  private configuration(model: string) {
    const configuration = this.options.readProviderConfiguration?.() ?? { kind: "valid", selections: [] };
    if (configuration.kind !== "valid") throw new Error("Provider configuration is invalid. Prepare a new plan after correcting it.");
    const coding = configuration.selections.find(selection => selection.role === "coding");
    if (coding && (coding.provider !== "codex" || coding.model !== model)) throw new Error("Configured coding provider/model differs from the reviewed route.");
    return { billing: coding?.billing ?? { kind: "unknown" } as const, profileHash: digest(JSON.stringify({ provider: "codex", model, adapter: "codex-readonly-patch-v1", effort: "default", serviceTierForTurn: "default" })), hash: digest(JSON.stringify({ coding: coding ?? null, model, adapter: "codex-readonly-patch-v1", serviceTierForTurn: "default" })) };
  }
  private prompt(plan: { readonly objective: string; readonly criteria: readonly ExecutionCriterion[]; readonly maxTokens: number }, candidate: CandidateWorkspace, linked: readonly unknown[]): string {
    return JSON.stringify({ instruction: "Propose only bounded file replacements using disclosed opaque fileId values. Return summary and operations. Do not run tools or checks.", objective: plan.objective, criteria: plan.criteria, knowledge: linked, files: candidate.files, maxTokens: { kind: "soft", value: plan.maxTokens } });
  }
  private contextMatches(plan: NonNullable<ReturnType<ExecutionCoordinator["snapshot"]>["executionPlans"][number]>, context: CodexExecutionContext): boolean {
    const forecast = plan.forecast;
    if (forecast.kind !== "configured-v1") return false;
    const old = plan.accountContext;
    const facts = (value: CodexExecutionContext) => ({ accountHash: value.facts?.accountHash ?? null, planType: value.facts?.planType ?? null, bucketId: value.facts?.bucketId ?? null, ordinaryUsageAllowed: value.facts?.ordinaryUsageAllowed ?? null,
      model: value.model, modelProfiles: value.modelProfiles ?? [], windows: value.usage.kind === "observed" ? value.usage.windows.map(window => ({ source: window.source, duration: window.windowDurationMins, reset: window.resetsAt })) : null });
    if (context.authType !== undefined && context.authType !== plan.provider.authType) return false;
    const age = Date.now() - Date.parse(context.observedAt);
    return age >= 0 && age <= 300_000 && JSON.stringify(facts(old)) === JSON.stringify(facts(context));
  }
  private finalBoundary(runId: string, candidate: CandidateWorkspace): void {
    const run = this.run(runId); const plan = run.grant.plan; const forecast = plan.forecast;
    this.clean(candidate);
    if (this.stopped(runId) || this.snapshot().schedulingPaused || !executionDependenciesReady(this.snapshot(), plan.taskId) || planFreshness(this.snapshot(), plan) !== "current" || Date.now() >= Math.min(run.grant.deadlineAt, run.grant.expiresAt) || forecast.kind !== "configured-v1" || Date.now() >= forecast.validUntil || this.configuration(plan.provider.requestedModel).hash !== forecast.configurationHash || candidate.inspectOriginal().kind !== "unchanged" || candidate.diff().length) throw new Error("Approved scope, configuration, forecast or execution authority changed before generation. Prepare and review a new plan.");
  }
  async prepare(input: { readonly taskId: string; readonly relativePaths: readonly string[]; readonly objective: string; readonly criteria: readonly ExecutionCriterion[]; readonly checks: readonly ExecutionCheck[]; readonly durationMs?: number; readonly maxTokens?: number; readonly requestedModel?: string }) {
    this.clean();
    for (const value of this.prepared.values()) { clearTimeout(value.timer); this.disposeClient(value.client); } this.prepared.clear();
    const client = this.options.createClient();
    this.preparing.add(client);
    let retained = false;
    try {
      const connection = await client.connect();
      this.clean();
      if (connection.kind !== "ready") throw new Error("Connect Codex before preparing execution.");
      const context = await client.readExecutionContext();
      this.clean();
      if (context.authType !== undefined && context.authType !== connection.authType) throw new Error("Codex authentication changed during preparation.");
      const requestedModel = input.requestedModel ?? (context.model.kind === "resolved-default" ? context.model.model : undefined);
      if (!requestedModel) throw new Error("Codex did not report a default model. Configure an explicit coding model before preparing a run.");
      let project = this.snapshot();
      const candidate = CandidateWorkspace.capture({ repositoryRoot: fileURLToPath(project.repositoryUri), relativePaths: input.relativePaths, storageDirectory: this.options.storageDirectory });
      this.clean(candidate);
      await checkEscrowLayout(candidate.sourceRoot, candidate.controlDirectory, candidate.files.map(file => file.baseline.relativePath));
      await checkEscrowLayout(candidate.root, candidate.controlDirectory, candidate.files.map(file => file.baseline.relativePath));
      this.clean(candidate);
      project = this.snapshot();
      const baselineCheckpoint = candidate.checkpoint({ checkpointId: "before-run" });
      const linked = currentKnowledge(project).filter(entry => entry.affectedTaskIds.includes(input.taskId));
      const knowledge = linked.map(entry => ({ projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision }));
      const configuration = this.configuration(requestedModel);
      const maxTokens = input.maxTokens ?? 16_000;
      const catalogProfile = context.modelProfiles?.find(profile => profile.model === requestedModel);
      const namedEffort = catalogProfile && ["none", "minimal", "low", "medium", "high", "xhigh"].includes(catalogProfile.defaultEffort) ? catalogProfile.defaultEffort : undefined;
      const forecast = createExecutionForecast({ forecastId: randomUUID(), now: Date.now(), configurationHash: configuration.hash, provider: "codex", model: requestedModel, authType: connection.authType, billing: configuration.billing, context, promptBytes: Buffer.byteLength(this.prompt({ ...input, maxTokens }, candidate, linked)), softTokenTarget: maxTokens, profile: namedEffort ? { kind: "named", effort: namedEffort } : { kind: "default", configurationHash: configuration.profileHash }, concurrentUsage: project.executionRuns.some(run => run.providerOutcome.kind === "abandoned" || hasUncertainProvider(run)) });
      this.dispatch({ kind: "prepare-execution-plan", plan: { taskId: input.taskId, objective: input.objective, criteria: input.criteria, checks: input.checks, knowledge,
        baselineCheckpoint, files: candidate.files.map(file => file.baseline), candidateRoot: candidate.root, controlDirectory: candidate.controlDirectory, captureHash: candidate.captureHash, sourceRoot: candidate.sourceRoot,
        provider: { kind: "codex-readonly-patch", authType: connection.authType, requestedModel }, accountContext: context, forecast, durationMs: input.durationMs ?? 120_000, maxTokens: input.maxTokens ?? 16_000 } });
      const plan = this.snapshot().executionPlans.at(-1);
      if (!plan) throw new Error("Prepared plan was not persisted.");
      const capability = await (this.options.createRunner?.() ?? new CandidateCheckRunner()).capability();
      this.clean();
      if (forecast.kind !== "configured-v1") throw new Error("Forecast unavailable.");
      const timer = setTimeout(() => { this.prepared.delete(plan.planId); this.disposeClient(client); }, Math.max(0, forecast.validUntil - Date.now()));
      timer.unref(); this.prepared.set(plan.planId, { client, authType: connection.authType, expiresAt: forecast.validUntil, timer }); retained = true;
      return { plan, capability };
    } finally { this.preparing.delete(client); if (!retained) this.disposeClient(client); }
  }
  async approveAndRun(input: { readonly planId: string; readonly planRevision: number; readonly approvalId: string }): Promise<ExecutionRun> {
    const duplicate = this.snapshot().executionRuns.find(run => run.grant.approvalId === input.approvalId);
    if (duplicate) {
      if (duplicate.grant.plan.planId !== input.planId || duplicate.grant.plan.recordedAtRevision !== input.planRevision) throw new Error("Approval identity conflicts with its frozen plan.");
      return duplicate;
    }
    this.clean();
    const plan = this.snapshot().executionPlans.find(item => item.planId === input.planId && item.recordedAtRevision === input.planRevision);
    if (!plan) throw new Error("Reviewed plan is unavailable.");
    const candidate = CandidateWorkspace.reopen({ controlDirectory: plan.controlDirectory, storageDirectory: this.options.storageDirectory, expectedCaptureHash: plan.captureHash });
    this.clean(candidate);
    if (candidate.inspectOriginal().kind !== "unchanged" || candidate.diff().length) throw new Error("Disclosed files changed after preparation.");
    const forecast = plan.forecast;
    const prepared = this.prepared.get(plan.planId);
    if (this.reviewingPlans.has(plan.planId) || !prepared || forecast.kind !== "configured-v1" || Date.now() >= prepared.expiresAt || this.configuration(plan.provider.requestedModel).hash !== forecast.configurationHash) throw new Error("Prepared connection or forecast expired or changed. Prepare a new plan.");
    this.reviewingPlans.add(plan.planId);
    const client = prepared.client;
    const runId = `run:${input.approvalId}`;
    try {
      const context = await client.readExecutionContext();
      this.clean();
      if (!this.contextMatches(plan, context)) throw new Error("Account, model, usage reset or profile changed. Prepare a new plan.");
      const disclosure = `${executionForecastText(forecast)}\n\nExact files: ${plan.files.map(file => file.relativePath).join(", ")}. Local duration ${String(plan.durationMs / 1000)} seconds. Plan ${plan.planId}, revision ${String(plan.recordedAtRevision)}; attempt ${runId}.\n\nThe provider has no supported per-turn included-only billing control. This exact attempt may consume allowance or incur charges, including continuing remote usage after interruption/disconnection. No dollar cap, paid fallback, alternate provider, retry or future run is authorized. ${forecast.accountHash === null ? "Account identity is unavailable. Consent applies only to this short-lived prepared connection; applicability of calibration remains unknown." : "The account binding is a local hash of supported provider metadata."}`;
      if (await this.options.confirmSpending?.(disclosure) !== "consent") throw new ExecutionReviewCancelled("Spending consent was cancelled. No generation was requested.");
      this.clean();
      const finalContext = await client.readExecutionContext();
      if (!this.contextMatches(plan, finalContext) || this.configuration(plan.provider.requestedModel).hash !== forecast.configurationHash || Date.now() >= forecast.validUntil) throw new Error("Account or configuration changed during review. Prepare a replacement plan and consent.");
      this.clean(candidate);
      if (candidate.inspectOriginal().kind !== "unchanged" || candidate.diff().length) throw new Error("Disclosed files changed during review.");
      const approvedAt = Date.now();
      const spendingConsent: SpendingConsent = { kind: "native-uncertain-one-attempt", forecastId: forecast.forecastId, configurationHash: forecast.configurationHash, planId: plan.planId, planRevision: plan.recordedAtRevision, runId, route: forecast.route, consentedAt: approvedAt };
      this.dispatch({ kind: "approve-execution", spendingConsent, planId: input.planId, planRevision: input.planRevision, runId, approvedAt, expiresAt: Math.min(approvedAt + plan.durationMs, forecast.validUntil), ownerPid: process.pid, ownerId: this.ownerId }, input.approvalId);
      this.dispatch({ kind: "record-execution-account-observation", runId, context: finalContext });
    } catch (error) { this.disposeClient(client); throw error; }
    finally { this.reviewingPlans.delete(plan.planId); this.prepared.delete(plan.planId); clearTimeout(prepared.timer); }
    const runner = this.options.createRunner?.() ?? new CandidateCheckRunner();
    const active: { client: Client; runner: Runner; stopped: boolean; deadlineTimer?: NodeJS.Timeout } = { client, runner, stopped: false };
    this.active.set(runId, active);
    try {
      this.finalBoundary(runId, candidate);
      this.dispatch({ kind: "request-execution", runId, requestedAt: Date.now() });
      const linked = currentKnowledge(this.snapshot()).filter(entry => plan.knowledge.some(version => version.knowledgeId === entry.knowledgeId && version.recordedAtRevision === entry.recordedAtRevision));
      const prompt = this.prompt(plan, candidate, linked);
      if (forecast.promptBytes !== Buffer.byteLength(prompt)) throw new Error("Serialized context changed after forecast review.");
      const response = await Promise.race([client.proposePatch({ prompt, cwd: candidate.root, model: plan.provider.requestedModel, serviceTierForTurn: "default", ...(forecast.profile.kind === "named" ? { effort: forecast.profile.effort } : {}),
        onThreadMetadata: metadata => {
          if (this.stopped(runId)) throw new Error("Run was stopped before generation started.");
          if (metadata.model !== plan.provider.requestedModel || metadata.modelProvider !== "openai") throw new Error("Observed Codex model or provider differs from the approved plan. Generation was not started.");
          if (forecast.profile.kind === "named" && metadata.reasoningEffort != null && metadata.reasoningEffort !== forecast.profile.effort) throw new Error("Observed reasoning effort differs from the frozen requested profile.");
          if (forecast.estimate.kind === "subscription" && forecast.estimate.windows.some(window => window.kind === "scenario") && forecast.profile.kind === "named" && metadata.reasoningEffort !== forecast.profile.effort) throw new Error("Calibrated profile could not be verified before generation; prepare a plan with unknown consumption.");
          this.dispatch({ kind: "observe-execution-provider", runId, model: metadata.model, modelProvider: metadata.modelProvider, reasoningEffort: metadata.reasoningEffort ?? null, threadServiceTier: metadata.serviceTier ?? null, observedAt: Date.now() });
        },
        onBeforeTurnStart: context => {
          if (!this.contextMatches(plan, context)) throw new Error("Account, reset or effort profile changed at the final turn boundary. No generation was submitted.");
          this.finalBoundary(runId, candidate);
          this.dispatch({ kind: "record-execution-account-observation", runId, context });
        },
        onThreadStarted: threadId => {
          this.finalBoundary(runId, candidate);
          this.dispatch({ kind: "bind-execution-thread", runId, threadId });
        },
        onTurnStarted: (threadId, turnId) => { this.dispatch({ kind: "bind-execution-turn", runId, threadId, turnId }); if (active.stopped) void client.interrupt().catch(() => { this.disposeClient(client); }).catch(() => undefined); },
        onTurnTerminal: observation => { if (!this.disposed) this.dispatch({ kind: "observe-execution-terminal", runId, ...observation, observedAt: Date.now() }); } }),
      new Promise<never>((_, reject) => { active.deadlineTimer = setTimeout(() => { active.stopped = true; void client.interrupt().catch(() => undefined); this.disposeClient(client); reject(new Error("Approved absolute deadline expired; provider completion and usage are unknown.")); }, Math.max(0, this.run(runId).grant.deadlineAt - Date.now())); })]);
      if (this.disposed) return this.run(runId);
      if (this.run(runId).providerOutcome.kind === "unobserved") this.dispatch({ kind: "observe-execution-terminal", runId, threadId: response.threadId, turnId: response.turnId, status: response.status, observedAt: Date.now() });
      const completionContext = await client.readExecutionContext().catch(() => undefined);
      if (this.isDisposed()) return this.run(runId);
      clearTimeout(active.deadlineTimer);
      if (completionContext) this.dispatch({ kind: "record-execution-account-observation", runId, context: completionContext });
      if (response.status === "interrupted") { this.finish(runId, "failed", "Provider interruption was observed; no candidate was applied.", candidate); return this.run(runId); }
      if (this.stopped(runId)) throw new Error("Generation was interrupted; no candidate was applied.");
      const proposal = parsePatchProposal({ files: plan.files, value: response.output });
      this.clean(candidate);
      if (candidate.inspectOriginal().kind !== "unchanged") throw new Error("Source changed during generation.");
      this.dispatch({ kind: "begin-candidate-apply", runId, observedAt: Date.now() });
      candidate.checkpoint({ checkpointId: "before-run" });
      this.beginPublication(runId);
      const applied = await candidate.apply({ commandId: `patch:${runId}`, proposal, shouldContinue: () => !this.isDisposed() && !this.stopped(runId) && Date.now() < this.run(runId).grant.deadlineAt });
      this.endPublication(runId);
      this.clean(candidate);
      if (this.stopped(runId) || Date.now() >= this.run(runId).grant.deadlineAt) throw new Error("Publication finished after stop or deadline; no checks started.");
      if (applied.kind !== "changed" && applied.kind !== "current") throw new Error("Candidate journal requires reconciliation.");
      if (!proposal.operations.length) { this.finish(runId, "no-change", proposal.summary, candidate); return this.run(runId); }
      for (const check of plan.checks) {
        this.clean(candidate);
        if (this.stopped(runId) || planFreshness(this.snapshot(), plan) !== "current" || candidate.inspectOriginal().kind !== "unchanged") throw new Error("Run was stopped or its approved inputs changed.");
        const beforeHash = candidate.manifestHash(); const nonce = randomUUID();
        const controlDirectory = path.join(candidate.controlDirectory, `check-${nonce}`); mkdirSync(controlDirectory, { mode: 0o700 });
        this.dispatch({ kind: "begin-execution-check", runId, checkId: check.checkId, nonce, requestedAt: Date.now(), controlDirectory });
        const result = await runner.run({ root: candidate.root, controlDirectory, argv: check.argv, nonce, deadlineAt: this.run(runId).grant.deadlineAt,
          onStarted: identity => { this.dispatch({ kind: "bind-check-process", runId, checkId: check.checkId, ...identity }); } });
        this.clean(candidate);
        const hash = candidate.manifestHash();
        const evidence = this.evidence(check, nonce, result, hash, beforeHash === hash && !this.stopped(runId) && Date.now() < this.run(runId).grant.deadlineAt);
        this.dispatch({ kind: "record-execution-check", runId, evidence });
        if (result.termination === "unconfirmed") return this.run(runId);
        if (evidence.kind !== "passed") { this.finish(runId, "failed", "Approved check did not pass with current unchanged candidate bytes.", candidate); return this.run(runId); }
      }
      this.clean(candidate);
      const finalHash = candidate.manifestHash();
      const current = this.run(runId);
      const passed = plan.checks.length > 0 && plan.checks.every(check => current.evidence.some(item => item.checkId === check.checkId && item.kind === "passed" && item.manifestHash === finalHash)) && plan.criteria.every(criterion => current.evidence.some(item => item.kind === "passed" && item.manifestHash === finalHash && item.criterionIds.includes(criterion.criterionId)));
      if (candidate.inspectOriginal().kind !== "unchanged") throw new Error("Original files changed before result review.");
      this.finish(runId, passed ? "needs-review" : "failed", proposal.summary, candidate);
    } catch (error) {
      if (this.disposed) return this.run(runId);
      const run = this.run(runId);
      if (run.state.kind !== "terminal" && run.state.kind !== "unknown") this.dispatch({ kind: "mark-execution-unknown", runId, reason: error instanceof Error ? error.message : "Execution completion is unknown." });
      const canRecordUnknownCompletion = !hasUncertainProvider(this.run(runId)) && this.run(runId).process.kind === "none" && this.run(runId).state.kind === "unknown" && run.state.kind !== "applying";
      if (canRecordUnknownCompletion) this.finish(runId, "unknown", error instanceof Error ? error.message : "Execution completion is unknown.", candidate);
    } finally {
      this.endPublication(runId);
      clearTimeout(active.deadlineTimer);
      this.disposeClient(client);
      if (!this.disposed && this.run(runId).process.kind === "none") this.active.delete(runId);
    }
    return this.run(runId);
  }
  private stopped(runId: string): boolean { return this.active.get(runId)?.stopped ?? true; }
  private evidence(check: ExecutionCheck, nonce: string, result: CandidateCheckResult, manifestHash: string, unchanged: boolean): CheckEvidence {
    return { checkId: check.checkId, nonce, termination: result.termination,
      kind: result.kind === "unsupported" ? "not-tested" : result.termination === "unconfirmed" ? "unknown" : result.kind === "exited" && result.exitCode === 0 && result.signal === null && unchanged ? "passed" : "failed",
      criterionIds: check.criterionIds, argv: check.argv, exitCode: "exitCode" in result ? result.exitCode : null, signal: "signal" in result ? result.signal : null,
      stdout: result.stdout, stderr: result.stderr, manifestHash, observedAt: Date.now() };
  }
  private finish(runId: string, outcome: "needs-review" | "failed" | "no-change" | "unknown", summary: string, candidate: CandidateWorkspace): void { this.dispatch({ kind: "finish-execution", runId, summary, outcome, manifestHash: candidate.manifestHash() }); }
  async stop({ runId }: { readonly runId: string }): Promise<ExecutionRun> {
    const active = this.active.get(runId);
    if (active) {
      active.stopped = true;
      if (this.run(runId).state.kind === "generating" || this.run(runId).state.kind === "reserved") this.dispatch({ kind: "mark-execution-unknown", runId, reason: "Stop requested; provider termination is not yet confirmed." });
      await Promise.allSettled([active.client.interrupt().catch(() => { this.disposeClient(active.client); }), active.runner.interrupt()]);
    }
    else if (this.run(runId).state.kind !== "terminal" && this.run(runId).state.kind !== "unknown") this.dispatch({ kind: "mark-execution-unknown", runId, reason: "No live owner can confirm interruption; reconcile persisted effects." });
    return this.run(runId);
  }
  dispose(): void {
    if (this.isDisposed()) return;
    this.disposed = true;
    disposedOwners.add(this.ownerId);
    this.recoveryPreviews.clear();
    const errors: unknown[] = [];
    const release = (cleanup: () => void): void => {
      try { cleanup(); } catch (error) { errors.push(error); }
    };
    let project: ProjectSnapshot | undefined;
    release(() => { project = this.lastSnapshot = this.options.repository.read(); });
    for (const client of this.preparing) release(() => { this.disposeClient(client); });
    this.preparing.clear();
    for (const { timer, client } of this.prepared.values()) {
      clearTimeout(timer);
      release(() => { this.disposeClient(client); });
    }
    this.prepared.clear();
    for (const [runId, active] of this.active) {
      active.stopped = true;
      clearTimeout(active.deadlineTimer);
      release(() => {
        const run = project?.executionRuns.find(item => item.runId === runId);
        if (project && run && run.state.kind !== "terminal" && run.state.kind !== "unknown") {
          project = this.record(project, { kind: "mark-execution-unknown", runId, reason: "Execution host disposed; completion requires reconciliation." }, randomUUID());
        }
      });
      release(() => { this.disposeClient(active.client); });
      release(() => { void active.runner.interrupt().catch(() => undefined); });
    }
    this.active.clear();
    if (errors.length) throw new AggregateError(errors, "Execution coordinator could not release all resources.");
  }
  refreshWorkspaceFreshness(): void {
    if (this.isDisposed()) return;
    for (const run of this.snapshot().executionRuns) {
      if (run.state.kind !== "terminal" || run.reviewFreshness.kind !== "current") continue;
      let reason: string | undefined;
      try {
        const candidate = this.candidateForRun(run.runId);
        const dirty = this.options.hasDirtyDocuments?.(candidate.files.flatMap(file => [path.join(candidate.sourceRoot, file.baseline.relativePath), path.join(candidate.root, file.baseline.relativePath)]));
        const preview = new WorkspaceIntegration({ candidate }).preview();
        const sourceChanged = run.workspace.kind === "integrated" ? preview.sourceManifestHash !== run.workspace.manifestHash : candidate.inspectOriginal().kind !== "unchanged";
        if (dirty || sourceChanged || candidate.manifestHash() !== run.state.result.manifestHash) reason = "Scoped editor, candidate, or source bytes changed after verification.";
      } catch { reason = "Scoped files or their capture are unavailable; current verification cannot be established."; }
      if (reason) this.dispatch({ kind: "invalidate-execution-workspace", runId: run.runId, reason });
    }
  }
  async stopAll(): Promise<void> { this.dispatch({ kind: "set-scheduling-paused", paused: true }); await Promise.allSettled(this.snapshot().executionRuns.filter(run => run.state.kind !== "terminal").map(run => this.stop({ runId: run.runId }))); }
  resume(): void { this.dispatch({ kind: "set-scheduling-paused", paused: false }); }
  async reconcile(): Promise<void> {
    await Promise.resolve();
    if (this.isDisposed()) return;
    for (const initial of this.snapshot().executionRuns) {
      if (this.isDisposed()) return;
      if (this.active.has(initial.runId) || this.publishing.has(initial.runId)) continue;
      const recoveryOwner = activeRecovery(initial);
      const workspaceWriter = initial.workspace.kind === "writing" || initial.workspace.kind === "unknown" ? initial.workspace.request.writer : undefined;
      const ownerPid = recoveryOwner?.ownerPid ?? workspaceWriter?.ownerPid ?? initial.ownerPid;
      const ownerId = recoveryOwner?.ownerId ?? workspaceWriter?.ownerId ?? initial.ownerId;
      if (pendingPublicationOwners.has(ownerId)) continue;
      let ownerAlive = true;
      try { process.kill(ownerPid, 0); } catch (error) { if (error instanceof Error && "code" in error && error.code === "ESRCH") ownerAlive = false; }
      if (ownerAlive && ownerId !== this.ownerId && !(ownerPid === process.pid && disposedOwners.has(ownerId))) continue;
      if (recoveryOwner) {
        try { await this.completeRecovery(initial.runId, recoveryOwner.operationId, ownerId); } catch { /* The durable unknown successor retains ownership. */ }
        continue;
      }
      if (initial.workspace.kind === "writing" || initial.workspace.kind === "unknown") {
        this.clean();
        const candidate = this.candidateForRun(initial.runId); this.clean(candidate);
        const operation = initial.workspace;
        this.beginPublication(initial.runId);
        pendingPublicationOwners.add(ownerId);
        try {
          const result = operation.request.kind === "restore" && operation.request.target === "candidate"
            ? await candidate.restore({ commandId: operation.operationId, checkpointId: operation.request.checkpointId, expectedManifestHash: operation.request.expectedManifestHash, targetManifestHash: operation.request.targetManifestHash, parentIdentityHash: operation.request.parentIdentityHash })
            : await new WorkspaceIntegration({ candidate }).reconcile({ commandId: operation.operationId, authority: { ...operation.request, parentIdentityHash: operation.request.parentIdentityHash } });
          if (this.isDisposed()) return;
          if ((result.kind === "changed" || result.kind === "current") && result.manifestHash === operation.request.targetManifestHash) this.dispatch({ kind: "finish-workspace-operation", runId: initial.runId, operationId: operation.operationId, manifestHash: result.manifestHash, observedAt: Date.now() });
          else if (operation.kind === "writing") this.dispatch({ kind: "mark-workspace-unknown", runId: initial.runId, reason: "Workspace journal conflicts with current bytes; newer work is preserved." });
        } catch {
          if (this.isDisposed()) return;
          if (operation.kind === "writing") this.dispatch({ kind: "mark-workspace-unknown", runId: initial.runId, reason: "Workspace journal cannot establish completion; ownership retained." });
        } finally {
          this.endPublication(initial.runId);
          if (ownerId !== this.ownerId) pendingPublicationOwners.delete(ownerId);
        }
      }
      if (initial.state.kind === "terminal") continue;
      const runId = initial.runId;
      if (initial.state.kind !== "unknown") this.dispatch({ kind: "mark-execution-unknown", runId, reason: "Execution owner restarted; outbound requests are never automatically repeated." });
      const run = this.run(runId); const candidate = this.candidateForRun(runId);
      if (run.process.kind === "unknown") {
        const inspection = inspectCheckControl(run.process);
        if (inspection.kind !== "terminal") continue;
        const process = run.process;
        const approved = run.grant.plan.checks.find(item => item.checkId === process.checkId);
        if (!approved) continue;
        const evidence = this.evidence(approved, process.nonce, inspection.result, candidate.manifestHash(), false);
        this.dispatch({ kind: "reconcile-execution-process", runId, nonce: process.nonce, reason: "Observed terminal nonce-correlated check receipt after restart.", evidence });
      } else if (!supersededOperation(run, `patch:${runId}`) && existsSync(path.join(candidate.controlDirectory, `journal-${digest(`patch:${runId}`)}.json`))) {
        this.clean(candidate);
        const journal = await candidate.reconcile({ commandId: `patch:${runId}` });
        if (this.isDisposed()) return;
        if (journal.kind !== "changed" && journal.kind !== "current") continue;
      }
      if (hasUncertainProvider(this.run(runId))) continue;
      this.finish(runId, "unknown", "Recovered effects require fresh planning and approval; checks are never restarted automatically.", candidate);
    }
  }
  abandonProvider({ runId, reason }: { readonly runId: string; readonly reason: string }): ExecutionRun {
    const run = this.run(runId);
    if (run.state.kind !== "unknown" || !hasUncertainProvider(run) || run.process.kind !== "none" || run.workspace.kind !== "not-integrated") throw new Error("This run has no isolated uncertain provider request to resolve.");
    const active = this.active.get(runId);
    if (active) this.disposeClient(active.client);
    this.dispatch({ kind: "abandon-execution-provider", runId, reason, abandonedAt: Date.now(), manifestHash: this.candidateForRun(runId).manifestHash() });
    return this.run(runId);
  }
  async applyAndAccept(input: { readonly runId: string; readonly resultId: string; readonly resultRevision: number; readonly operationId: string }): Promise<ExecutionRun> {
    await Promise.resolve();
    const run = this.run(input.runId);
    if (run.workspace.kind === "integrated" && run.workspace.operationId === input.operationId) {
      if (run.state.kind !== "terminal" || run.state.result.resultId !== input.resultId || run.state.result.recordedAtRevision !== input.resultRevision) throw new Error("Reviewed result identity changed.");
      if (run.acceptance.kind === "accepted") return run;
      this.clean();
      const candidate = this.candidateForRun(input.runId); this.clean(candidate);
      if (new WorkspaceIntegration({ candidate }).preview().sourceManifestHash !== run.workspace.manifestHash || candidate.manifestHash() !== run.workspace.manifestHash) throw new Error("Integrated source changed before acceptance.");
      this.dispatch({ kind: "accept-execution-result", runId: input.runId, resultId: input.resultId, resultRevision: input.resultRevision }); return this.run(input.runId);
    }
    this.clean();
    const candidate = this.candidateForRun(input.runId); this.clean(candidate); const integration = new WorkspaceIntegration({ candidate }); const preview = integration.preview();
    if (run.state.kind !== "terminal" || run.state.result.resultId !== input.resultId || run.state.result.recordedAtRevision !== input.resultRevision || run.state.result.manifestHash !== preview.currentCandidateHash || candidate.inspectOriginal().kind !== "unchanged") throw new Error("Reviewed result or original workspace changed.");
    const parentIdentityHash = digest(JSON.stringify(preview.changes.map(change => publicationParents(candidate.sourceRoot, change.relativePath))));
    this.dispatch({ kind: "begin-workspace-operation", runId: input.runId, request: { kind: "integrate", parentIdentityHash, writer: { ownerId: this.ownerId, ownerPid: process.pid }, resultId: input.resultId, resultRevision: input.resultRevision, expectedManifestHash: preview.sourceManifestHash, targetManifestHash: preview.currentCandidateHash } }, input.operationId);
    this.beginPublication(input.runId);
    try {
      this.clean(candidate);
      const result = await integration.apply({ commandId: input.operationId, expectedSourceManifestHash: preview.sourceManifestHash, expectedCandidateManifestHash: preview.currentCandidateHash, parentIdentityHash });
      if (result.kind !== "changed" && result.kind !== "current") throw new Error("Workspace journal is conflicted; preserved bytes require reconciliation.");
      this.clean(candidate);
      this.dispatch({ kind: "finish-workspace-operation", runId: input.runId, operationId: input.operationId, manifestHash: result.manifestHash, observedAt: Date.now() });
      this.dispatch({ kind: "accept-execution-result", runId: input.runId, resultId: input.resultId, resultRevision: input.resultRevision });
    } catch (error) { if (!this.disposed && this.run(input.runId).workspace.kind === "writing") this.dispatch({ kind: "mark-workspace-unknown", runId: input.runId, reason: error instanceof Error ? error.message : "Workspace completion unknown." }); throw error; }
    finally { this.endPublication(input.runId); }
    return this.run(input.runId);
  }
  previewRestore(input: { readonly runId: string; readonly target: "source" | "candidate"; readonly checkpointId: string }) {
    this.clean(); const candidate = this.candidateForRun(input.runId); this.clean(candidate);
    return input.target === "source" ? new WorkspaceIntegration({ candidate }).previewRestore(input) : candidate.previewRestore(input);
  }
  async restore(input: { readonly runId: string; readonly target: "source" | "candidate"; readonly checkpointId: string; readonly expectedManifestHash: string; readonly targetManifestHash: string; readonly operationId: string }): Promise<ExecutionRun> {
    const previous = this.run(input.runId);
    if (previous.workspace.kind === "restored" && previous.workspace.operationId === input.operationId) return previous;
    this.clean(); const candidate = this.candidateForRun(input.runId); this.clean(candidate); const integration = new WorkspaceIntegration({ candidate });
    const preview = this.previewRestore(input);
    if (preview.currentManifestHash !== input.expectedManifestHash || preview.targetManifestHash !== input.targetManifestHash) throw new Error("Restore preview changed.");
    const parentIdentityHash = digest(JSON.stringify(preview.changes.map(change => publicationParents(input.target === "source" ? candidate.sourceRoot : candidate.root, change.relativePath))));
    this.dispatch({ kind: "begin-workspace-operation", runId: input.runId, request: { kind: "restore", parentIdentityHash, writer: { ownerId: this.ownerId, ownerPid: process.pid }, target: input.target, checkpointId: input.checkpointId, expectedManifestHash: input.expectedManifestHash, targetManifestHash: input.targetManifestHash } }, input.operationId);
    this.beginPublication(input.runId);
    try {
      this.clean(candidate);
      const result = await (input.target === "source" ? integration.restore({ restoreCommandId: input.operationId, checkpointId: input.checkpointId, expectedManifestHash: input.expectedManifestHash, targetManifestHash: input.targetManifestHash, parentIdentityHash }) : candidate.restore({ commandId: input.operationId, checkpointId: input.checkpointId, expectedManifestHash: input.expectedManifestHash, targetManifestHash: input.targetManifestHash, parentIdentityHash }));
      if (result.kind !== "changed" && result.kind !== "current") throw new Error("Restore journal needs reconciliation.");
      this.dispatch({ kind: "finish-workspace-operation", runId: input.runId, operationId: input.operationId, manifestHash: result.manifestHash, observedAt: Date.now() });
    } catch (error) { if (!this.disposed) this.dispatch({ kind: "mark-workspace-unknown", runId: input.runId, reason: error instanceof Error ? error.message : "Restore completion unknown." }); throw error; }
    finally { this.endPublication(input.runId); }
    return this.run(input.runId);
  }
  savedVersions(runId: string) {
    const run = this.run(runId);
    return { versions: run.savedVersions.map(version => inspectVersion(run, version)), retained: inspectRetainedInodes(run) };
  }
  captureRetained(runId: string, entryKey: string): RecoverySelection {
    this.clean(); const commandId = randomUUID();
    const captured = captureRetainedVersion(this.run(runId), entryKey, commandId);
    this.dispatch({ kind: "register-retained-version", runId, target: captured.entry.target, originOperationId: captured.entry.operationId, relativePath: captured.entry.relativePath, manifestHash: captured.manifestHash, observedAt: Date.now() }, commandId);
    return { kind: "snapshot", target: captured.entry.target, versionId: `retained:${commandId}` };
  }
  recoverySelection(runId: string): RecoverySelection {
    const run = this.run(runId); const recovery = activeRecovery(run);
    if (recovery) return { kind: "journal", target: recovery.selection.target, operationId: recovery.operationId };
    if (run.workspace.kind === "writing" || run.workspace.kind === "unknown") return { kind: "journal", target: run.workspace.request.kind === "restore" ? run.workspace.request.target : "source", operationId: run.workspace.operationId };
    if (run.state.kind === "unknown" && !supersededOperation(run, `patch:${runId}`)) return { kind: "journal", target: "candidate", operationId: `patch:${runId}` };
    throw new Error("No unresolved journal is recorded for this run.");
  }
  private recoveryBlockers(run: ExecutionRun): readonly string[] {
    const blockers: string[] = [];
    if (run.process.kind !== "none") blockers.push("A local check process still has unknown or active ownership. Recovery cannot stop it or assume termination.");
    if (hasUncertainProvider(run)) blockers.push("Provider activity remains unconfirmed. Resolve that reservation separately; recovery does not stop provider work.");
    if (this.active.has(run.runId)) blockers.push("This execution owner is still active.");
    if (this.options.hasDirtyDocuments?.(run.grant.plan.files.flatMap(file => [path.join(run.grant.plan.sourceRoot, file.relativePath), path.join(run.grant.plan.candidateRoot, file.relativePath)]))) blockers.push("Unsaved scoped editor buffers block recovery. Piarre will not save or discard them.");
    if (this.snapshot().executionRuns.some(other => other.runId !== run.runId && (other.state.kind !== "terminal" || other.workspace.kind === "writing" || other.workspace.kind === "unknown" || activeRecovery(other)))) blockers.push("Another run retains writer ownership.");
    const recovery = activeRecovery(run);
    const workspaceWriter = run.workspace.kind === "writing" || run.workspace.kind === "unknown" ? run.workspace.request.writer : undefined;
    const ownerId = recovery?.ownerId ?? workspaceWriter?.ownerId ?? run.ownerId; const ownerPid = recovery?.ownerPid ?? workspaceWriter?.ownerPid ?? run.ownerPid;
    if (pendingPublicationOwners.has(ownerId)) blockers.push("Native publication is still pending; retain ownership until its receipt is observed.");
    if ((recovery || run.state.kind !== "terminal" || run.workspace.kind === "writing" || run.workspace.kind === "unknown") && ownerId !== this.ownerId && !(ownerPid === process.pid && disposedOwners.has(ownerId))) {
      let alive = true; try { process.kill(ownerPid, 0); } catch (error) { if (error instanceof Error && "code" in error && error.code === "ESRCH") alive = false; }
      if (alive) blockers.push("A foreign live or uncertain owner may still write. Its PID is not permission to stop it.");
    }
    return blockers;
  }
  async previewRecovery(input: { readonly runId: string; readonly selection: RecoverySelection }): Promise<RecoveryPreview> {
    this.clean();
    const preview = await previewRecoveryFiles(this.run(input.runId), input.selection, this.snapshot().revision, this.recoveryBlockers(this.run(input.runId)));
    this.clean();
    this.recoveryPreviews.set(preview.previewId, preview);
    return preview;
  }
  cancelRecovery(previewId: string): void { this.recoveryPreviews.delete(previewId); }
  async recover(input: { readonly previewId: string; readonly intendedPaths: readonly string[]; readonly operationId: string }): Promise<ExecutionRun> {
    const existing = this.snapshot().executionRuns.find(run => run.recoveries.some(record => record.operationId === input.operationId));
    if (existing) {
      const record = existing.recoveries.find(record => record.operationId === input.operationId);
      if (record?.previewId !== input.previewId || JSON.stringify(record.intendedPaths) !== JSON.stringify(input.intendedPaths)) throw new Error("Recovery command differs from its reviewed choices.");
      return existing;
    }
    this.clean(); const preview = this.recoveryPreviews.get(input.previewId);
    if (!preview) throw new Error("Recovery preview expired or was cancelled.");
    const run = this.run(preview.runId);
    const refreshed = await previewRecoveryFiles(run, preview.selection, this.snapshot().revision, this.recoveryBlockers(run));
    if (refreshed.blockers.length) throw new Error(refreshed.blockers.join("\n"));
    if (preview.projectRevision !== refreshed.projectRevision || preview.bindingHash !== refreshed.bindingHash || preview.currentManifestHash !== refreshed.currentManifestHash || preview.intendedManifestHash !== refreshed.intendedManifestHash) throw new Error("Recovery preview is stale. Review current files again.");
    if (new Set(input.intendedPaths).size !== input.intendedPaths.length || input.intendedPaths.some(relative => !preview.current.some(image => image.relativePath === relative))) throw new Error("Recovery choices are outside the reviewed scope.");
    this.clean();
    const target = prepareRecoveryFiles(run, preview, input.intendedPaths, input.operationId);
    this.dispatch({ kind: "begin-recovery", runId: run.runId, request: { previewId: preview.previewId, projectRevision: preview.projectRevision, selection: preview.selection, bindingHash: preview.bindingHash, parentIdentityHash: digest(JSON.stringify(preview.parentIdentities)), expectedManifestHash: preview.currentManifestHash, targetManifestHash: imageHash(target), intendedPaths: input.intendedPaths, reviewedAt: Date.now(), ownerId: this.ownerId, ownerPid: process.pid } }, input.operationId);
    this.recoveryPreviews.delete(input.previewId);
    await this.completeRecovery(run.runId, input.operationId);
    return this.run(run.runId);
  }
  private async completeRecovery(runId: string, operationId: string, ownerId: string = this.ownerId): Promise<void> {
    const run = this.run(runId);
    let publishing = false;
    try {
      const blockers = this.recoveryBlockers(run); if (blockers.length) throw new Error(blockers.join("\n"));
      this.beginPublication(runId);
      pendingPublicationOwners.add(ownerId);
      publishing = true;
      const result = await replayRecoveryFiles(run, operationId);
      if (result.kind !== "changed" && result.kind !== "current") throw new Error("reason" in result ? result.reason : "Recovery completion unknown.");
      this.dispatch({ kind: "finish-recovery", runId, operationId, manifestHash: result.manifestHash, observedAt: Date.now() });
    } catch (error) {
      if (!this.disposed) this.dispatch({ kind: "mark-recovery-unknown", runId, operationId, reason: error instanceof Error ? error.message : "Recovery completion unknown; reservation retained." });
      throw error;
    } finally {
      if (publishing) {
        this.endPublication(runId);
        if (ownerId !== this.ownerId) pendingPublicationOwners.delete(ownerId);
      }
    }
  }

}
