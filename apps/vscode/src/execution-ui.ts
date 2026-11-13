import { executionForecastText } from "../../../packages/core/src/execution-forecast.js";
import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { currentKnowledge, currentExecutionPlan, executionDependenciesReady, ownsExecutionLease, planFreshness, type ProjectSnapshot } from "../../../packages/core/src/index.js";
import { parseProviderConfiguration } from "../../../packages/core/src/inspection.js";
import { resolveCheckExecutable } from "./candidate-check-runner.js";
import { accountContextText } from "./codex-account-context.js";
import { ExecutionCoordinator, ExecutionReviewCancelled } from "./execution-coordinator.js";
import { nativeRecoveryDialogs, RecoveryUi, type RecoveryDialogs } from "./recovery-ui.js";
import type { ExecutionMessage } from "./execution-actions.js";

const escape = (value: string): string => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
const modeLabel = (mode: number | null): string => mode === null ? "absent" : mode.toString(8).padStart(4, "0");
function commands(value: string): readonly (readonly [string, ...string[]])[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 5) throw new Error("Enter 1 to 5 commands as JSON arrays of arguments.");
  return parsed.map((row: unknown) => {
    if (!Array.isArray(row) || row.length < 1 || row.length > 50) throw new Error("Each command needs an executable and its arguments.");
    const args = row.map((item: unknown) => { if (typeof item !== "string" || !item.trim() || item.length > 10_000) throw new Error("Command arguments must be nonempty strings."); return item; });
    const first = args[0]; if (!first) throw new Error("Choose an executable.");
    const executable = resolveCheckExecutable(first); if (!executable) throw new Error(`Executable unavailable: ${first}`);
    return [executable, ...args.slice(1)];
  });
}
function criterionText(value: string): readonly string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 50) throw new Error("Enter 1 to 50 criteria as a JSON array of text.");
  return parsed.map((item: unknown) => { if (typeof item !== "string" || !item.trim() || item.length > 10_000) throw new Error("Each criterion needs text of 1 to 10,000 characters."); return item; });
}

export class ExecutionUi {
  private preparing = false;
  private disposed = false;
  private readonly recovery: RecoveryUi;
  private readonly reviewing = new Set<string>();
  constructor(private readonly coordinator: ExecutionCoordinator, private readonly snapshot: () => ProjectSnapshot,
    private readonly showResult: (runId: string) => void, private readonly recoveryDialogs: RecoveryDialogs = nativeRecoveryDialogs) { this.recovery = new RecoveryUi(coordinator, () => this.current(), showResult, recoveryDialogs); }

