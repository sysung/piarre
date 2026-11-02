import { currentExecutionPlan, ownsExecutionLease, planFreshness, type CheckEvidence, type ExecutionPlan, type ExecutionRun, type ProjectSnapshot } from "../../../packages/core/src/index.js";

const escape = (value: string): string => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
const button = (action: string, label: string, id?: string): string => `<button type="button" data-execution-action="${escape(action)}"${id === undefined ? "" : ` data-execution-id="${escape(id)}"`}>${escape(label)}</button>`;
const title = (project: ProjectSnapshot, run: ExecutionRun): string => project.tasks.find(task => task.taskId === run.grant.plan.taskId)?.title ?? run.grant.plan.objective;
const current = (project: ProjectSnapshot, run: ExecutionRun): boolean => planFreshness(project, run.grant.plan) === "current" && run.reviewFreshness.kind === "current";

function status(project: ProjectSnapshot, run: ExecutionRun): string {
  if (run.workspace.kind === "unknown") return "Workspace state unknown · reconcile before continuing";
  if (run.workspace.kind === "writing") return "Workspace operation in progress";
  switch (run.state.kind) {
    case "reserved": return "Approved · generation not requested";
    case "generating": return "Generating candidate · not verified";
    case "applying": return "Piarre applying candidate · not verified";
    case "checking": return "Piarre checking candidate · acceptance pending";
    case "unknown": return "Run state unknown · stop is not confirmed";
    case "terminal": {
      if (!current(project, run)) return "Historical result · current behavior not verified";
      if (run.acceptance.kind === "accepted") return "Accepted result · scoped checks recorded";
      switch (run.state.result.outcome) {
        case "needs-review": return "Checks completed · review and acceptance needed";
        case "failed": return "Run finished · checks or generation failed";
        case "no-change": return "Run finished · no change reported";
        case "unknown": return "Run finished · outcome unknown";
      }
    }
  }
}

export function taskExecutionStatus(project: ProjectSnapshot, taskId: string): string {
  const run = project.executionRuns.filter(item => item.grant.plan.taskId === taskId).at(-1);
  if (run) return status(project, run);
  const plan = currentExecutionPlan(project, taskId);
  return plan ? `Prepared plan · ${planFreshness(project, plan)} · approval required` : "Proposed · execution not approved";
}

export function renderExecutionControls(project: ProjectSnapshot): string {
  const active = project.executionRuns.filter(ownsExecutionLease);
  return `<section aria-label="Execution controls"><p>${project.schedulingPaused ? "New runs are paused. Existing work may still be active." : "Each run needs separate approval. Only 1 run can hold the execution lease."}</p>${button(project.schedulingPaused ? "resume" : "pause-all", project.schedulingPaused ? "Resume scheduling" : "Pause new runs")}${active.map(run => `<article><p><strong>${escape(title(project, run))}</strong> · ${escape(status(project, run))}</p><p>Execution lease retained. ${run.state.kind === "unknown" || run.workspace.kind === "unknown" ? "Termination or workspace completion is unconfirmed. Reconcile the recorded state before starting another run." : "Stop requests cancellation; confirmation requires an observed terminal state."}</p>${button("view", "Review run", run.runId)}${button("stop", "Stop run", run.runId)}${button("reconcile", "Reconcile state", run.runId)}${button("steer", "Steer next attempt", run.runId)}</article>`).join("")}</section>`;
}

function planDetails(plan: ExecutionPlan): string {
  return `<details><summary>Exact plan, files, and limits</summary><p>Plan ${escape(plan.planId)} · revision ${String(plan.recordedAtRevision)} · task ${escape(plan.taskId)}</p><p>${escape(plan.objective)}</p><p>Provider: Codex read-only patch. Authentication: ${escape(plan.provider.authType)}. Requested model: ${escape(plan.provider.requestedModel ?? "provider default; not confirmed")}. Cost and actual token usage: unknown.</p><p>1 attempt. Hard elapsed limit: ${String(plan.durationMs / 1000)} seconds (maximum 2 minutes). Token target: ${String(plan.maxTokens)} tokens, soft and not enforced by the provider.</p><p>Piarre supplies captured file contents, the objective, criteria, and bound knowledge. Codex’s configured instructions and account context may also apply. Checks execute locally in the candidate workspace. Review exact scope before approval.</p><p>Source: ${escape(plan.sourceRoot)}<br>Candidate: ${escape(plan.candidateRoot)}<br>Capture SHA-256: ${escape(plan.captureHash)}<br>Recorded candidate checkpoint: ${escape(plan.baselineCheckpoint.checkpointId)} · manifest SHA-256 ${escape(plan.baselineCheckpoint.manifestHash)}. Preview checks availability before restore.</p><ul>${plan.files.map(file => `<li>${escape(file.relativePath)} · file ${escape(file.fileId)} · ${file.kind === "existing" ? `SHA-256 ${escape(file.sha256)} · ${String(file.bytes)} bytes` : "absent at capture"}</li>`).join("")}</ul><p>Bound knowledge versions: ${plan.knowledge.length === 0 ? "none recorded" : plan.knowledge.map(version => `${escape(version.knowledgeId)} at revision ${String(version.recordedAtRevision)} in ${escape(version.projectId)}`).join("; ")}</p><ul>${plan.checks.map(check => `<li>${escape(check.checkId)}: <code>${escape(JSON.stringify(check.argv))}</code> · criteria ${escape(check.criterionIds.join(", "))}</li>`).join("")}</ul></details>`;
}

