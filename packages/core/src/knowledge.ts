import { parseSubmittedStatement, type KnowledgeEntry, type KnowledgeVersion, type SubmittedStatement } from "./context.js";
import type { ProjectSnapshot } from "./index.js";

export interface RecordedKnowledge extends KnowledgeEntry {
  readonly topic: string;
  readonly category: "business" | "decision";
  readonly affectedTaskIds: readonly string[];
  readonly supersedes: number | null;
}

export interface KnowledgeImpact {
  readonly kind: "stale";
  readonly taskId: string;
  readonly knowledgeId: string;
  readonly fromRevision: number;
  readonly toRevision: number;
}

export type KnowledgeAction =
  | { readonly kind: "observe-knowledge"; readonly topic: string; readonly category: "business" | "decision";
      readonly submitted: SubmittedStatement; readonly affectedTaskIds: readonly string[] }
  | { readonly kind: "confirm-knowledge"; readonly target: KnowledgeVersion }
  | { readonly kind: "correct-knowledge"; readonly target: KnowledgeVersion; readonly submitted: SubmittedStatement;
      readonly affectedTaskIds: readonly string[] };

export type KnowledgeEvent =
  | { readonly kind: "knowledge-observed"; readonly knowledgeId: string; readonly topic: string; readonly category: "business" | "decision";
      readonly submitted: SubmittedStatement; readonly affectedTaskIds: readonly string[] }
  | { readonly kind: "knowledge-confirmed"; readonly target: KnowledgeVersion; readonly confirmationCommandId: string }
  | { readonly kind: "knowledge-corrected"; readonly target: KnowledgeVersion; readonly submitted: SubmittedStatement;
      readonly affectedTaskIds: readonly string[]; readonly confirmationCommandId: string };

