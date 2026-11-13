import * as vscode from "vscode";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectSnapshot } from "../../../packages/core/src/index.js";
import type { SuppliedSource } from "../../../packages/core/src/supplied-source.js";
import { ProjectRetrieval } from "./project-retrieval.js";

export async function selectSharedFiles(project: ProjectSnapshot, current: () => boolean): Promise<readonly SuppliedSource[] | undefined> {
  const choice = await vscode.window.showQuickPick(["Project records only", "Choose current file excerpts"], { title: "Choose exactly what to share", ignoreFocusOut: true });
  if (!choice || !current()) return;
  if (choice === "Project records only") return [];
  const root = fileURLToPath(project.repositoryUri);
  const files = await vscode.window.showOpenDialog({ defaultUri: vscode.Uri.file(root), canSelectMany: true, canSelectFiles: true, canSelectFolders: false, title: "Select up to 5 files; hidden, secret-named and unsafe files are excluded" });
  if (!files || !current()) return;
  if (files.length > 5) throw new Error("Choose at most 5 files");
  const index = new ProjectRetrieval({ projectId: project.projectId, root });
  try {
    const sources: SuppliedSource[] = [];
    for (const file of files) {
      if (file.scheme !== "file") throw new Error("Only repository files can be shared");
      if (vscode.workspace.textDocuments.some(document => document.uri.toString() === file.toString() && document.isDirty)) throw new Error("Save the selected buffer before capturing disk evidence");
      const relative = path.relative(root, file.fsPath);
      const form = await vscode.window.showQuickPick(["File excerpt", "Tracked full-file diff against HEAD"], { title: `Share ${relative}`, ignoreFocusOut: true });
      if (!form || !current()) return;
      if (form === "Tracked full-file diff against HEAD") { sources.push(index.captureDiff(relative, project.revision)); continue; }
      const range = await vscode.window.showInputBox({ title: `Lines to share from ${relative}`, value: "1-200", prompt: "At most 200 lines and 10,000 UTF-8 bytes per file. Inspect exact content before approval.", ignoreFocusOut: true });
      if (!range || !current()) return;
      const match = /^(\d+)-(\d+)$/.exec(range);
      if (!match) throw new Error("Enter a start-end line range");
      sources.push(index.captureFile(relative, project.revision, Number(match[1]), Number(match[2])));
    }
    index.assertCapturedCurrent(sources);
    return sources;
  } finally { index.dispose(); }
}
