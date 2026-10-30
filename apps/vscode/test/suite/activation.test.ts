import assert from "node:assert/strict";
import * as vscode from "vscode";
import { DatabaseSync } from "node:sqlite";

suite("Piarre extension", () => {
  test("Extension Host supports transactional SQLite", () => {
    const database = new DatabaseSync(":memory:");
    try {
      database.exec(
        "BEGIN IMMEDIATE; CREATE TABLE probe(value INTEGER); INSERT INTO probe VALUES (1); COMMIT;",
      );
      assert.equal(database.prepare("SELECT value FROM probe").get()?.value, 1);
    } finally {
      database.close();
    }
  });
  test("activates by executing Piarre: Open", async () => {
    const extension = vscode.extensions.getExtension("sysung.piarre");

    assert.ok(extension, "Piarre extension must be installed in the test host");
    await vscode.commands.executeCommand("piarre.open");

    assert.equal(extension.isActive, true);
    assert.equal(vscode.workspace.isTrusted, true);
    const panels = vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .filter((tab) => tab.label === "Piarre Work");
    assert.equal(panels.length, 1);
    await vscode.commands.executeCommand("piarre.open");
    assert.equal(
      vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .filter((tab) => tab.label === "Piarre Work").length,
      1,
    );
  });
});
