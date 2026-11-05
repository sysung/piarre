import * as vscode from "vscode";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectSnapshot } from "../../../packages/core/src/index.js";
import type { SuppliedSource } from "../../../packages/core/src/supplied-source.js";
import { ProjectRetrieval } from "./project-retrieval.js";

export function discoverRepositorySkills(project: ProjectSnapshot): readonly { readonly path: string; readonly label: string }[] {
  const index = new ProjectRetrieval({ projectId: project.projectId, root: fileURLToPath(project.repositoryUri) });
  try { return index.listSkillFiles().map(skillPath => ({ path: skillPath, label: `Skill excerpt · ${skillPath}` })); }
  finally { index.dispose(); }
}

export function captureRepositorySkill(project: ProjectSnapshot, skillPath: string): SuppliedSource {
  const root = fileURLToPath(project.repositoryUri);
  const uri = vscode.Uri.file(path.join(root, skillPath));
  if (vscode.workspace.textDocuments.some(document => document.uri.toString() === uri.toString() && document.isDirty)) throw new Error("Save the selected skill buffer before capturing disk evidence");
  const index = new ProjectRetrieval({ projectId: project.projectId, root });
  try {
    const source = index.captureSkillFile(skillPath, project.revision);
    index.assertCapturedCurrent([source]);
    return source;
  } finally { index.dispose(); }
}
