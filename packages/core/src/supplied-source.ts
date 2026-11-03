import type { RecordReference } from "./inspection.js";

/** An immutable excerpt identity, never filesystem authority or a current-state claim. */
export interface FileReference {
  readonly kind: "file";
  readonly projectId: string;
  readonly recordId: string;
  readonly revision: number;
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly contentHash: string;
  readonly inventoryHash: string;
  readonly excerptHash: string;
  readonly version: "worktree-at-capture";
  readonly representation: { readonly kind: "file-excerpt" } | { readonly kind: "git-diff"; readonly baseCommit: string };
}
export type SuppliedReference = RecordReference | FileReference;
export interface SuppliedSource { readonly reference: SuppliedReference; readonly text: string }

export function parseSuppliedReference(value: unknown): SuppliedReference {
  if (typeof value !== "object" || value === null || Array.isArray(value) ||
      !("projectId" in value) || !("kind" in value) || !("recordId" in value) || !("revision" in value) ||
      typeof value.projectId !== "string" || !value.projectId.trim() || typeof value.recordId !== "string" || !value.recordId.trim() ||
      typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error("Invalid supplied reference");
  const base = { projectId: value.projectId, recordId: value.recordId, revision: value.revision };
  if (value.kind !== "file") {
    if ((value.kind !== "task" && value.kind !== "proposal" && value.kind !== "knowledge") || Object.keys(value).length !== 4) throw new Error("Invalid record reference");
    return { ...base, kind: value.kind };
  }
  if (Object.keys(value).length !== 12 || !("path" in value) || typeof value.path !== "string" ||
      !value.path || value.path.startsWith("/") || value.path.includes("\\") || value.path.split("/").some(part => !part || part === ".." || part.startsWith(".")) ||
      !("startLine" in value) || typeof value.startLine !== "number" || !Number.isSafeInteger(value.startLine) || value.startLine < 1 ||
      !("endLine" in value) || typeof value.endLine !== "number" || !Number.isSafeInteger(value.endLine) || value.endLine < value.startLine || value.endLine - value.startLine > 199 ||
      !("contentHash" in value) || typeof value.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(value.contentHash) ||
      !("inventoryHash" in value) || typeof value.inventoryHash !== "string" || !/^[a-f0-9]{64}$/.test(value.inventoryHash) ||
      !("excerptHash" in value) || typeof value.excerptHash !== "string" || !/^[a-f0-9]{64}$/.test(value.excerptHash) ||
      !("version" in value) || value.version !== "worktree-at-capture") throw new Error("Invalid captured file reference");
  if (!("representation" in value) || typeof value.representation !== "object" || value.representation === null || !("kind" in value.representation)) throw new Error("Invalid file representation");
  const form = value.representation;
  let representation: FileReference["representation"];
  if (form.kind === "file-excerpt" && Object.keys(form).length === 1) representation = { kind: "file-excerpt" };
  else if (form.kind === "git-diff" && Object.keys(form).length === 2 && "baseCommit" in form && typeof form.baseCommit === "string" && /^[a-f0-9]{40,64}$/.test(form.baseCommit)) representation = { kind: "git-diff", baseCommit: form.baseCommit };
  else throw new Error("Invalid file representation");
  return { ...base, kind: "file", path: value.path, startLine: value.startLine, endLine: value.endLine,
    contentHash: value.contentHash, inventoryHash: value.inventoryHash, excerptHash: value.excerptHash, version: value.version, representation };
}
export function parseSuppliedSources(value: unknown): readonly SuppliedSource[] {
  if (!Array.isArray(value)) throw new Error("Bound supplied sources to 20 excerpts");
  let bytes = 0;
  const utf8Bytes = (text: string): number => Array.from(text).reduce((size, character) => {
    const point = character.codePointAt(0) ?? 0;
    return size + (point > 0xffff ? 4 : point > 0x7ff ? 3 : point > 0x7f ? 2 : 1);
  }, 0);
  const parsed = value.map((source: unknown) => {
    if (typeof source !== "object" || source === null || Object.keys(source).length !== 2 || !("reference" in source) || !("text" in source) || typeof source.text !== "string" || !source.text.trim()) throw new Error("Invalid source excerpt");
    const sourceBytes = utf8Bytes(source.text);
    bytes += sourceBytes;
    const reference = parseSuppliedReference(source.reference);
    if (reference.kind === "file" && sourceBytes > 10_000) throw new Error("Excerpt exceeds 10,000 UTF-8 bytes");
    return { reference, text: source.text };
  });
  if (parsed.some(source => source.reference.kind === "file") && (parsed.length > 20 || bytes > 60_000)) throw new Error("Supplied context budget exceeded");
  return parsed;
}

export function sourceCollectionVersion(project: import("./index.js").ProjectSnapshot): string {
  return JSON.stringify({ knowledge: project.knowledge.map(item => [item.knowledgeId, item.recordedAtRevision]), proposals: project.proposals.map(item => [item.groupId, item.recordedAtRevision]), tasks: project.tasks.map(item => [item.taskId, item.planVersion]) });
}