function agentCards(project: ProjectSnapshot): string {
  const active = project.executionRuns.filter(ownsExecutionLease);
  const runs = [...active, ...project.executionRuns.filter(run => !ownsExecutionLease(run)).slice(-10).reverse()];
  return `<section aria-label="Known agent sessions"><h3>Agents and assignments</h3><p>Active Piarre-managed work and up to 10 recent coding sessions. Unattached sessions in other tools are not observed.</p>${runs.map(run => {
    const provider = run.providerTurn;
    const session = provider.kind === "turn" ? `${provider.threadId} / ${provider.turnId}` : provider.kind === "thread" ? provider.threadId : provider.kind === "unacknowledged" ? "Request sent; acknowledgment unavailable" : "Not started";
    const observed = Math.max(run.grant.approvedAt, ...run.evidence.map(item => item.observedAt), run.workspace.kind === "integrated" || run.workspace.kind === "restored" ? run.workspace.observedAt : 0);
    return `<article><h4>Codex · Coding worker</h4><dl><dt>Assigned work</dt><dd>${escape(title(project, run))}</dd><dt>Current recorded activity</dt><dd>${escape(status(project, run))}</dd><dt>Scope</dt><dd>${escape(run.grant.plan.files.map(file => file.relativePath).join(", "))}</dd><dt>Session</dt><dd>${escape(session)}</dd><dt>Latest timestamped record</dt><dd>${escape(new Date(observed).toISOString())}. This is not a continuous liveness signal.</dd><dt>Needs your decision</dt><dd>${run.workspace.kind === "unknown" || run.state.kind === "unknown" ? "Reconcile the recorded effects before replacement work." : run.state.kind === "terminal" && run.state.result.outcome === "needs-review" && run.acceptance.kind !== "accepted" ? "Review the exact changes and evidence." : run.state.kind === "terminal" ? "Inspect the recorded outcome before deciding on another attempt." : "Observe progress or request a stop; no new approval is inferred."}</dd></dl>${button("view", "Inspect work", run.runId)}${ownsExecutionLease(run) ? button("stop", "Stop run", run.runId) : ""}</article>`;
  }).join("") || "<p>No agent sessions are recorded. Review a task’s scope to start work.</p>"}</section>`;
}

export function renderExecutionDesk(project: ProjectSnapshot): string {
  const plans = project.executionPlans.slice(-5).reverse();
  const runs = project.executionRuns.slice(-10).reverse();
  return `<section aria-label="Agent work overview"><h2>Work overview</h2>${agentCards(project)}<h3>Task queue</h3><p>Review a task’s exact scope before approving generation. Check completion, verification, and acceptance are separate decisions.</p>${project.tasks.length === 0 ? "<p>Save a task proposal to prepare a bounded coding run.</p>" : ""}${project.tasks.map(task => `<article><h3>${escape(task.title)}</h3><p>${escape(taskExecutionStatus(project, task.taskId))}</p>${button("prepare", "Review run plan", task.taskId)}</article>`).join("")}<details><summary>Recent plans (${String(plans.length)} of ${String(project.executionPlans.length)})</summary>${plans.map(plan => `<article><p>${escape(plan.objective)} · ${escape(planFreshness(project, plan))} · approval is separate</p>${planDetails(plan)}</article>`).join("") || "<p>Prepare a task to capture exact files and checks for review.</p>"}</details><h3>Recent runs</h3>${runs.map(run => `<article><p>${escape(title(project, run))} · ${escape(status(project, run))}</p>${button("view", "Review run", run.runId)}</article>`).join("") || "<p>Approved runs and their evidence will appear here.</p>"}</section>`;
}

function boundEvidence(run: ExecutionRun, criterionId: string): readonly CheckEvidence[] {
  if (run.state.kind !== "terminal") return [];
  const manifestHash = run.state.result.manifestHash;
  return run.state.result.checks.filter(evidence => evidence.manifestHash === manifestHash && evidence.criterionIds.includes(criterionId) && run.grant.plan.checks.some(check => check.checkId === evidence.checkId && JSON.stringify(check.argv) === JSON.stringify(evidence.argv) && JSON.stringify(check.criterionIds) === JSON.stringify(evidence.criterionIds)));
}

