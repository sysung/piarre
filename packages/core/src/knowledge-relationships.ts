import type { KnowledgeVersion } from "./context.js";
import type { ProjectSnapshot } from "./index.js";
import { currentKnowledge } from "./knowledge.js";
import { parseSuppliedSources, type FileReference, type SuppliedSource } from "./supplied-source.js";

export type RelationshipRole = "implementation" | "module" | "symbol" | "infrastructure-declaration" | "supporting-evidence";
export type CapturedFileSource = SuppliedSource & { readonly reference: FileReference };
export type RelationshipExtraction =
  | { readonly kind: "selected-file-excerpt" }
  | { readonly kind: "compiler-reference"; readonly origin: CapturedFileSource };
export interface RelationshipDraft {
  readonly knowledge: KnowledgeVersion;
  readonly role: RelationshipRole;
  readonly source: CapturedFileSource;
  readonly explanation: string;
  readonly extraction: RelationshipExtraction;
  readonly author: { readonly kind: "user" };
}
export interface KnowledgeRelationship extends RelationshipDraft {
  readonly relationshipId: string;
  readonly recordedAtRevision: number;
}
export interface RelationshipTarget { readonly relationshipId: string; readonly proposalRevision: number }
export type RelationshipDecision = RelationshipTarget & { readonly recordedAtRevision: number; readonly commandId: string } &
  ({ readonly kind: "adopted" } | { readonly kind: "withdrawn"; readonly adoptionRevision: number });
export interface KnowledgeRelationships {
  readonly proposals: readonly KnowledgeRelationship[];
  readonly decisions: readonly RelationshipDecision[];
}
export type KnowledgeRelationshipAction =
  | { readonly kind: "propose-knowledge-relationship"; readonly draft: RelationshipDraft }
  | { readonly kind: "adopt-knowledge-relationship"; readonly target: RelationshipTarget }
  | { readonly kind: "withdraw-knowledge-relationship"; readonly target: RelationshipTarget; readonly adoptionRevision: number };
