import * as vscode from "vscode";
import { WorkView } from "../../src/work-view.js";
import type { ProjectSnapshot } from "../../../../packages/core/src/index.js";

// Existing renderer journeys run in a real webview; the sidebar provider receives
// that webview through the same resolve boundary used by VS Code.
export class SidebarFixture extends WorkView {
  private fixture: vscode.WebviewPanel | undefined;
  private readonly createFixture: typeof vscode.window.createWebviewPanel;

  constructor(...args: ConstructorParameters<typeof WorkView>) {
    super(...args);
    this.createFixture = args[0] ?? vscode.window.createWebviewPanel;
  }

  override show(project: ProjectSnapshot): void {
    if (!this.fixture) {
      const panel = this.createFixture("piarre.sidebar.fixture", "Piarre sidebar fixture", vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [] });
      this.fixture = panel;
      panel.onDidDispose(() => { if (this.fixture === panel) this.fixture = undefined; });
      this.resolveWebviewView({ webview: panel.webview, show: () => { panel.reveal(); }, onDidDispose: panel.onDidDispose,
        get visible() { return panel.visible; }, onDidChangeVisibility: listener => panel.onDidChangeViewState(() => { listener(); }) });
    }
    super.show(project);
    if (this.fixture.webview.html.includes("const restored = api.getState?.();")) this.fixture.webview.html = this.fixture.webview.html.replace("const restored = api.getState?.();", "const restored = { ...api.getState?.(), projectId: document.body.dataset.projectId, setupCompleted: true };");
  }

  override dispose(): void {
    super.dispose();
    this.fixture?.dispose();
  }
}
