import type { ProjectEvent, ProjectSnapshot } from "../../../packages/core/src/index.js";
import { currentKnowledge } from "../../../packages/core/src/knowledge.js";

export const activityEventKinds = ["project-created", "project-renamed", "proposal-created", "proposal-deleted", "knowledge-observed", "knowledge-confirmed", "knowledge-corrected", "conversation-started", "conversation-replied", "conversation-ended"] as const;
export const activityExecutionKinds = {
  "prepare-execution-plan": "Run plan prepared · not approved",
  "approve-execution": "Coding run approved",
  "request-execution": "Coding generation requested · completion not established",
  "observe-execution-terminal": "Provider terminal state observed",
  "abandon-execution-provider": "Provider ownership released · remote activity and usage remain unconfirmed",
  "begin-candidate-apply": "Candidate application started",
  "record-execution-check": "Check evidence recorded",
  "mark-execution-unknown": "Coding state unknown · reconciliation required",
  "reconcile-execution-process": "Check process reconciled",
  "finish-execution": "Coding result recorded · acceptance is separate",
  "accept-execution-result": "Exact coding result accepted by user",
  "begin-workspace-operation": "Workspace operation requested",
  "finish-workspace-operation": "Workspace operation observed complete",
  "mark-workspace-unknown": "Workspace state unknown · reconciliation required",
  "abandon-workspace-operation": "Workspace operation released · outcome remains uncertain",
  "begin-recovery": "Reviewed recovery started",
  "finish-recovery": "Recovery observed complete",
  "mark-recovery-unknown": "Recovery state unknown · reconciliation required",
  "invalidate-execution-workspace": "Workspace evidence invalidated",
  "set-scheduling-paused": "Scheduling preference recorded",
} as const;
export const activityCoordinationOperations = {
  prepare: "Read-only assignments prepared · not approved",
  approve: "Read-only assignments approved",
  start: "Read-only assignment started",
  stop: "Assignment stop requested · completion not established",
  finish: "Read-only assignment terminal observation recorded",
  compare: "Assignment comparison recorded · not independent verification",
  "review-unknown": "Unknown assignment reviewed",
} as const;

export interface ActivityQuery { readonly beforeRevision?: number; readonly limit: number }
export interface ActivityLink {
  readonly kind: "proposal" | "task" | "run" | "plan" | "knowledge" | "assignment" | "conversation" | "file";
  readonly recordId: string;
  readonly revision: number;
}
export interface ActivityMilestone {
  readonly revision: number;
  readonly summary: string;
  readonly links: readonly ActivityLink[];
  readonly omittedLinks: number;
}
export interface ActivityPage { readonly entries: readonly ActivityMilestone[]; readonly nextBeforeRevision: number | null }

