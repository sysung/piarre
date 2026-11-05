import { conversationHistory, defaultSessionId, executionReviewCurrent, ownsExecutionLease, type ProjectSnapshot } from "../../../packages/core/src/index.js";
import { activeRecovery } from "../../../packages/core/src/recovery.js";

export function sessionStatus(project: ProjectSnapshot, sessionId: string): string {
  const turn = conversationHistory(project, sessionId).at(-1);
  const tasks = project.proposals.filter(group => (group.sessionId ?? defaultSessionId) === sessionId).flatMap(group => group.taskIds);
  const recentRuns = [...project.executionRuns].reverse();
  const runs = tasks.map(taskId => recentRuns.find(run => run.grant.plan.taskId === taskId));
  if (runs.some(run => run && (run.state.kind === "unknown" || run.workspace.kind === "unknown" || activeRecovery(run)?.state.kind === "unknown"))) return "Something went wrong";
  if (turn?.kind === "pending" || runs.some(run => run && ownsExecutionLease(run))) return "Reply or work in progress";
  if (turn?.kind === "failed" || turn?.kind === "unknown" || runs.some(run => run?.state.kind === "terminal" && (run.state.result.outcome === "failed" || run.state.result.outcome === "unknown"))) return "Something went wrong";
  if (turn?.kind === "interrupted" || runs.some(run => run && (!executionReviewCurrent(project, run) || run.state.kind === "terminal" && run.state.result.outcome === "needs-review" && run.acceptance.kind === "unreviewed"))) return "Needs your attention";
  return tasks.length > 0 && runs.every(run => run?.state.kind === "terminal" && executionReviewCurrent(project, run) && run.acceptance.kind === "accepted" && run.acceptance.resultId === run.state.result.resultId && run.acceptance.resultRevision === run.state.result.recordedAtRevision) ? "Complete" : "In progress";
}
