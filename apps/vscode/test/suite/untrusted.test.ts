import assert from "node:assert/strict";
import * as vscode from "vscode";

suite("Restricted workspace", () => {
  test("does not open a project in an untrusted repository", async () => {
    assert.equal(vscode.workspace.isTrusted, false);
    const extension = vscode.extensions.getExtension("sysung.piarre");
    assert.ok(extension);
    await extension.activate();
    assert.equal(
      vscode.window.tabGroups.all.flatMap((group) => group.tabs)
        .filter((tab) => tab.label === "Piarre Work").length,
      0,
    );
  });
});
