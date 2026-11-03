import * as vscode from "vscode";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectSnapshot } from "../../../packages/core/src/index.js";
import { ProjectRetrieval, type RetrievalHit, type RetrievalResult } from "./project-retrieval.js";

export async function lookupCompilerReferences(project: ProjectSnapshot): Promise<RetrievalResult> {
  const coverage = { files: 0, records: 0, issues: ["Only the active symbol and returned locations are covered. Missing language providers, dynamic dependencies and other repositories remain gaps."], limitation: "Compiler/language-provider references are static source relationships, not business rationale, deployed state, runtime observations or proof of test execution." };
  const unavailable = (reason: string): RetrievalResult => ({ kind: "error", reason, hits: [], coverage });
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== "file" || editor.document.isDirty) return unavailable("Open a saved repository file at a symbol; unsaved compiler buffers cannot be represented by disk evidence.");
  const root = fileURLToPath(project.repositoryUri);
  const index = new ProjectRetrieval({ projectId: project.projectId, root });
  const version = editor.document.version;
  try {
    index.captureFile(path.relative(root, editor.document.uri.fsPath), project.revision, editor.selection.active.line + 1, editor.selection.active.line + 1);
    let timer: NodeJS.Timeout | undefined;
    let locations: vscode.Location[] | undefined;
    try {
      locations = await Promise.race([
        vscode.commands.executeCommand<vscode.Location[]>("vscode.executeReferenceProvider", editor.document.uri, editor.selection.active),
        new Promise<undefined>(resolve => { timer = setTimeout(() => { resolve(undefined); }, 2000); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
    if (!locations || locations.length > 20 || editor.document.version !== version) return unavailable("Reference lookup unavailable, changed, timed out or exceeded 20 locations. Narrow the symbol lookup.");
    const hits: RetrievalHit[] = [];
    const captures = [];
    for (const location of locations) {
      if (location.uri.scheme !== "file" || vscode.workspace.textDocuments.some(document => document.uri.toString() === location.uri.toString() && document.isDirty)) return unavailable("A compiler location is unsaved or outside supported file evidence.");
      const captured = index.captureFile(path.relative(root, location.uri.fsPath), project.revision, location.range.start.line + 1, Math.min(location.range.start.line + 12, location.range.end.line + 1));
      const ref = captured.reference;
      if (ref.kind !== "file") throw new Error("Expected file evidence");
      captures.push(captured);
      hits.push({ projectId: project.projectId, source: { kind: "file", path: ref.path, startLine: ref.startLine, endLine: ref.endLine } satisfies import("./project-retrieval.js").RetrievalSource, text: captured.text, contentHash: ref.contentHash, method: "compiler-reference" satisfies import("./project-retrieval.js").RetrievalHit["method"] });
    }
    index.assertCapturedCurrent(captures);
    return { kind: hits.length ? "matched" : "no-match", hits, coverage: { ...coverage, files: new Set(hits.flatMap(hit => hit.source.kind === "file" ? [hit.source.path] : [])).size } };
  } catch { return unavailable("Compiler reference evidence could not be captured safely. No relationship claim is available."); }
  finally { index.dispose(); }
}
