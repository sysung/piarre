import type { ProjectSnapshot } from "./index.js";

export type ExpertisePreference = "unspecified" | "learning" | "familiar";
export type ExplanationPreference = "default" | "brief" | "guided";
export interface Reflection {
  readonly reflectionId: string;
  readonly sourceRevision: number;
  readonly recordedAtRevision: number;
  readonly status: "pending" | "declined" | "reviewed";
  readonly feedback: readonly string[];
}
export type ReflectionAction =
  | { readonly kind: "offer-reflection" }
  | { readonly kind: "correct-reflection"; readonly reflectionId: string; readonly feedback: string }
  | { readonly kind: "resolve-reflection"; readonly reflectionId: string; readonly resolution: "declined" | "reviewed" }
  | { readonly kind: "set-expertise-preference"; readonly preference: ExpertisePreference }
  | { readonly kind: "set-explanation-preference"; readonly preference: ExplanationPreference };
export interface ReflectionEvent { readonly kind: "reflection-recorded"; readonly commandId: string; readonly action: ReflectionAction }

function invalid(): never { throw new Error("Invalid reflection operation"); }
export function parseReflectionAction(value: unknown): ReflectionAction | undefined {
  if (typeof value !== "object" || value === null || !("kind" in value)) return undefined;
  const keys = (expected: readonly string[]) => { if (Object.keys(value).length !== expected.length || Object.keys(value).some(key => !expected.includes(key))) invalid(); };
  if (value.kind === "offer-reflection") { keys(["kind"]); return { kind: value.kind }; }
  if (value.kind === "set-expertise-preference") {
    keys(["kind", "preference"]);
    if (!("preference" in value) || (value.preference !== "unspecified" && value.preference !== "learning" && value.preference !== "familiar")) invalid();
    return { kind: value.kind, preference: value.preference };
  }
  if (value.kind === "set-explanation-preference") {
    keys(["kind", "preference"]);
    if (!("preference" in value) || (value.preference !== "default" && value.preference !== "brief" && value.preference !== "guided")) invalid();
    return { kind: value.kind, preference: value.preference };
  }
  if (value.kind !== "correct-reflection" && value.kind !== "resolve-reflection") return undefined;
  if (!("reflectionId" in value) || typeof value.reflectionId !== "string" || !value.reflectionId.trim() || value.reflectionId.length > 200) invalid();
  if (value.kind === "correct-reflection") {
    keys(["kind", "reflectionId", "feedback"]);
    if (!("feedback" in value) || typeof value.feedback !== "string" || !value.feedback.trim() || value.feedback.length > 10_000) invalid();
    return { kind: value.kind, reflectionId: value.reflectionId, feedback: value.feedback };
  }
  keys(["kind", "reflectionId", "resolution"]);
  if (!("resolution" in value) || (value.resolution !== "declined" && value.resolution !== "reviewed")) invalid();
  return { kind: value.kind, reflectionId: value.reflectionId, resolution: value.resolution };
}
export function parseReflectionEvent(value: unknown): ReflectionEvent | undefined {
  if (typeof value !== "object" || value === null || !("kind" in value) || value.kind !== "reflection-recorded") return undefined;
  if (Object.keys(value).length !== 3 || !("commandId" in value) || typeof value.commandId !== "string" || !value.commandId.trim() || !("action" in value)) invalid();
  const action = parseReflectionAction(value.action); if (!action) invalid();
  return { kind: value.kind, commandId: value.commandId, action };
}
export function applyReflectionEvent(project: ProjectSnapshot, event: ReflectionEvent): ProjectSnapshot {
  const revision = project.revision + 1;
  const action = event.action;
  if (action.kind === "set-expertise-preference") return { ...project, revision, expertisePreference: action.preference };
  if (action.kind === "set-explanation-preference") return { ...project, revision, explanationPreference: action.preference };
  if (action.kind === "offer-reflection") {
    if (project.reflections.some(item => item.status === "pending")) invalid();
    return { ...project, revision, reflections: [...project.reflections, { reflectionId: `reflection:${event.commandId}`, sourceRevision: project.revision,
      recordedAtRevision: revision, status: "pending", feedback: [] }] };
  }
  const current = project.reflections.find(item => item.reflectionId === action.reflectionId);
  if (!current || current.status !== "pending") invalid();
  const replacement: Reflection = action.kind === "correct-reflection" ? { ...current, recordedAtRevision: revision, feedback: [...current.feedback, action.feedback] }
    : { ...current, recordedAtRevision: revision, status: action.resolution };
  return { ...project, revision, reflections: project.reflections.map(item => item === current ? replacement : item) };
}

