import assert from "node:assert/strict";
import * as vscode from "vscode";

suite("Piarre extension", () => {
  test("activates by executing Piarre: Open", async () => {
    const extension = vscode.extensions.getExtension("sysung.piarre");

    assert.ok(extension, "Piarre extension must be installed in the test host");
    assert.equal(extension.isActive, false);

    await vscode.commands.executeCommand("piarre.open");

    assert.equal(extension.isActive, true);
  });
});