export function renderExecutionResult(project: ProjectSnapshot, runId: string): string {
  const run = project.executionRuns.find(item => item.runId === runId);
  if (!run) return "<section aria-label=\"Execution review\"><h2>Run unavailable</h2><p>This run is not in the current project snapshot. Open a recorded run from the execution desk.</p></section>";
  const result = run.state.kind === "terminal" ? run.state.result : undefined;
  const isCurrent = current(project, run);
  const canReview = result?.outcome === "needs-review" && isCurrent && run.acceptance.kind === "unreviewed" && !project.schedulingPaused && !project.executionRuns.some(ownsExecutionLease);
  const criteria = run.grant.plan.criteria.map(criterion => {
    const evidence = boundEvidence(run, criterion.criterionId);
    const outcome = evidence.length === 0 ? "Not tested" : evidence.some(item => item.kind === "failed") ? "Failed" : evidence.every(item => item.kind === "passed" && item.termination === "observed" && item.exitCode === 0 && item.signal === null) ? "Passed scoped checks" : "Not verified";
    return `<li><strong>${escape(criterion.text)}</strong> · ${!isCurrent && evidence.length ? "Historical evidence: " : ""}${outcome}<br>Criterion ${escape(criterion.criterionId)} · ${evidence.length ? `bound checks ${escape(evidence.map(item => item.checkId).join(", "))}` : "no matching result evidence"}</li>`;
  }).join("");
  const checks = (result?.checks ?? run.evidence).map(evidence => `<details><summary>${escape(evidence.checkId)} · ${escape(evidence.kind)} · termination ${escape(evidence.termination)}</summary><p>Criteria: ${escape(evidence.criterionIds.join(", "))}<br>Command: <code>${escape(JSON.stringify(evidence.argv))}</code><br>Exit: ${evidence.exitCode === null ? "unknown" : String(evidence.exitCode)} · signal: ${escape(evidence.signal ?? "none recorded")}<br>Manifest SHA-256: ${escape(evidence.manifestHash)}<br>Observed at: ${String(evidence.observedAt)} · nonce ${escape(evidence.nonce)}</p><p>Standard output</p><pre>${escape(evidence.stdout)}</pre><p>Standard error</p><pre>${escape(evidence.stderr)}</pre></details>`).join("");
  const actions = `${button("open-candidate", "Open candidate", runId)}${button("steer", "Steer next attempt", runId)}${canReview && (run.workspace.kind === "not-integrated" || run.workspace.kind === "integrated") ? button("apply-accept", run.workspace.kind === "integrated" ? "Accept current result" : "Apply and accept", runId) : ""}${run.workspace.kind === "integrated" && !project.schedulingPaused && !project.executionRuns.some(ownsExecutionLease) ? button("restore-source", "Restore source checkpoint", runId) : ""}${!ownsExecutionLease(run) && run.state.kind === "terminal" && !project.schedulingPaused && !project.executionRuns.some(ownsExecutionLease) ? button("restore-candidate", "Preview recorded snapshot", runId) : ""}`;
  return `<section aria-label="Execution review"><h2>${escape(title(project, run))}</h2><p><strong>${escape(status(project, run))}</strong></p><p>${!isCurrent ? "This is historical evidence. Changed knowledge, source, or plan invalidates current verification. Prepare and approve a new attempt before relying on it." : result?.outcome === "needs-review" ? "Review the exact candidate and scoped evidence. Applying changes and accepting this result requires your explicit decision; passing checks does not establish every requirement." : "Review the recorded state and evidence before deciding on another attempt."}</p>${run.reviewFreshness.kind === "stale" ? `<p>${escape(run.reviewFreshness.reason)}</p>` : ""}<p>Workspace: ${escape(run.workspace.kind)}. Acceptance: ${escape(run.acceptance.kind)}.</p>${result ? `<p>${escape(result.summary)}</p><p>Result ${escape(result.resultId)} · revision ${String(result.recordedAtRevision)} · manifest SHA-256 ${escape(result.manifestHash)}</p>` : "<p>No terminal result recorded. Generation or check progress is not acceptance.</p>"}${actions}<h3>Criteria and bound evidence</h3><ul>${criteria}</ul><h3>Recorded checks</h3>${checks || "<p>No check evidence recorded. Criteria remain untested.</p>"}${planDetails(run.grant.plan)}<details><summary>Approval and runtime identity</summary><p>Approval ${escape(run.grant.approvalId)} · approved at ${String(run.grant.approvedAt)} · expires at ${String(run.grant.expiresAt)} · deadline ${String(run.grant.deadlineAt)}<br>Run ${escape(run.runId)} · owner ${escape(run.ownerId)} · process ${String(run.ownerPid)}<br>Provider acknowledgment: ${escape(run.providerTurn.kind)} · local check process: ${escape(run.process.kind)}</p><p>Stop requests do not prove termination. Unknown state retains the execution lease until reconciliation.</p></details></section>`;
}