export function reflectionArtifactPath(reflection: Reflection): string {
  return `.artifacts/sessions/${encodeURIComponent(reflection.reflectionId)}/reflection.md`;
}
export function renderReflection(source: ProjectSnapshot, reflection: Reflection, preference: ExplanationPreference): string {
  if (source.revision !== reflection.sourceRevision) invalid();
  const link = (kind: string, id: string, revision: number) => `#source-${kind}-${encodeURIComponent(id)}-r${String(revision)}`;
  const decisions = [...new Map(source.knowledge.map(entry => [entry.knowledgeId, entry])).values()].filter(entry => entry.category === "decision");
  const lines = ["# Optional session reflection", "", `Recorded source project revision ${String(source.revision)}. This is a deterministic record summary, not an assessment of success.`,
    `Work artifact convention: ${reflectionArtifactPath(reflection)} (suggested export path; no repository file was written).`, "", "## Observed records", "",
    `- ${String(source.tasks.length)} task records; ${String(source.executionRuns.length)} run records. Absence of a run does not establish work completion.`,
    ...source.executionRuns.map(run => `- Run ${run.runId}: recorded ${run.state.kind}${run.state.kind === "terminal" ? `; result ${run.state.result.outcome}` : ""}. [Source](${link("run", run.runId, source.revision)})`),
    ...decisions.map(entry => `- Decision ${entry.topic}: ${entry.standing.kind}. [Source](${link("knowledge", entry.knowledgeId, entry.recordedAtRevision)})`),
    "", "## User feedback and corrections", "", ...reflection.feedback.map(text => `User-submitted feedback (unverified):\n\n${text}\n`),
    ...(reflection.feedback.length ? [] : ["No feedback recorded."]), "", "## Documentation and improvement proposals", "",
    "Proposed review only. No policy, prompt, memory, skill, documentation, or code changes are approved or applied here.",
    `- Purpose: review the recorded task purposes before proposing a lasting documentation edit. [Project source](${link("project", source.projectId, source.revision)})`,
    ...decisions.map(entry => `- Proposed decision documentation: review '${entry.topic}' with its ${entry.standing.kind} standing and original rationale. [Exact source](${link("knowledge", entry.knowledgeId, entry.recordedAtRevision)})`),
    ...source.executionRuns.filter(run => run.state.kind === "terminal").map(run => `- Proposed outcome documentation: review run ${run.runId} and its checks before claiming an outcome. [Source](${link("run", run.runId, source.revision)})`),
    ...reflection.feedback.map((_, index) => `- Proposed improvement: review user feedback ${String(index + 1)} above. It remains a proposal, not a confirmed preference or instruction.`),
    "", "Source revisions remain historical. Later corrections, superseded plans, and new runs require a fresh review against current project state.",
    "", "## Source records", "", `<a id="source-project-${encodeURIComponent(source.projectId)}-r${String(source.revision)}"></a>`,
    ...decisions.flatMap(entry => [`<a id="source-knowledge-${encodeURIComponent(entry.knowledgeId)}-r${String(entry.recordedAtRevision)}"></a>`, `Decision record ${entry.knowledgeId} at revision ${String(entry.recordedAtRevision)}.`, "", entry.content.text, ""]),
    ...source.executionRuns.flatMap(run => [`<a id="source-run-${encodeURIComponent(run.runId)}-r${String(source.revision)}"></a>`, `Run record ${run.runId} at project revision ${String(source.revision)}.`, "", "```json", JSON.stringify(run, null, 2), "```"]),
    `Project ${source.projectId}, exact revision ${String(source.revision)}. Historical snapshot below includes purpose, decision rationale, plans, outcomes, checks, and their authority state. Record IDs in the proposals identify entries within this snapshot.`, "", "```json", JSON.stringify(source, null, 2), "```", "", "Export: use Save As on this unsaved document to retain the work artifact at the suggested path. Lasting documentation still requires a separately reviewed edit."];
  if (preference === "guided") lines.push("", "Explanation preference: guided. Inspect the linked records, compare their revisions with current records, and review a concrete diff through the existing approval flow before changing lasting documentation.");
  if (preference === "brief") lines.push("", "Explanation preference: brief. Full source records and corrections remain included for inspection.");
  return lines.join("\n");
}

export function reflectionDrift(source: ProjectSnapshot, current: ProjectSnapshot): readonly string[] {
  if (source.projectId !== current.projectId) invalid();
  const latestKnowledge = new Map(current.knowledge.map(entry => [entry.knowledgeId, entry]));
  const latestPlans = new Map(current.executionPlans.map(plan => [plan.taskId, plan]));
  const oldPlans = new Map(source.executionPlans.map(plan => [plan.taskId, plan]));
  return [
    ...[...new Map(source.knowledge.map(entry => [entry.knowledgeId, entry])).values()]
      .filter(entry => latestKnowledge.get(entry.knowledgeId)?.recordedAtRevision !== entry.recordedAtRevision)
      .map(entry => `Knowledge ${entry.knowledgeId} changed after source revision ${String(source.revision)}. Review its current authority and linked plan impact.`),
    ...[...oldPlans.values()].filter(plan => latestPlans.get(plan.taskId)?.planId !== plan.planId)
      .map(plan => `Plan ${plan.planId} for task ${plan.taskId} was superseded. This reflection cannot establish current plan validity.`),
    ...current.executionRuns.filter(run => !source.executionRuns.some(previous => previous.runId === run.runId))
      .map(run => `Run ${run.runId} was recorded after this reflection's source snapshot.`),
  ];
}
