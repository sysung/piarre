import { fileURLToPath } from "node:url";
import type { ProjectSnapshot } from "../../../packages/core/src/index.js";
import type { SuppliedSource } from "../../../packages/core/src/supplied-source.js";
import { ProjectRetrieval } from "./project-retrieval.js";

export function assertSharedFilesCurrent(project: ProjectSnapshot, sources: readonly SuppliedSource[]): void {
  if (sources.length > 20 || sources.reduce((bytes, source) => bytes + Buffer.byteLength(source.text), 0) > 60_000 || sources.some(source => Buffer.byteLength(source.text) > 10_000)) throw new Error("Choose at most 20 excerpts, 10,000 UTF-8 bytes each and 60,000 bytes total");
  if (!sources.some(source => source.reference.kind === "file")) return;
  const index = new ProjectRetrieval({ projectId: project.projectId, root: fileURLToPath(project.repositoryUri) });
  try { index.assertCapturedCurrent(sources); } finally { index.dispose(); }
}

