import assert from "node:assert/strict";
import * as vscode from "vscode";
import { WorkView } from "../../src/work-view.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { replay, type ProposalDraft } from "../../../../packages/core/src/index.js";

suite("Sidebar ownership", () => {
  test("restores the latest project and in-flight local preview after surface disposal", async function () {
    this.timeout(15_000);
    const initial = replay([{ kind: "project-created", projectId: "sidebar-lifecycle", repositoryUri: "file:///sidebar-lifecycle", name: "Sidebar lifecycle" }]);
    let finish: ((draft: ProposalDraft) => void) | undefined;
    let panelsCreated = 0;
    const view = new WorkView((...args) => { panelsCreated++; return vscode.window.createWebviewPanel(...args); }, {
      prepare: () => new Promise(resolve => { finish = resolve; }), save: () => undefined,
    });
    const surfaces: vscode.WebviewPanel[] = [];
    const attach = () => {
      const panel = vscode.window.createWebviewPanel("piarre.lifecycle.fixture", "Sidebar lifecycle fixture", vscode.ViewColumn.One, { enableScripts: true });
      surfaces.push(panel);
      const messages: unknown[] = [];
      const postMessage = panel.webview.postMessage.bind(panel.webview);
      panel.webview.postMessage = message => { messages.push(message); return postMessage(message); };
      const ready = new Promise<void>(resolve => {
        const listener = panel.webview.onDidReceiveMessage((message: unknown) => {
          if (typeof message === "object" && message !== null && "kind" in message && message.kind === "ready") {
            listener.dispose(); resolve();
          }
        });
      });
      view.resolveWebviewView({ webview: panel.webview, show: () => { panel.reveal(); }, onDidDispose: panel.onDidDispose,
        get visible() { return panel.visible; }, onDidChangeVisibility: listener => panel.onDidChangeViewState(() => { listener(); }) });
      return { panel, messages, ready };
    };
    try {
      view.update(initial);
      assert.equal(panelsCreated, 0, "Project updates never open the old Work editor tab");
      const first = attach();
      await first.ready;
      const preparing = new Promise<void>(resolve => {
        const listener = first.panel.webview.onDidReceiveMessage((message: unknown) => {
          if (typeof message === "object" && message !== null && "kind" in message && message.kind === "preview") {
            listener.dispose(); resolve();
          }
        });
      });
      first.panel.webview.html = first.panel.webview.html.replace("</script>", "api.postMessage({kind:'preview',requestId:'in-flight',goal:'Keep this intent'});</script>");
      await preparing;
      first.panel.dispose();
      assert.ok(finish);
      finish(await new GoalInterpreter().propose("Keep this intent"));
      await new Promise(resolve => setImmediate(resolve));
      const replacement = attach();
      await replacement.ready;
      assert.ok(replacement.messages.some(message => typeof message === "object" && message !== null && "kind" in message && message.kind === "draft" && "state" in message &&
        typeof message.state === "object" && message.state !== null && "kind" in message.state && message.state.kind === "ready"), "Disposing the sidebar must preserve the host-held preview");
      replacement.panel.dispose();
      const renamed = { ...initial, name: "Updated while closed", revision: initial.revision + 1 };
      view.update(renamed);
      const latest = attach(); await latest.ready;
      assert.ok(latest.panel.webview.html.includes("Updated while closed"));
      assert.equal(panelsCreated, 0);
    } finally { view.dispose(); for (const panel of surfaces) panel.dispose(); }
  });
});
