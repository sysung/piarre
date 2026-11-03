import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { currentKnowledge, type ProjectSnapshot } from "../../../packages/core/src/index.js";
import { planFreshness, type ExecutionAction, type ExecutionCheck, type ExecutionCriterion, type ExecutionRun, type CheckEvidence } from "../../../packages/core/src/execution.js";
import { parsePatchProposal } from "../../../packages/core/src/execution-patch.js";
import { CandidateWorkspace } from "./candidate-workspace.js";
import { digest } from "./candidate-journal.js";
import { WorkspaceIntegration } from "./workspace-integration.js";
import { CandidateCheckRunner, inspectCheckControl, type CandidateCheckResult } from "./candidate-check-runner.js";
import type { CodexConversationClient } from "./codex-conversation-client.js";
import type { SqliteProjectRepository } from "./sqlite-project-repository.js";

type Client = Pick<CodexConversationClient, "connect" | "readExecutionContext" | "proposePatch" | "interrupt" | "dispose">;
type Runner = Pick<CandidateCheckRunner, "capability" | "run" | "interrupt">;
const disposedOwners = new Set<string>();
interface Options {
  readonly repository: SqliteProjectRepository;
  readonly storageDirectory: string;
  readonly createClient: () => Client;
  readonly createRunner?: () => Runner;
  readonly publish: (snapshot: ProjectSnapshot) => void;
  readonly hasDirtyDocuments?: (absolutePaths: readonly string[]) => boolean;
}
export class ExecutionCoordinator {
  private disposedSnapshot: ProjectSnapshot | undefined;
  private readonly ownerId = randomUUID();
  private readonly active = new Map<string, { client: Client; runner: Runner; stopped: boolean }>();
  constructor(private readonly options: Options) {}
  private snapshot(): ProjectSnapshot { return this.disposedSnapshot ?? this.options.repository.read(); }
  private dispatch(action: ExecutionAction, commandId: string = randomUUID()): void {
    if (this.disposedSnapshot) throw new Error("Execution coordinator is disposed.");
    const project = this.snapshot();
    const result = this.options.repository.dispatch({ commandId, projectId: project.projectId, expectedProjectRevision: project.revision, action });
    if (result.kind !== "applied") throw new Error(`Execution authority was not acquired: ${result.kind}`);
    this.options.publish(result.snapshot);
  }
  private clean(candidate?: CandidateWorkspace): void {
    if (this.disposedSnapshot) throw new Error("Execution coordinator is disposed.");
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
  async prepare(input: { readonly taskId: string; readonly relativePaths: readonly string[]; readonly objective: string; readonly criteria: readonly ExecutionCriterion[]; readonly checks: readonly ExecutionCheck[]; readonly durationMs?: number; readonly maxTokens?: number; readonly requestedModel?: string }) {
    this.clean();
    const client = this.options.createClient();
    try {
      const connection = await client.connect();
      if (connection.kind !== "ready") throw new Error("Connect Codex before preparing execution.");
      const context = await client.readExecutionContext();
      const requestedModel = input.requestedModel ?? (context.model.kind === "resolved-default" ? context.model.model : undefined);
      if (!requestedModel) throw new Error("Codex did not report a default model. Configure an explicit coding model before preparing a run.");
      const project = this.snapshot();
      const candidate = CandidateWorkspace.capture({ repositoryRoot: fileURLToPath(project.repositoryUri), relativePaths: input.relativePaths, storageDirectory: this.options.storageDirectory });
      this.clean(candidate);
      const baselineCheckpoint = candidate.checkpoint({ checkpointId: "before-run" });
      const knowledge = currentKnowledge(project).filter(entry => entry.affectedTaskIds.includes(input.taskId)).map(entry => ({ projectId: entry.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision }));
      this.dispatch({ kind: "prepare-execution-plan", plan: { taskId: input.taskId, objective: input.objective, criteria: input.criteria, checks: input.checks, knowledge,
        baselineCheckpoint, files: candidate.files.map(file => file.baseline), candidateRoot: candidate.root, controlDirectory: candidate.controlDirectory, captureHash: candidate.captureHash, sourceRoot: candidate.sourceRoot,
        provider: { kind: "codex-readonly-patch", authType: connection.authType, requestedModel }, accountContext: context, durationMs: input.durationMs ?? 120_000, maxTokens: input.maxTokens ?? 16_000 } });
      const plan = this.snapshot().executionPlans.at(-1);
      if (!plan) throw new Error("Prepared plan was not persisted.");
      return { plan, capability: await (this.options.createRunner?.() ?? new CandidateCheckRunner()).capability() };
    } finally { client.dispose(); }
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
    const runId = `run:${input.approvalId}`;
    const approvedAt = Date.now();
    this.dispatch({ kind: "approve-execution", planId: input.planId, planRevision: input.planRevision, runId, approvedAt, expiresAt: approvedAt + plan.durationMs, ownerPid: process.pid, ownerId: this.ownerId }, input.approvalId);
    const client = this.options.createClient(); const runner = this.options.createRunner?.() ?? new CandidateCheckRunner();
    const active = { client, runner, stopped: false }; this.active.set(runId, active);
    let timer: NodeJS.Timeout | undefined;
    try {
      const connection = await client.connect();
      if (connection.kind !== "ready" || connection.authType !== plan.provider.authType) throw new Error("Codex authentication route changed after approval.");
      this.dispatch({ kind: "request-execution", runId, requestedAt: Date.now() });
      const linked = currentKnowledge(this.snapshot()).filter(entry => plan.knowledge.some(version => version.knowledgeId === entry.knowledgeId && version.recordedAtRevision === entry.recordedAtRevision));
      const prompt = JSON.stringify({ instruction: "Propose only bounded file replacements using disclosed opaque fileId values. Return summary and operations. Do not run tools or checks.", objective: plan.objective, criteria: plan.criteria, knowledge: linked, files: candidate.files, maxTokens: { kind: "soft", value: plan.maxTokens } });
      const response = await Promise.race([client.proposePatch({ prompt, cwd: candidate.root, model: plan.provider.requestedModel,
        onThreadMetadata: metadata => {
          if (this.stopped(runId)) throw new Error("Run was stopped before generation started.");
          if (metadata.model !== plan.provider.requestedModel || metadata.modelProvider !== "openai") throw new Error("Observed Codex model or provider differs from the approved plan. Generation was not started.");
          this.dispatch({ kind: "observe-execution-provider", runId, model: metadata.model, modelProvider: metadata.modelProvider, observedAt: Date.now() });
        },
        onThreadStarted: threadId => {
          const grant = this.run(runId).grant;
          if (this.stopped(runId) || Date.now() >= Math.min(grant.deadlineAt, grant.expiresAt)) throw new Error("Run was stopped or approval expired before generation started.");
          this.dispatch({ kind: "bind-execution-thread", runId, threadId });
        },
        onTurnStarted: (threadId, turnId) => { this.dispatch({ kind: "bind-execution-turn", runId, threadId, turnId }); } }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { active.stopped = true; void client.interrupt().catch(() => undefined); client.dispose(); reject(new Error("Approved absolute deadline expired; provider completion and usage are unknown.")); }, Math.max(0, this.run(runId).grant.deadlineAt - Date.now())); })]);
      if (timer) { clearTimeout(timer); timer = undefined; }
      if (response.status !== "completed" || this.stopped(runId)) throw new Error("Generation was interrupted; no candidate was applied.");
      const proposal = parsePatchProposal({ files: plan.files, value: response.output });
      this.clean(candidate);
      if (candidate.inspectOriginal().kind !== "unchanged") throw new Error("Source changed during generation.");
      this.dispatch({ kind: "begin-candidate-apply", runId, observedAt: Date.now() });
      candidate.checkpoint({ checkpointId: "before-run" });
      const applied = candidate.apply({ commandId: `patch:${runId}`, proposal });
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
      if (this.disposedSnapshot) return this.run(runId);
      const run = this.run(runId);
      if (run.state.kind !== "terminal" && run.state.kind !== "unknown") this.dispatch({ kind: "mark-execution-unknown", runId, reason: error instanceof Error ? error.message : "Execution completion is unknown." });
      const canRecordUnknownCompletion = this.run(runId).process.kind === "none" && this.run(runId).state.kind === "unknown" && run.state.kind !== "applying";
      if (canRecordUnknownCompletion) this.finish(runId, "unknown", error instanceof Error ? error.message : "Execution completion is unknown.", candidate);
    } finally { if (timer) clearTimeout(timer); client.dispose(); if (this.run(runId).process.kind === "none") this.active.delete(runId); }
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
    if (active) { active.stopped = true; const interruption = active.client.interrupt(); active.client.dispose(); await Promise.allSettled([interruption, active.runner.interrupt()]); }
    else if (this.run(runId).state.kind !== "terminal" && this.run(runId).state.kind !== "unknown") this.dispatch({ kind: "mark-execution-unknown", runId, reason: "No live owner can confirm interruption; reconcile persisted effects." });
    return this.run(runId);
  }
  dispose(): void {
    if (this.disposedSnapshot) return;
    disposedOwners.add(this.ownerId);
    for (const [runId, active] of this.active) {
      active.stopped = true;
      const run = this.run(runId);
      if (run.state.kind !== "terminal" && run.state.kind !== "unknown") this.dispatch({ kind: "mark-execution-unknown", runId, reason: "Execution host disposed; completion requires reconciliation." });
      active.client.dispose(); void active.runner.interrupt().catch(() => undefined);
    }
    this.disposedSnapshot = this.options.repository.read();
  }
  refreshWorkspaceFreshness(): void {
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
    if (this.disposedSnapshot) return;
    for (const initial of this.snapshot().executionRuns) {
      if (this.active.has(initial.runId)) continue;
      let ownerAlive = true;
      try { process.kill(initial.ownerPid, 0); } catch (error) { if (error instanceof Error && "code" in error && error.code === "ESRCH") ownerAlive = false; }
      if (ownerAlive && initial.ownerId !== this.ownerId && !(initial.ownerPid === process.pid && disposedOwners.has(initial.ownerId))) continue;
      if (initial.workspace.kind === "writing" || initial.workspace.kind === "unknown") {
        this.clean();
        const candidate = this.candidateForRun(initial.runId); this.clean(candidate);
        const operation = initial.workspace;
        try {
          const result = operation.request.kind === "restore" && operation.request.target === "candidate"
            ? candidate.reconcile({ commandId: operation.operationId })
            : new WorkspaceIntegration({ candidate }).reconcile({ commandId: operation.operationId });
          if ((result.kind === "changed" || result.kind === "current") && result.manifestHash === operation.request.targetManifestHash) this.dispatch({ kind: "finish-workspace-operation", runId: initial.runId, operationId: operation.operationId, manifestHash: result.manifestHash, observedAt: Date.now() });
          else if (operation.kind === "writing") this.dispatch({ kind: "mark-workspace-unknown", runId: initial.runId, reason: "Workspace journal conflicts with current bytes; newer work is preserved." });
        } catch {
          if (operation.kind === "writing") this.dispatch({ kind: "mark-workspace-unknown", runId: initial.runId, reason: "Workspace journal cannot establish completion; ownership retained." });
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
      } else if (existsSync(path.join(candidate.controlDirectory, `journal-${digest(`patch:${runId}`)}.json`))) {
        this.clean(candidate);
        const journal = candidate.reconcile({ commandId: `patch:${runId}` });
        if (journal.kind !== "changed" && journal.kind !== "current") continue;
      }
      this.finish(runId, "unknown", "Recovered effects require fresh planning and approval; checks are never restarted automatically.", candidate);
    }
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
    this.dispatch({ kind: "begin-workspace-operation", runId: input.runId, request: { kind: "integrate", resultId: input.resultId, resultRevision: input.resultRevision, expectedManifestHash: preview.sourceManifestHash, targetManifestHash: preview.currentCandidateHash } }, input.operationId);
    try {
      this.clean(candidate);
      const result = integration.apply({ commandId: input.operationId, expectedSourceManifestHash: preview.sourceManifestHash, expectedCandidateManifestHash: preview.currentCandidateHash });
      if (result.kind !== "changed" && result.kind !== "current") throw new Error("Workspace journal is conflicted; preserved bytes require reconciliation.");
      this.clean(candidate);
      this.dispatch({ kind: "finish-workspace-operation", runId: input.runId, operationId: input.operationId, manifestHash: result.manifestHash, observedAt: Date.now() });
      this.dispatch({ kind: "accept-execution-result", runId: input.runId, resultId: input.resultId, resultRevision: input.resultRevision });
    } catch (error) { if (this.run(input.runId).workspace.kind === "writing") this.dispatch({ kind: "mark-workspace-unknown", runId: input.runId, reason: error instanceof Error ? error.message : "Workspace completion unknown." }); throw error; }
    return this.run(input.runId);
  }
  previewRestore(input: { readonly runId: string; readonly target: "source" | "candidate"; readonly checkpointId: string }) {
    this.clean(); const candidate = this.candidateForRun(input.runId); this.clean(candidate);
    return input.target === "source" ? new WorkspaceIntegration({ candidate }).previewRestore(input) : candidate.previewRestore(input);
  }
  restore(input: { readonly runId: string; readonly target: "source" | "candidate"; readonly checkpointId: string; readonly expectedManifestHash: string; readonly targetManifestHash: string; readonly operationId: string }): ExecutionRun {
    const previous = this.run(input.runId);
    if (previous.workspace.kind === "restored" && previous.workspace.operationId === input.operationId) return previous;
    this.clean(); const candidate = this.candidateForRun(input.runId); this.clean(candidate); const integration = new WorkspaceIntegration({ candidate });
    const preview = this.previewRestore(input);
    if (preview.currentManifestHash !== input.expectedManifestHash || preview.targetManifestHash !== input.targetManifestHash) throw new Error("Restore preview changed.");
    this.dispatch({ kind: "begin-workspace-operation", runId: input.runId, request: { kind: "restore", target: input.target, checkpointId: input.checkpointId, expectedManifestHash: input.expectedManifestHash, targetManifestHash: input.targetManifestHash } }, input.operationId);
    try {
      this.clean(candidate);
      const result = input.target === "source" ? integration.restore({ restoreCommandId: input.operationId, checkpointId: input.checkpointId, expectedManifestHash: input.expectedManifestHash }) : candidate.restore({ commandId: input.operationId, checkpointId: input.checkpointId, expectedManifestHash: input.expectedManifestHash });
      if (result.kind !== "changed" && result.kind !== "current") throw new Error("Restore journal needs reconciliation.");
      this.dispatch({ kind: "finish-workspace-operation", runId: input.runId, operationId: input.operationId, manifestHash: result.manifestHash, observedAt: Date.now() });
    } catch (error) { this.dispatch({ kind: "mark-workspace-unknown", runId: input.runId, reason: error instanceof Error ? error.message : "Restore completion unknown." }); throw error; }
    return this.run(input.runId);
  }
}
