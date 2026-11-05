import * as vscode from "vscode";
import path from "node:path";
import { relationshipSources } from "../../../packages/core/src/knowledge-relationships.js";
import { resolveRecordReference } from "../../../packages/core/src/inspection.js";
import { fileURLToPath } from "node:url";
import type { ProjectSnapshot } from "../../../packages/core/src/index.js";
import type { SuppliedSource } from "../../../packages/core/src/supplied-source.js";
import { ProjectRetrieval } from "./project-retrieval.js";

export function assertSharedFilesCurrent(project: ProjectSnapshot, sources: readonly SuppliedSource[]): void {
  if (sources.length > 20 || sources.reduce((bytes, source) => bytes + Buffer.byteLength(source.text), 0) > 60_000 || sources.some(source => Buffer.byteLength(source.text) > 10_000)) throw new Error("Choose at most 20 excerpts, 10,000 UTF-8 bytes each and 60,000 bytes total");
  const files = sources.flatMap<SuppliedSource>(source => {
    if (source.reference.kind !== "relationship") return source.reference.kind === "file" ? [source] : [];
    const resolved = resolveRecordReference(project, source.reference);
    const relationship = project.knowledgeRelationships.proposals.find(item => item.relationshipId === source.reference.recordId);
    if (!relationship || resolved.kind !== "resolved" || resolved.text !== source.text) throw new Error("Relationship is historical, withdrawn or changed");
    return relationshipSources(relationship);
  });
  if (!files.length) return;
  if (!vscode.workspace.isTrusted) throw new Error("Workspace trust is required for source evidence");
  const root = fileURLToPath(project.repositoryUri);
  if (files.some(source => { const reference = source.reference; return reference.kind === "file" && vscode.workspace.textDocuments.some(document => document.uri.scheme === "file" && document.uri.fsPath === path.join(root, reference.path) && document.isDirty); })) throw new Error("Save source buffers before using captured evidence");
  const index = new ProjectRetrieval({ projectId: project.projectId, root: fileURLToPath(project.repositoryUri) });
  try { index.assertCapturedCurrent(files); } finally { index.dispose(); }
}

