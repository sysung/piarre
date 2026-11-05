import * as vscode from "vscode";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { portableContextPath } from "../../../packages/core/src/context-path.js";
import type { ProjectSnapshot, CapturedFileSource } from "../../../packages/core/src/index.js";
import { parseFileSource } from "../../../packages/core/src/knowledge-relationships.js";
import { ProjectRetrieval, type RetrievalResult, type RetrievalCoverage } from "./project-retrieval.js";

const coverage: RetrievalCoverage = { files: 0, records: 0, issues: ["Only the active symbol and returned locations are covered. Missing language providers, dynamic dependencies and other repositories remain gaps."], limitation: "Compiler/language-provider references are static source relationships, not business rationale, deployed state, runtime observations or proof of test execution." };
export type CompilerCapture =
  | { readonly kind: "captured"; readonly origin: CapturedFileSource; readonly sources: readonly CapturedFileSource[]; readonly coverage: RetrievalCoverage }
  | { readonly kind: "unavailable"; readonly reason: string; readonly coverage: RetrievalCoverage };

function editorCurrent(editor: vscode.TextEditor, version: number): boolean { return vscode.workspace.isTrusted && !editor.document.isDirty && editor.document.version === version; }
/** Keep exact captures for review/adoption; display hits are only a projection of these bytes. */
export async function captureCompilerReferences(project: ProjectSnapshot, timeoutMs = 2000): Promise<CompilerCapture> {
  const unavailable = (reason: string): CompilerCapture => ({ kind: "unavailable", reason, coverage });
  const editor = vscode.window.activeTextEditor;
  if (!vscode.workspace.isTrusted || !editor || editor.document.uri.scheme !== "file" || editor.document.isDirty) return unavailable("Open a saved repository file at a symbol in a trusted workspace; unsaved compiler buffers cannot be represented by disk evidence.");
  const root = fileURLToPath(project.repositoryUri);
  const index = new ProjectRetrieval({ projectId: project.projectId, root });
  const version = editor.document.version;
  try {
    const origin = parseFileSource(index.captureFile(portableContextPath(path.relative(root, editor.document.uri.fsPath), path.sep), project.revision, editor.selection.active.line + 1, editor.selection.active.line + 1));
    let timer: NodeJS.Timeout | undefined;
    let locations: vscode.Location[] | undefined;
    try {
      locations = await Promise.race([
        vscode.commands.executeCommand<vscode.Location[]>("vscode.executeReferenceProvider", editor.document.uri, editor.selection.active),
        new Promise<undefined>(resolve => { timer = setTimeout(() => { resolve(undefined); }, Math.max(1, Math.min(timeoutMs, 2000))); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
    if (!locations || locations.length > 20 || !editorCurrent(editor, version)) return unavailable("Reference lookup unavailable, changed, timed out or exceeded 20 locations. Narrow the symbol lookup.");
    const sources: CapturedFileSource[] = [];
    for (const location of locations) {
      if (location.uri.scheme !== "file" || vscode.workspace.textDocuments.some(document => document.uri.toString() === location.uri.toString() && document.isDirty)) return unavailable("A compiler location is unsaved or outside supported file evidence.");
      sources.push(parseFileSource(index.captureFile(portableContextPath(path.relative(root, location.uri.fsPath), path.sep), project.revision, location.range.start.line + 1, Math.min(location.range.start.line + 12, location.range.end.line + 1))));
    }
    index.assertCapturedCurrent([origin, ...sources]);
    return { kind: "captured", origin, sources, coverage: { ...coverage, files: new Set(sources.map(source => source.reference.path)).size } };
  } catch { return unavailable("Compiler reference evidence could not be captured safely. No relationship claim is available."); }
  finally { index.dispose(); }
}
export async function lookupCompilerReferences(project: ProjectSnapshot): Promise<RetrievalResult> {
  const result = await captureCompilerReferences(project);
  if (result.kind === "unavailable") return { kind: "error", reason: result.reason, hits: [], coverage: result.coverage };
  return { kind: result.sources.length ? "matched" : "no-match", coverage: result.coverage,
    hits: result.sources.map(source => ({ projectId: project.projectId, source: { kind: "file", path: source.reference.path, startLine: source.reference.startLine, endLine: source.reference.endLine }, text: source.text, contentHash: source.reference.contentHash, method: "compiler-reference" })) };
}
