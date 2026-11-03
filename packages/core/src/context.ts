import type { ProjectSnapshot } from "./index.js";
import type { RecordReference } from "./inspection.js";

export interface SubmittedStatement {
  readonly requestId: string;
  readonly projectId: ProjectSnapshot["projectId"];
  readonly contextRevision: ProjectSnapshot["revision"];
  readonly originalStatement: string;
}

export type KnowledgeSource =
  | { readonly kind: "submitted-statement"; readonly submitted: SubmittedStatement }
  | { readonly kind: "project-record"; readonly reference: RecordReference };

export interface SourcedText {
  readonly text: string;
  readonly sources: readonly [KnowledgeSource, ...KnowledgeSource[]];
}

export interface Interpretation {
  readonly kind: "inferred";
  readonly submitted: SubmittedStatement;
  readonly summary: SourcedText;
}

export interface KnowledgeVersion {
  readonly projectId: ProjectSnapshot["projectId"];
  readonly knowledgeId: string;
  readonly recordedAtRevision: ProjectSnapshot["revision"];
}

export interface KnowledgeEntry extends KnowledgeVersion {
  readonly content: SourcedText;
  readonly standing:
    | { readonly kind: "observed" }
    | { readonly kind: "inferred" }
    | { readonly kind: "confirmed"; readonly confirmationCommandId: string };
}

export interface KnowledgeCorrection {
  readonly target: KnowledgeVersion;
  readonly proposedContent: SourcedText;
}

function invalid(): never {
  throw new Error("Invalid context proposal");
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(value: object, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) invalid();
  return value;
}

export function parseSubmittedStatement(value: unknown): SubmittedStatement {
  if (!isObject(value) || !onlyKeys(value, ["requestId", "projectId", "contextRevision", "originalStatement"]) ||
      !("requestId" in value) || !("projectId" in value) || !("contextRevision" in value) || !("originalStatement" in value) ||
      typeof value.contextRevision !== "number" || !Number.isSafeInteger(value.contextRevision) || value.contextRevision < 1) invalid();
  return { requestId: text(value.requestId), projectId: text(value.projectId),
    contextRevision: value.contextRevision, originalStatement: text(value.originalStatement) };
}

function selectSources(value: unknown, available: readonly KnowledgeSource[], projectId: string): SourcedText["sources"] {
  if (!Array.isArray(value) || value.length === 0) invalid();
  const selected = value.map((index) => {
    if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0) invalid();
    const source = available[index];
    if (!source) invalid();
    const sourceProject = source.kind === "submitted-statement" ? source.submitted.projectId : source.reference.projectId;
    if (sourceProject !== projectId) invalid();
    return source;
  });
  const first = selected[0];
  if (!first) invalid();
  return [first, ...selected.slice(1)];
}

export function parseInterpretationOutput({ submitted, availableSources, value }: {
  readonly submitted: SubmittedStatement;
  readonly availableSources: readonly RecordReference[];
  readonly value: unknown;
}): Interpretation {
  if (!isObject(value) || !onlyKeys(value, ["summary", "sourceIndexes"]) ||
      !("summary" in value) || !("sourceIndexes" in value)) invalid();
  const sources: readonly KnowledgeSource[] = [{ kind: "submitted-statement", submitted },
    ...availableSources.map((reference): KnowledgeSource => ({ kind: "project-record", reference }))];
  return { kind: "inferred", submitted, summary: { text: text(value.summary),
    sources: selectSources(value.sourceIndexes, sources, submitted.projectId) } };
}

export function parseKnowledgeCorrection({ target, availableSources, value }: {
  readonly target: KnowledgeVersion;
  readonly availableSources: readonly KnowledgeSource[];
  readonly value: unknown;
}): KnowledgeCorrection {
  if (!isObject(value) || !onlyKeys(value, ["text", "sourceIndexes"]) ||
      !("text" in value) || !("sourceIndexes" in value)) invalid();
  return { target, proposedContent: { text: text(value.text),
    sources: selectSources(value.sourceIndexes, availableSources, target.projectId) } };
}