export function activityMilestone(event: ProjectEvent, revision: number): ActivityMilestone | undefined {
  const links: ActivityLink[] = [];
  const link = (kind: ActivityLink["kind"], recordId: string, sourceRevision = revision): void => { links.push({ kind, recordId, revision: sourceRevision }); };
  let summary: string;
  switch (event.kind) {
    case "project-created": summary = "Project opened"; break;
    case "project-renamed": summary = "Project renamed"; break;
    case "proposal-created":
      summary = "Task proposal saved · not approved";
      link("proposal", event.group.groupId);
      for (const task of event.tasks) link("task", task.taskId);
      break;
    case "proposal-deleted": summary = "Proposal removed from current work · history retained"; link("proposal", event.groupId); break;
    case "knowledge-observed": summary = "Knowledge statement recorded · unconfirmed"; link("knowledge", event.knowledgeId); break;
    case "knowledge-confirmed": summary = "Knowledge confirmed by user · not independent verification"; link("knowledge", event.target.knowledgeId); link("knowledge", event.target.knowledgeId, event.target.recordedAtRevision); break;
    case "knowledge-corrected": summary = "Knowledge corrected by user · prior evidence may be historical"; link("knowledge", event.target.knowledgeId); link("knowledge", event.target.knowledgeId, event.target.recordedAtRevision); break;
    case "conversation-started": summary = "Submitted discussion started · no execution approval"; link("conversation", event.submitted.requestId); break;
    case "conversation-replied": summary = "Discussion reply recorded · inferred"; link("conversation", event.requestId); break;
    case "conversation-ended": summary = `Discussion ended · ${event.outcome}`; link("conversation", event.requestId); break;
    case "execution-recorded": {
      const action = event.action;
      if (!(action.kind in activityExecutionKinds)) return undefined;
      summary = Object.entries(activityExecutionKinds).find(([kind]) => kind === action.kind)?.[1] ?? "Execution milestone";
      if (action.kind === "prepare-execution-plan") {
        link("plan", `plan:${event.commandId}`); link("task", action.plan.taskId);
        for (const source of action.plan.knowledge) link("knowledge", source.knowledgeId, source.recordedAtRevision);
      } else if ("runId" in action) {
        link("run", action.runId);
        if (action.kind === "approve-execution") link("plan", action.planId, action.planRevision);
      }
      if (action.kind === "observe-execution-terminal") summary += ` · ${action.status}`;
      if (action.kind === "record-execution-check") summary += ` · ${action.evidence.kind}`;
      if (action.kind === "finish-execution") summary += ` · ${action.outcome}`;
      if (action.kind === "set-scheduling-paused") summary = action.paused ? "New scheduling paused" : "New scheduling enabled · no work approved";
      break;
    }
    case "coordination-recorded": {
      const action = event.action;
      if (!(action.operation in activityCoordinationOperations)) return undefined;
      summary = Object.entries(activityCoordinationOperations).find(([kind]) => kind === action.operation)?.[1] ?? "Assignment milestone";
      if (action.operation === "prepare") {
        link("task", action.parentTaskId);
        for (const worker of action.workers) link("assignment", worker.assignmentId);
        for (const source of action.sources) link(source.reference.kind, source.reference.recordId, source.reference.revision);
      } else if ("assignmentId" in action) link("assignment", action.assignmentId);
      if (action.operation === "finish") summary += ` · ${action.outcome}`;
      break;
    }
    default: return undefined;
  }
  return { revision, summary, links: links.slice(0, 16), omittedLinks: Math.max(0, links.length - 16) };
}

const escape = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