function invalid(): never { throw new Error("Invalid knowledge operation"); }
function object(value: unknown): value is object { return typeof value === "object" && value !== null && !Array.isArray(value); }
function keys(value: object, expected: readonly string[]): boolean { return Object.keys(value).length === expected.length && Object.keys(value).every(key => expected.includes(key)); }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 10_000) invalid(); return value; }
function taskIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) invalid();
  const ids = value.map(text); if (new Set(ids).size !== ids.length) invalid(); return ids;
}
function target(value: unknown): KnowledgeVersion {
  if (!object(value) || !keys(value, ["projectId", "knowledgeId", "recordedAtRevision"]) || !("projectId" in value) || !("knowledgeId" in value) || !("recordedAtRevision" in value) ||
    typeof value.recordedAtRevision !== "number" || !Number.isSafeInteger(value.recordedAtRevision) || value.recordedAtRevision < 1) invalid();
  return { projectId: text(value.projectId), knowledgeId: text(value.knowledgeId), recordedAtRevision: value.recordedAtRevision };
}
function observedFields(value: object) {
  if (!("topic" in value) || !("category" in value) || !("submitted" in value) || !("affectedTaskIds" in value) || (value.category !== "business" && value.category !== "decision")) invalid();
  return { topic: text(value.topic), category: value.category, submitted: parseSubmittedStatement(value.submitted), affectedTaskIds: taskIds(value.affectedTaskIds) };
}
export function parseKnowledgeAction(value: unknown): KnowledgeAction | undefined {
  if (!object(value) || !("kind" in value)) return undefined;
  if (value.kind === "observe-knowledge") {
    if (!keys(value, ["kind", "topic", "category", "submitted", "affectedTaskIds"])) invalid();
    const parsed = observedFields(value);
    if (parsed.category !== "business" && parsed.category !== "decision") invalid();
    return { kind: value.kind, ...parsed, category: parsed.category };
  }
  if (value.kind === "confirm-knowledge") {
    if (!keys(value, ["kind", "target"]) || !("target" in value)) invalid();
    return { kind: value.kind, target: target(value.target) };
  }
  if (value.kind === "correct-knowledge") {
    if (!keys(value, ["kind", "target", "submitted", "affectedTaskIds"]) || !("target" in value) || !("submitted" in value) || !("affectedTaskIds" in value)) invalid();
    return { kind: value.kind, target: target(value.target), submitted: parseSubmittedStatement(value.submitted), affectedTaskIds: taskIds(value.affectedTaskIds) };
  }
  return undefined;
}
export function parseKnowledgeEvent(value: unknown): KnowledgeEvent | undefined {
  if (!object(value) || !("kind" in value)) return undefined;
  if (value.kind === "knowledge-observed") {
    if (!keys(value, ["kind", "knowledgeId", "topic", "category", "submitted", "affectedTaskIds"]) || !("knowledgeId" in value)) invalid();
    const parsed = observedFields(value);
    if (parsed.category !== "business" && parsed.category !== "decision") invalid();
    return { kind: value.kind, knowledgeId: text(value.knowledgeId), ...parsed, category: parsed.category };
  }
  if (value.kind === "knowledge-confirmed") {
    if (!keys(value, ["kind", "target", "confirmationCommandId"]) || !("target" in value) || !("confirmationCommandId" in value)) invalid();
    return { kind: value.kind, target: target(value.target), confirmationCommandId: text(value.confirmationCommandId) };
  }
  if (value.kind === "knowledge-corrected") {
    if (!keys(value, ["kind", "target", "submitted", "affectedTaskIds", "confirmationCommandId"]) || !("target" in value) || !("submitted" in value) || !("affectedTaskIds" in value) || !("confirmationCommandId" in value)) invalid();
    return { kind: value.kind, target: target(value.target), submitted: parseSubmittedStatement(value.submitted), affectedTaskIds: taskIds(value.affectedTaskIds), confirmationCommandId: text(value.confirmationCommandId) };
  }
  return undefined;
}
export function currentKnowledge(project: ProjectSnapshot): readonly RecordedKnowledge[] {
  return [...new Map(project.knowledge.map(entry => [entry.knowledgeId, entry])).values()];
}
export function knowledgeConflicts(project: ProjectSnapshot, entry: RecordedKnowledge): readonly RecordedKnowledge[] {
  const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return currentKnowledge(project).filter(other => other.knowledgeId !== entry.knowledgeId && other.standing.kind === "confirmed" && entry.standing.kind === "confirmed" &&
    other.category === entry.category && normalize(other.topic) === normalize(entry.topic) && normalize(other.content.text) !== normalize(entry.content.text));
}
export function applyKnowledgeEvent(project: ProjectSnapshot, event: KnowledgeEvent): ProjectSnapshot {
  const revision = project.revision + 1;
  const validateSubmitted = (submitted: SubmittedStatement) => {
    if (submitted.projectId !== project.projectId || submitted.contextRevision !== project.revision) invalid();
    if (!submitted.originalStatement.trim() || submitted.originalStatement.length > 10_000) invalid();
  };
  const validateTasks = (ids: readonly string[]) => { if (ids.some(id => !project.tasks.some(task => task.taskId === id))) invalid(); };
  let entry: RecordedKnowledge;
  let impacts = project.knowledgeImpacts;
  if (event.kind === "knowledge-observed") {
    validateSubmitted(event.submitted); validateTasks(event.affectedTaskIds);
    if (project.knowledge.some(item => item.knowledgeId === event.knowledgeId)) invalid();
    entry = { projectId: project.projectId, knowledgeId: event.knowledgeId, recordedAtRevision: revision,
      topic: event.topic, category: event.category, affectedTaskIds: event.affectedTaskIds, supersedes: null,
      standing: { kind: "observed" }, content: { text: event.submitted.originalStatement,
        sources: [{ kind: "submitted-statement", submitted: event.submitted }] } };
  } else {
    const previous = currentKnowledge(project).find(item => item.knowledgeId === event.target.knowledgeId);
    if (!previous || event.target.projectId !== project.projectId || previous.recordedAtRevision !== event.target.recordedAtRevision) invalid();
    if (event.kind === "knowledge-confirmed") {
      if (previous.standing.kind === "confirmed") invalid();
      entry = { ...previous, recordedAtRevision: revision, supersedes: previous.recordedAtRevision,
        standing: { kind: "confirmed", confirmationCommandId: event.confirmationCommandId } };
    } else {
      validateSubmitted(event.submitted); validateTasks(event.affectedTaskIds);
      if (previous.standing.kind !== "confirmed") invalid();
      const affectedTaskIds = [...new Set([...previous.affectedTaskIds, ...event.affectedTaskIds])];
      entry = { ...previous, recordedAtRevision: revision, supersedes: previous.recordedAtRevision,
        affectedTaskIds, content: { text: event.submitted.originalStatement, sources: [{ kind: "submitted-statement", submitted: event.submitted }] },
        standing: { kind: "confirmed", confirmationCommandId: event.confirmationCommandId } };
      impacts = [...project.knowledgeImpacts.filter(impact => impact.knowledgeId !== previous.knowledgeId),
        ...affectedTaskIds.map((taskId): KnowledgeImpact => ({ kind: "stale", taskId, knowledgeId: previous.knowledgeId,
          fromRevision: project.knowledgeImpacts.find(impact => impact.taskId === taskId && impact.knowledgeId === previous.knowledgeId)?.fromRevision ?? previous.recordedAtRevision, toRevision: revision }))];
    }
  }
  return { ...project, revision, knowledge: [...project.knowledge, entry], knowledgeImpacts: impacts };
}
export function knowledgeEvent(action: KnowledgeAction, commandId: string): KnowledgeEvent {
  switch (action.kind) {
    case "observe-knowledge": return { kind: "knowledge-observed", knowledgeId: `knowledge:${commandId}`, topic: action.topic,
      category: action.category, submitted: action.submitted, affectedTaskIds: action.affectedTaskIds };
    case "confirm-knowledge": return { kind: "knowledge-confirmed", target: action.target, confirmationCommandId: commandId };
    case "correct-knowledge": return { kind: "knowledge-corrected", target: action.target, submitted: action.submitted,
      affectedTaskIds: action.affectedTaskIds, confirmationCommandId: commandId };
  }
}
