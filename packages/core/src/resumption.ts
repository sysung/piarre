import type { ProjectSnapshot } from "./index.js";
import { currentKnowledge, knowledgeConflicts } from "./knowledge.js";
import { ownsExecutionLease, planFreshness } from "./execution.js";

export type VisitBaseline = { readonly kind: "first-visit" } | { readonly kind: "previous-visit"; readonly snapshot: ProjectSnapshot } | { readonly kind: "unavailable"; readonly reason: string };
export interface ResumptionFact {
  readonly category: "accomplishment" | "next" | "open" | "change";
  readonly text: string;
  readonly source: { readonly kind: "knowledge" | "proposal" | "plan" | "run" | "project" | "conversation"; readonly recordId: string; readonly revision: number };
}
export interface ProjectResumption {
  readonly baseline: VisitBaseline["kind"];
  readonly facts: readonly ResumptionFact[];
  readonly gaps: readonly string[];
}

/** A projection of recorded work, never an authorization or a claim about the workspace. */
export function resumeProject(project: ProjectSnapshot, baseline: VisitBaseline): ProjectResumption {
  if (baseline.kind === "previous-visit" && (baseline.snapshot.projectId !== project.projectId || baseline.snapshot.revision > project.revision)) throw new Error("Invalid visit baseline");
  const facts: ResumptionFact[] = [];
  const prior = baseline.kind === "previous-visit" ? baseline.snapshot : undefined;
  const add = (category: ResumptionFact["category"], text: string, kind: ResumptionFact["source"]["kind"], recordId: string, revision: number): void => { facts.push({ category, text, source: { kind, recordId, revision } }); };
  for (const proposal of project.proposals) {
    if (prior && proposal.recordedAtRevision > prior.revision) add("change", `Saved goal: ${proposal.goal}. This is a proposal, not execution.`, "proposal", proposal.groupId, proposal.recordedAtRevision);
  }
  if (prior) {
    for (const proposal of prior.proposals.filter(old => !project.proposals.some(item => item.groupId === old.groupId))) add("change", `Removed saved goal: ${proposal.goal}. Original record remains in project history.`, "proposal", proposal.groupId, proposal.recordedAtRevision);
    if (project.name !== prior.name) add("change", `Project renamed from ${prior.name} to ${project.name}.`, "project", project.projectId, project.revision);
    if (project.schedulingPaused !== prior.schedulingPaused) add("change", `Scheduling ${project.schedulingPaused ? "paused" : "resumed"}.`, "project", project.projectId, project.revision);
  }
  for (const entry of project.knowledge.filter(item => prior && item.recordedAtRevision > prior.revision)) {
    add("change", `${entry.topic}: ${entry.content.text} (${entry.standing.kind}; ${entry.supersedes === null ? "new observation" : `supersedes revision ${String(entry.supersedes)}`}).`, "knowledge", entry.knowledgeId, entry.recordedAtRevision);
  }
  for (const entry of currentKnowledge(project)) {
    if (entry.standing.kind !== "confirmed" || knowledgeConflicts(project, entry).length) add("open", `${entry.topic}: ${entry.standing.kind !== "confirmed" ? "awaiting explicit confirmation" : "conflicting confirmed statements remain unresolved"}.`, "knowledge", entry.knowledgeId, entry.recordedAtRevision);
  }
  for (const turn of project.conversation) {
    if (prior && JSON.stringify(prior.conversation.find(old => old.submitted.requestId === turn.submitted.requestId)) !== JSON.stringify(turn)) add("change", `Discussion ${turn.submitted.requestId}: ${turn.kind}. Replies remain inferences; inspect frozen citations and historical-source warnings in Discussion.`, "conversation", turn.submitted.requestId, project.revision);
  }
  for (const task of project.tasks) {
    const plan = project.executionPlans.filter(item => item.taskId === task.taskId).at(-1);
    if (!plan) {
      const proposal = project.proposals.find(item => item.groupId === task.groupId);
      if (proposal) add("next", `Prepare and review an execution plan for ${task.title}.`, "proposal", proposal.groupId, proposal.recordedAtRevision);
    } else if (planFreshness(project, plan) !== "current") add("next", `Review ${task.title}: plan ${plan.planId} is ${planFreshness(project, plan)}. Prior approvals and results cannot demonstrate the corrected rule.`, "plan", plan.planId, plan.recordedAtRevision);
    else if (!project.executionRuns.some(run => run.grant.plan.planId === plan.planId)) add("next", `Review the proposed plan for ${task.title}; no run approval is recorded.`, "plan", plan.planId, plan.recordedAtRevision);
  }
  for (const run of project.executionRuns) {
    const revision = project.revision;
    const old = prior?.executionRuns.find(item => item.runId === run.runId);
    if (prior && JSON.stringify(old) !== JSON.stringify(run)) add("change", `Run ${run.runId}: ${old?.state.kind ?? "not recorded"} → ${run.state.kind}; review freshness ${run.reviewFreshness.kind}.`, "run", run.runId, project.revision);
    if (run.acceptance.kind === "accepted") add("accomplishment", `Accepted result ${run.acceptance.resultId} from run ${run.runId}. Current plan: ${planFreshness(project, run.grant.plan)}; review: ${run.reviewFreshness.kind}. Acceptance records a human decision, not new verification.`, "run", run.runId, revision);
    else if (run.state.kind === "terminal") add("open", `Run ${run.runId} recorded ${run.state.result.outcome}: ${run.state.result.summary}. Result is ${run.reviewFreshness.kind}, acceptance ${run.acceptance.kind}.`, "run", run.runId, revision);
    if (ownsExecutionLease(run)) add("open", `Run ${run.runId}: ${run.state.kind}; process ${run.process.kind}; workspace ${run.workspace.kind}. Writer ownership/reconciliation is separate from memory freshness (${run.reviewFreshness.kind}).`, "run", run.runId, project.revision);
  }
  return { baseline: baseline.kind, facts, gaps: [
    ...(baseline.kind === "unavailable" ? [`Prior visit unavailable: ${baseline.reason}. Changes cannot be determined.`] : baseline.kind === "first-visit" ? ["No prior visit recorded. Current records are shown without inventing a delta."] : []),
    "Coverage is limited to canonical project records and explicit knowledge/task/plan/grant/result links. Missing links cannot establish that work is unaffected.",
    "No compiler, language dependency, semantic contradiction or deployed-state coverage is claimed. Workspace sources must be rechecked through project lookup before consequential claims.",
  ] };
}

export function knowledgeWorkImpact(project: ProjectSnapshot, knowledgeId: string) {
  const entry = currentKnowledge(project).find(item => item.knowledgeId === knowledgeId);
  if (!entry) return [];
  return project.executionPlans.filter(plan => entry.affectedTaskIds.includes(plan.taskId) || plan.knowledge.some(version => version.knowledgeId === knowledgeId)).map(plan => ({
    plan, freshness: planFreshness(project, plan), runs: project.executionRuns.filter(run => run.grant.plan.planId === plan.planId),
  }));
}