  async handle(message: ExecutionMessage): Promise<void> {
    if (this.disposed || !vscode.workspace.isTrusted) return;
    try {
      switch (message.action) {
        case "pause-all": await this.coordinator.stopAll(); return;
        case "resume": this.coordinator.resume(); return;
        case "reconcile-all": await this.coordinator.reconcile(); return;
        case "prepare": await this.prepare(message.id); return;
        case "view": this.coordinator.refreshWorkspaceFreshness(); this.showResult(message.id); return;
        case "abandon-provider": await this.abandonProvider(message.id); return;
        case "stop": await this.coordinator.stop({ runId: message.id }); return;
        case "reconcile":
          await this.coordinator.reconcile();
          if (this.current()) this.showResult(message.id);
          return;
        case "apply-accept": await this.apply(message.id); return;
        case "recover": await this.recovery.resolve(message.id); return;
        case "saved-versions": await this.recovery.saved(message.id); return;
        case "restore-source": await this.restore(message.id, "source"); return;
        case "restore-candidate": await this.restore(message.id, "candidate"); return;
        case "open-candidate": await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(this.coordinator.inspection({ runId: message.id }).root), { forceNewWindow: true }); return;
        case "steer": {
          const run = this.snapshot().executionRuns.find(item => item.runId === message.id); if (!run) return;
          await this.coordinator.stop({ runId: run.runId });
          if (this.current()) await this.prepare(run.grant.plan.taskId);
          return;
        }
      }
    } catch (error) {
      if (error instanceof ExecutionReviewCancelled) return;
      if (this.current() && (message.action === "recover" || message.action === "saved-versions" || message.action === "restore-source" || message.action === "restore-candidate")) {
        await this.recoveryDialogs.inspect("Recovery needs review", error instanceof Error ? error.message : "Recovery remains unknown; inspect recorded work.", () => this.current());
        return;
      }
      if (this.current()) await vscode.window.showWarningMessage(`Piarre could not complete this operation. ${error instanceof Error ? error.message : "Review the current work state and try again."}`);
    }
  }

  private current(): boolean { return !this.disposed && vscode.workspace.isTrusted; }
  private async prepare(taskId: string): Promise<void> {
    if (this.preparing) return;
    this.preparing = true;
    try {
      const project = this.snapshot();
      const task = project.tasks.find(item => item.taskId === taskId); if (!task) return;
      const previous = currentExecutionPlan(project, taskId);
      const paths = await vscode.window.showInputBox({ prompt: "Exact existing or new files for this task, separated by commas", placeHolder: "src/refunds.js, test/refunds.test.js",
        value: previous?.files.map(file => file.relativePath).join(", ") ?? "", ignoreFocusOut: true,
        validateInput: value => value.trim() && !/[*?{}]/.test(value) ? undefined : "Enter exact relative file paths, without wildcard patterns." });
      if (paths === undefined || !this.current()) return;
      const encoded = await vscode.window.showInputBox({ prompt: "Approved check commands: JSON arrays of executable and arguments", placeHolder: '[["node","--test","--experimental-test-isolation=none","test/refunds.test.js"]]',
        value: previous ? JSON.stringify(previous.checks.map(check => check.argv)) : "", ignoreFocusOut: true,
        validateInput: value => { try { commands(value); return undefined; } catch (error) { return error instanceof Error ? error.message : "Enter commands as JSON arrays."; } } });
      if (encoded === undefined || !this.current()) return;
      const selectedCommands = commands(encoded);
      const linked = currentKnowledge(this.snapshot()).filter(entry => entry.affectedTaskIds.includes(taskId));
      let objective = previous?.objective ?? task.title;
      let texts = previous && planFreshness(this.snapshot(), previous) === "current" ? previous.criteria.map(criterion => criterion.text)
        : [...task.requirements.map(requirement => requirement.text), ...linked.map(entry => `${entry.topic}: ${entry.content.text}`)];
      const configuration = parseProviderConfiguration(vscode.workspace.getConfiguration("piarre").get<unknown>("providers", []));
      const coding = configuration.kind === "valid" ? configuration.selections.find(selection => selection.role === "coding") : undefined;
      if (coding && coding.provider !== "codex") throw new Error("This execution adapter supports Codex. Select Codex for coding before preparing this run.");
      while (this.current()) {
        const criteria = texts.map(text => ({ criterionId: randomUUID(), text }));
        const prepared = await this.coordinator.prepare({ taskId, relativePaths: paths.split(",").map(value => value.trim()).filter(Boolean), objective, criteria,
          checks: selectedCommands.map(argv => ({ checkId: randomUUID(), argv, criterionIds: criteria.map(criterion => criterion.criterionId) })),
          durationMs: Math.min(task.proposedBudget.maxElapsedMinutes * 60_000, 120_000), maxTokens: task.proposedBudget.maxTokens,
          ...(coding ? { requestedModel: coding.model } : {}) });
        if (!this.current()) return;
        if (prepared.capability.kind !== "supported") { await vscode.window.showWarningMessage(`This plan was saved without starting an agent. Checks are unavailable: ${prepared.capability.reason}`); return; }
        const plan = prepared.plan;
        const dependenciesReady = executionDependenciesReady(this.snapshot(), taskId);
        const canStart = dependenciesReady && !this.snapshot().schedulingPaused && !this.snapshot().executionRuns.some(ownsExecutionLease);
        const detail = `Goal: ${plan.objective}\n\nCriteria:\n${plan.criteria.map(item => `• ${item.text}`).join("\n")}\n\nShared and candidate-writable files:\n${plan.files.map(file => `${file.relativePath} (${file.kind === "existing" ? `${String(file.bytes)} bytes; SHA-256 ${file.sha256}` : "new file"})`).join("\n")}\n\nChecks:\n${plan.checks.map(check => JSON.stringify(check.argv)).join("\n")}\n\nProvider: Codex; ${plan.provider.authType} authentication; ${plan.provider.requestedModel}. ${accountContextText(plan.accountContext)} ${executionForecastText(plan.forecast)} One attempt; ${String(plan.durationMs / 1000)} seconds for local execution. Remote completion and continued usage may remain unconfirmed after disconnection; ${String(plan.maxTokens)} token target is soft.\n\nPiarre supplies this goal, criteria, captured files and linked knowledge. Codex’s own configured instructions and account context may also apply. Checks can read local files and write the isolated working copy; network and child processes are denied. Package-manager subprocesses need a separately supported runner. Output stays local.\n\nExisting Unix permission bits are preserved; new files use 0600. Special permission bits are unsupported. Changes are prepared in an isolated working copy. Applying repository changes needs separate result review. Stop can leave partial work; an unknown state requires reconciliation. Snapshots preserve scoped files; external services and provider charges cannot be rolled back.\n\nPlan ${plan.planId}, revision ${String(plan.recordedAtRevision)}. ${!dependenciesReady ? "Prerequisite acceptance or evidence is missing or stale. This plan can be kept for later review." : canStart ? "" : "New execution is currently paused or another run still owns work; this plan can be kept for later review."}`;
        const startLabel = "Approve and run";
        const choice = await vscode.window.showWarningMessage("Review scoped agent work", { modal: true, detail }, ...(canStart ? [startLabel, "Edit plan"] : ["Keep plan", "Edit plan"]));
        if (!this.current()) return;
        if (choice === startLabel && canStart) { await this.coordinator.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: randomUUID() }); return; }
        if (choice !== "Edit plan") return;
        const revised = await vscode.window.showInputBox({ prompt: "Goal for this attempt", value: objective, ignoreFocusOut: true, validateInput: value => value.trim() ? undefined : "Enter a goal." });
        if (revised === undefined || !this.current()) return;
        const revisedCriteria = await vscode.window.showInputBox({ prompt: "Current acceptance criteria as a JSON array of text", value: JSON.stringify(texts), ignoreFocusOut: true,
          validateInput: value => { try { criterionText(value); return undefined; } catch (error) { return error instanceof Error ? error.message : "Enter criteria as a JSON array."; } } });
        if (revisedCriteria === undefined || !this.current()) return;
        objective = revised; texts = [...criterionText(revisedCriteria)];
      }
    } finally { this.preparing = false; }
  }

  private async abandonProvider(runId: string): Promise<void> {
    const run = this.snapshot().executionRuns.find(item => item.runId === runId);
    if (!run || run.state.kind !== "unknown") return;
    const label = "Release uncertain request";
    const approved = await vscode.window.showWarningMessage("Allow replacement work while provider activity is unconfirmed?", { modal: true,
      detail: `${run.grant.plan.objective}\n\nRun ${runId} may still be active at Codex. Local connection disposal and an interrupt acknowledgment do not confirm remote completion. Charges or allowance use may continue. Releasing this request permits another separately approved run and may overlap provider usage. It does not accept generated changes, prove termination, or undo charges.` }, label);
    if (approved !== label || !this.current()) return;
    this.coordinator.abandonProvider({ runId, reason: "User explicitly acknowledged unconfirmed remote activity and possible overlapping usage in the native review dialog." });
    this.showResult(runId);
  }
  private async apply(runId: string): Promise<void> {
    if (this.reviewing.has(runId)) return;
    this.reviewing.add(runId);
    try {
      this.coordinator.refreshWorkspaceFreshness();
      const observed = this.coordinator.inspection({ runId }); const run = observed.run;
      if (run.state.kind !== "terminal" || run.state.result.outcome !== "needs-review") throw new Error("This run has no current result ready for acceptance.");
      const result = run.state.result;
      const approved = await vscode.window.showWarningMessage("Apply and accept this result?", { modal: true,
        detail: `${run.grant.plan.objective}\n\nRepository files:\n${observed.integration.changes.map(change => `${change.relativePath} (permissions ${modeLabel(change.beforeMode)} → ${modeLabel(change.afterMode)})`).join("\n") || "No file changes"}\n\nReview the exact diff and criterion-bound check outputs first. Current source files must still match their captured versions. A scoped source snapshot is preserved before applying changes. Unsaved or conflicting work blocks application. External services and charges are outside restore scope.\n\nResult ${result.resultId}, revision ${String(result.recordedAtRevision)}; manifest SHA-256 ${result.manifestHash}.` }, "Apply and accept");
      if (approved !== "Apply and accept" || !this.current()) return;
      await this.coordinator.applyAndAccept({ runId, resultId: result.resultId, resultRevision: result.recordedAtRevision, operationId: randomUUID() });
      if (this.current()) this.showResult(runId);
    } finally { this.reviewing.delete(runId); }
  }

  private async restore(runId: string, target: "source" | "candidate"): Promise<void> {
    const run = this.snapshot().executionRuns.find(item => item.runId === runId); if (!run) return;
    const checkpointId = target === "candidate" ? run.grant.plan.baselineCheckpoint.checkpointId
      : run.workspace.kind === "integrated" ? `integration-before:${run.workspace.operationId}` : undefined;
    if (!checkpointId) throw new Error("No source checkpoint is recorded for this result.");
    const version = run.savedVersions.find(version => version.checkpointId === checkpointId && version.target === target);
    if (!version) throw new Error("The snapshot is not registered to this run.");
    await this.recovery.review(runId, { kind: "snapshot", target, versionId: version.versionId });
  }

  renderDetails(runId: string): string {
    try {
      const observed = this.coordinator.inspection({ runId });
      const sourceStatus = observed.run.workspace.kind === "integrated" && observed.integration.sourceManifestHash === observed.run.workspace.manifestHash ? "Matches the applied result" : observed.original.kind === "unchanged" ? "Matches the captured baseline" : "Changed since capture; review before applying";
      return `<section aria-label="Exact candidate changes"><h2>Exact changes</h2><p>Working copy: ${escape(observed.root)}</p><p>Original repository: ${escape(observed.sourceRoot)} · ${escape(sourceStatus)}</p>${observed.diff.map(change => `<details data-review-key="file:${escape(change.relativePath)}"><summary>${escape(change.relativePath)}</summary><p>Permissions: ${modeLabel(change.beforeMode)} → ${modeLabel(change.afterMode)}</p><h3>Captured original</h3><pre>${escape(change.before ?? "File absent")}</pre><h3>Current working copy</h3><pre>${escape(change.after ?? "File absent")}</pre></details>`).join("") || "<p>No changed scoped files.</p>"}</section>`;
    } catch { return "<p>Scoped files are unavailable for inspection. Reconcile the recorded run before relying on its result.</p>"; }
  }

  refresh(): void { if (this.current()) this.coordinator.refreshWorkspaceFreshness(); }

  dispose(): void { this.disposed = true; this.coordinator.dispose(); }
}