function renderLink(project: ProjectSnapshot, source: ActivityLink, key: string): string {
  const id = escape(source.recordId);
  let standing: string;
  let navigation = "";
  if (source.kind === "proposal" || source.kind === "task") {
    const proposal = source.kind === "proposal" ? project.proposals.find(item => item.groupId === source.recordId)
      : project.proposals.find(item => item.taskIds.includes(source.recordId));
    standing = !proposal ? "Historical or missing · removed from current work" : proposal.recordedAtRevision === source.revision ? "Exact current record" : `Historical observation · current proposal recorded at revision ${String(proposal.recordedAtRevision)}`;
    if (proposal) navigation = `<button type="button" data-open-goal="${escape(proposal.groupId)}">Open current ${source.kind === "task" ? "task and proposal" : "proposal"}</button>`;
  } else if (source.kind === "knowledge") {
    const current = currentKnowledge(project).find(item => item.knowledgeId === source.recordId);
    standing = !current ? "Historical or missing · current knowledge unavailable" : current.recordedAtRevision === source.revision ? `Exact current record · ${current.standing.kind}` : `Historical source · current knowledge is revision ${String(current.recordedAtRevision)}`;
    if (current) navigation = `<button type="button" data-activity-knowledge="${id}">Inspect knowledge versions</button>`;
  } else if (source.kind === "run") {
    const run = project.executionRuns.find(item => item.runId === source.recordId);
    standing = !run ? "Historical or missing · current run unavailable" : `Historical observation · current run ${run.state.kind}; review ${run.reviewFreshness.kind}; ${run.acceptance.kind}`;
    if (run) navigation = `<button type="button" data-execution-action="view" data-execution-id="${id}">Open current run and result</button>`;
  } else if (source.kind === "plan") {
    const plan = project.executionPlans.find(item => item.planId === source.recordId);
    standing = !plan ? "Historical or missing · current plan unavailable" : plan.recordedAtRevision === source.revision ? "Exact recorded plan · approval and current applicability are separate" : `Historical observation · plan recorded at revision ${String(plan.recordedAtRevision)}`;
    if (plan) navigation = `<dl><dt>Recorded objective</dt><dd>${escape(plan.objective)}</dd><dt>Task</dt><dd>${escape(plan.taskId)}</dd><dt>Criteria</dt><dd>${plan.criteria.map(item => escape(item.criterionId) + ": " + escape(item.text)).join("; ")}</dd><dt>Captured files</dt><dd>${plan.files.map(item => escape(item.relativePath)).join("; ") || "None recorded"}</dd><dt>Bound knowledge revisions</dt><dd>${plan.knowledge.map(item => escape(item.knowledgeId) + " at revision " + String(item.recordedAtRevision)).join("; ") || "None recorded"}</dd></dl><p>Recorded plan only. File freshness, execution, verification and acceptance require their separate observations.</p>`;
    const task = plan && project.tasks.find(item => item.taskId === plan.taskId);
    if (task) navigation += `<button type="button" data-open-goal="${escape(task.groupId)}">Open current task proposal</button>`;
  } else if (source.kind === "assignment") {
    const group = project.coordination.groups.find(item => item.assignments.some(worker => worker.assignmentId === source.recordId));
    const worker = group?.assignments.find(item => item.assignmentId === source.recordId);
    standing = worker && group ? `Historical observation · assignment prepared at revision ${String(group.preparedAtRevision)}; current state ${worker.state.kind}` : "Historical or missing · current assignment unavailable";
    if (worker) navigation = `<button type="button" data-activity-assignment="${id}">Inspect current assignment</button>`;
  } else if (source.kind === "conversation") {
    const turn = project.conversation.find(item => item.submitted.requestId === source.recordId);
    standing = turn ? `Historical observation · current discussion ${turn.kind}; inference never approves execution` : "Historical or missing · discussion unavailable";
  } else {
    const group = project.coordination.groups.find(item => item.sources.some(entry => entry.reference.kind === "file" && entry.reference.recordId === source.recordId && entry.reference.revision === source.revision));
    standing = group ? "Captured file source · historical bytes; current file freshness has not been revalidated" : "Historical or missing · captured file source unavailable";
    if (group) navigation = `<button type="button" data-activity-disclosure="${escape(group.groupId)}-sources">Inspect captured source and provenance</button>`;
  }
  return `<details data-activity-source="${key}"><summary>${escape(source.kind)} ${id} · project revision ${String(source.revision)}</summary><p>${escape(standing)}. Source identity only; no private reasoning or raw event payload is displayed.</p>${navigation}</details>`;
}

export function renderActivity(project: ProjectSnapshot, page: ActivityPage, beforeRevision?: number): string {
  return `<p>Recorded milestones, newest first. Read from this project's event log without a model call. This view covers saved proposals, knowledge, discussion outcomes, coding and read-only assignment milestones. It is not a full provider transcript.</p><p role="status">${beforeRevision === undefined ? "Newest milestones" : `Historical page before revision ${String(beforeRevision)}`} · current project revision ${String(project.revision)}</p><ol>${page.entries.map(entry => `<li data-activity-revision="${String(entry.revision)}"><p><strong>${escape(entry.summary)}</strong> · observed at project revision ${String(entry.revision)}</p>${entry.links.map((source, index) => renderLink(project, source, `${String(entry.revision)}:${String(index)}`)).join("")}${entry.omittedLinks ? `<p>${String(entry.omittedLinks)} additional source identities are outside this bounded view. Inspect the linked work record for full context.</p>` : ""}</li>`).join("")}</ol>${page.entries.length ? "" : "<p>No recorded milestones on this page. Missing activity does not prove that work completed.</p>"}<button id="activity-newest" type="button" data-activity-before=""${beforeRevision === undefined ? " disabled" : ""}>Newest</button><button id="activity-older" type="button"${page.nextBeforeRevision === null ? " disabled" : ` data-activity-before="${String(page.nextBeforeRevision)}"`}>Older</button>`;
}
