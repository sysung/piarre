import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import * as vscode from "vscode";
import { intentDocumentHash, intentDocumentPath, renderIntentMarkdown } from "../../../../packages/core/src/intent-document.js";

const nativeSuite = process.env.PIARRE_INTENT_NATIVE === "1" ? suite : suite.skip;
nativeSuite("Native intent document commands", () => {
  test("actual extension cancels, adopts an exact document, and exports a readable handoff", async () => {
    const folder = vscode.workspace.workspaceFolders?.[0]; assert.ok(folder);
    const id = `native-${randomUUID()}`;
    const markdown = renderIntentMarkdown({ id, topic: "Native resumption", category: "decision", author: "Agent-authored proposal",
      statement: "Keep model optimization paused for this prototype.", rationale: "Test the user's workflow first.", scope: "Piarre prototype", sources: "User-approved implementation plan", linkedTaskIds: [], openQuestions: "Does this reduce human maintenance effort?" });
    const documentPath = path.join(folder.uri.fsPath, intentDocumentPath(id));
    mkdirSync(path.dirname(documentPath), { recursive: true }); writeFileSync(documentPath, markdown);
    const snapshot = path.join(folder.uri.fsPath, `.piarre/accepted/${intentDocumentHash(markdown)}.md`);
    await vscode.commands.executeCommand("piarre.open");
    const warning = Object.getOwnPropertyDescriptor(vscode.window, "showWarningMessage");
    const information = Object.getOwnPropertyDescriptor(vscode.window, "showInformationMessage");
    assert.ok(warning && information);
    let accept = false;
    let reviewed = 0;
    try {
      Object.defineProperty(vscode.window, "showWarningMessage", { ...warning, value: (message: string, options: { readonly detail?: string }, ...items: readonly string[]) => {
        if (!message.startsWith("Adopt this version of Native resumption?")) throw new Error(message);
        assert.equal(options.detail?.includes(markdown), true);
        assert.match(options.detail ?? "", /not independent verification or coding approval/);
        assert.equal(items[0], "Adopt reviewed version");
        reviewed++;
        return Promise.resolve(accept ? items[0] : undefined);
      } });
      await vscode.commands.executeCommand("piarre.reviewIntentDocument", id);
      assert.throws(() => readFileSync(snapshot));
      accept = true;
      await vscode.commands.executeCommand("piarre.reviewIntentDocument", id);
      assert.equal(readFileSync(snapshot, "utf8"), markdown);
      assert.equal(reviewed, 2);
      Object.defineProperty(vscode.window, "showInformationMessage", { ...information, value: (message: string, _options: unknown, ...items: readonly string[]) => {
        assert.match(message, /Save this resumption snapshot/); return Promise.resolve(items[0]);
      } });
      await vscode.commands.executeCommand("piarre.exportIntentHandoff");
      const handoff = vscode.window.activeTextEditor?.document;
      assert.ok(handoff);
      assert.ok(handoff.uri.fsPath.includes(`${path.sep}.piarre${path.sep}handoffs${path.sep}`));
      assert.match(handoff.getText(), /Keep model optimization paused/);
      assert.match(handoff.getText(), /Agent-authored proposal/);
      assert.match(handoff.getText(), /Does this reduce human maintenance effort/);
      assert.match(handoff.getText(), /not live project state or execution approval/);
    } finally {
      Object.defineProperty(vscode.window, "showWarningMessage", warning);
      Object.defineProperty(vscode.window, "showInformationMessage", information);
      rmSync(documentPath, { force: true });
    }
  }).timeout(15000);
});
