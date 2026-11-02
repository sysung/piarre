import assert from "node:assert/strict";
import * as vscode from "vscode";
import { WorkView } from "../../src/work-view.js";
import { decideProjectEvent, parseProposalOutput, replay } from "../../../../packages/core/src/index.js";

const project = replay([
  { kind: "project-created", projectId: "settings-test", repositoryUri: "file:///settings-test", name: "Settings test" },
  decideProjectEvent({ commandId: "draft", projectId: "settings-test", expectedProjectRevision: 1,
    action: { kind: "propose-tasks", draft: parseProposalOutput("Review", {
      tasks: [{ key: "review", title: "Review", requirements: [{ key: "goal", text: "Review" }],
        checks: [{ key: "check", requirementKeys: ["goal"], description: "Inspect" }],
        proposedScope: { included: [], excluded: [] },
        proposedBudget: { maxTokens: 20_000, maxAttempts: 1, maxElapsedMinutes: 15 }, dependsOn: [] }],
    }) } }),
]);
const providers = (rate: number) => [{ role: "coding", provider: "fixture-provider", model: "fixture-model",
  billing: { kind: "api", name: "API fixture", inputUsdPerMillion: rate, outputUsdPerMillion: rate } }];

suite("Provider settings in open Work views", () => {
  test("provider edits refresh existing estimates without moving focus or reopening closed views", async function () {
    this.timeout(15000);
    const settings = vscode.workspace.getConfiguration("piarre");
    const original = settings.inspect<unknown>("providers")?.globalValue;
    const panels: vscode.WebviewPanel[] = [];
    const view = new WorkView((...args) => {
      const panel = vscode.window.createWebviewPanel(...args);
      panels.push(panel);
      return panel;
    });
    async function change(value: unknown) {
      let listener: vscode.Disposable | undefined;
      const changed = new Promise<void>((resolve) => {
        listener = vscode.workspace.onDidChangeConfiguration((event) => {
          if (event.affectsConfiguration("piarre.providers")) resolve();
        });
      });
      try {
        await settings.update("providers", value, vscode.ConfigurationTarget.Global);
        await changed;
      } finally { listener?.dispose(); }
    }
    try {
      await change(providers(2));
      view.show(project);
      const panel = panels[0];
      assert.ok(panel);
      assert.ok(panel.webview.html.includes("$0.04 at the full token budget"));
      const editor = await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ content: "" }));
      await change(providers(8));
      assert.ok(panel.webview.html.includes("$0.16 at the full token budget"), "Open Work must replace the old estimate after settings change");
      assert.ok(!panel.webview.html.includes("$0.04 at the full token budget"));
      assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), editor.document.uri.toString());
      await change([]);
      assert.ok(panel.webview.html.includes("Estimated coding cost: Unknown"));
      assert.ok(!panel.webview.html.includes("$0.16 at the full token budget"));
      panel.dispose();
      await change(providers(4));
      assert.equal(panels.length, 1, "Settings changes must not reopen a closed view");
      view.show(project);
      const reopened = panels[1];
      assert.ok(reopened);
      assert.ok(reopened.webview.html.includes("$0.08 at the full token budget"));
      await change(providers(5));
      assert.ok(reopened.webview.html.includes("$0.10 at the full token budget"));
      view.close();
      await change(providers(6));
      assert.equal(panels.length, 2);
    } finally {
      view.dispose();
      await settings.update("providers", original, vscode.ConfigurationTarget.Global);
    }
  });
});
