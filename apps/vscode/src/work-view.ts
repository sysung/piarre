import * as vscode from "vscode";
import type { ProjectSnapshot } from "../../../packages/core/src/index.js";

export function renderWorkView(project: ProjectSnapshot): string {
  const escape = (value: string): string =>
    value.replace(/[&<>"']/g, (character) => {
      switch (character) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        default:
          return "&#39;";
      }
    });
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:var(--vscode-font-family);padding:24px;color:var(--vscode-foreground)}dt{margin-top:16px;color:var(--vscode-descriptionForeground)}dd{margin:4px 0;overflow-wrap:anywhere}</style></head><body><h1>Work</h1><h2>${escape(project.name)}</h2><p>Your project is ready. No tasks yet.</p><dl><dt>Repository</dt><dd>${escape(project.repositoryUri)}</dd><dt>Project ID</dt><dd>${escape(project.projectId)}</dd><dt>Revision</dt><dd>${String(project.revision)}</dd></dl><p>Use Piarre: Rename Project in the Command Palette to change the project name.</p></body></html>`;
}

export class WorkView {
  private panel: vscode.WebviewPanel | undefined;
  show(project: ProjectSnapshot): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "piarre.work",
        "Piarre Work",
        vscode.ViewColumn.One,
        { enableScripts: false, localResourceRoots: [] },
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }
    this.panel.webview.html = renderWorkView(project);
    this.panel.reveal();
  }
  dispose(): void {
    this.panel?.dispose();
  }
}