export type KnowledgeRelationshipEvent = { readonly kind: "knowledge-relationship-recorded"; readonly action: KnowledgeRelationshipAction; readonly commandId: string };
function invalid(): never { throw new Error("Invalid knowledge relationship operation"); }
function object(value: unknown): value is object { return typeof value === "object" && value !== null && !Array.isArray(value); }
function keys(value: object, expected: readonly string[]): boolean { return Object.keys(value).length === expected.length && Object.keys(value).every(key => expected.includes(key)); }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 10_000) invalid(); return value; }
function revision(value: unknown): number { if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) invalid(); return value; }
function knowledgeVersion(value: unknown): KnowledgeVersion {
  if (!object(value) || !keys(value, ["projectId", "knowledgeId", "recordedAtRevision"]) || !("projectId" in value) || !("knowledgeId" in value) || !("recordedAtRevision" in value)) invalid();
  return { projectId: text(value.projectId), knowledgeId: text(value.knowledgeId), recordedAtRevision: revision(value.recordedAtRevision) };
}
/** Parse at the boundary; a diff cannot stand for a saved symbol/module/declaration excerpt. */
export function parseFileSource(value: unknown): CapturedFileSource {
  const source = parseSuppliedSources([value])[0];
  if (!source || source.reference.kind !== "file" || source.reference.representation.kind !== "file-excerpt") invalid();
  return { reference: source.reference, text: source.text };
}
function extraction(value: unknown): RelationshipExtraction {
  if (!object(value) || !("kind" in value)) invalid();
  if (value.kind === "selected-file-excerpt" && keys(value, ["kind"])) return { kind: value.kind };
  if (value.kind === "compiler-reference" && keys(value, ["kind", "origin"]) && "origin" in value) return { kind: value.kind, origin: parseFileSource(value.origin) };
  return invalid();
}
function draft(value: unknown): RelationshipDraft {
  if (!object(value) || !keys(value, ["knowledge", "role", "source", "explanation", "extraction", "author"]) || !("knowledge" in value) || !("role" in value) || !("source" in value) || !("explanation" in value) || !("extraction" in value) || !("author" in value) ||
    !object(value.author) || !keys(value.author, ["kind"]) || !("kind" in value.author) || value.author.kind !== "user" ||
    (value.role !== "implementation" && value.role !== "module" && value.role !== "symbol" && value.role !== "infrastructure-declaration" && value.role !== "supporting-evidence")) invalid();
  return { knowledge: knowledgeVersion(value.knowledge), role: value.role, source: parseFileSource(value.source), explanation: text(value.explanation), extraction: extraction(value.extraction), author: { kind: "user" } };
}
function target(value: unknown): RelationshipTarget {
  if (!object(value) || !keys(value, ["relationshipId", "proposalRevision"]) || !("relationshipId" in value) || !("proposalRevision" in value)) invalid();
  return { relationshipId: text(value.relationshipId), proposalRevision: revision(value.proposalRevision) };
}
export function parseKnowledgeRelationshipAction(value: unknown): KnowledgeRelationshipAction | undefined {
  if (!object(value) || !("kind" in value)) return undefined;
  if (value.kind === "propose-knowledge-relationship") {
    if (!keys(value, ["kind", "draft"]) || !("draft" in value)) invalid();
    return { kind: value.kind, draft: draft(value.draft) };
  }
  if (value.kind === "adopt-knowledge-relationship") {
    if (!keys(value, ["kind", "target"]) || !("target" in value)) invalid();
    return { kind: value.kind, target: target(value.target) };
  }
  if (value.kind === "withdraw-knowledge-relationship") {
    if (!keys(value, ["kind", "target", "adoptionRevision"]) || !("target" in value) || !("adoptionRevision" in value)) invalid();
    return { kind: value.kind, target: target(value.target), adoptionRevision: revision(value.adoptionRevision) };
  }
  return undefined;
}
export function parseKnowledgeRelationshipEvent(value: unknown): KnowledgeRelationshipEvent | undefined {
  if (!object(value) || !("kind" in value) || value.kind !== "knowledge-relationship-recorded") return undefined;
  if (!keys(value, ["kind", "action", "commandId"]) || !("action" in value) || !("commandId" in value)) invalid();
  const action = parseKnowledgeRelationshipAction(value.action);
  if (!action) invalid();
  return { kind: value.kind, action, commandId: text(value.commandId) };
}
export function relationshipDecision(project: ProjectSnapshot, relationshipId: string): RelationshipDecision | undefined {
  return project.knowledgeRelationships.decisions.filter(item => item.relationshipId === relationshipId).at(-1);
}
export function relationshipKnowledgeCurrent(project: ProjectSnapshot, relationship: KnowledgeRelationship): boolean {
  return relationship.knowledge.projectId === project.projectId && currentKnowledge(project).some(item => item.knowledgeId === relationship.knowledge.knowledgeId && item.recordedAtRevision === relationship.knowledge.recordedAtRevision);
}
export function relationshipSources(relationship: KnowledgeRelationship): readonly CapturedFileSource[] {
  return relationship.extraction.kind === "compiler-reference" ? [relationship.source, relationship.extraction.origin] : [relationship.source];
}
export function relationshipText(project: ProjectSnapshot, relationship: KnowledgeRelationship): string {
  const knowledge = project.knowledge.find(item => item.knowledgeId === relationship.knowledge.knowledgeId && item.recordedAtRevision === relationship.knowledge.recordedAtRevision);
  return `User-asserted ${relationship.role} relationship\nKnowledge @${String(relationship.knowledge.recordedAtRevision)} (${knowledge?.standing.kind ?? "unavailable"}): ${knowledge?.content.text ?? "Unavailable historical knowledge"}\nOriginal explanation: ${relationship.explanation}\nExtraction: ${relationship.extraction.kind}\nCaptured ${relationship.source.reference.path}:${String(relationship.source.reference.startLine)}-${String(relationship.source.reference.endLine)} (${relationship.source.reference.contentHash})\n${relationship.source.text}\n${relationship.extraction.kind === "compiler-reference" ? `Saved compiler origin ${relationship.extraction.origin.reference.path}:${String(relationship.extraction.origin.reference.startLine)} (${relationship.extraction.origin.reference.contentHash})\n${relationship.extraction.origin.text}\n` : ""}Coverage: selected source only; declarations do not prove deployment, static references do not prove runtime behavior, and test definitions do not prove execution.`;
}
export function applyKnowledgeRelationshipEvent(project: ProjectSnapshot, event: KnowledgeRelationshipEvent): ProjectSnapshot {
  const revision = project.revision + 1;
  const { action } = event;
  const state = project.knowledgeRelationships;
  if (action.kind === "propose-knowledge-relationship") {
    const relationship: KnowledgeRelationship = { ...action.draft, relationshipId: `relationship:${event.commandId}`, recordedAtRevision: revision };
    if (!relationshipKnowledgeCurrent(project, relationship) || state.proposals.some(item => item.relationshipId === relationship.relationshipId) || relationshipSources(relationship).some(item => item.reference.projectId !== project.projectId || item.reference.revision > project.revision)) invalid();
    return { ...project, revision, knowledgeRelationships: { ...state, proposals: [...state.proposals, relationship] } };
  }
  const relationship = state.proposals.find(item => item.relationshipId === action.target.relationshipId && item.recordedAtRevision === action.target.proposalRevision);
  if (!relationship) invalid();
  const previous = relationshipDecision(project, relationship.relationshipId);
  let decision: RelationshipDecision;
  if (action.kind === "adopt-knowledge-relationship") {
    if (previous || !relationshipKnowledgeCurrent(project, relationship)) invalid();
    decision = { ...action.target, kind: "adopted", commandId: event.commandId, recordedAtRevision: revision };
  } else {
    if (previous?.kind !== "adopted" || previous.recordedAtRevision !== action.adoptionRevision) invalid();
    decision = { ...action.target, kind: "withdrawn", adoptionRevision: action.adoptionRevision, commandId: event.commandId, recordedAtRevision: revision };
  }
  return { ...project, revision, knowledgeRelationships: { ...state, decisions: [...state.decisions, decision] } };
}
