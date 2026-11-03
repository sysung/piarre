import assert from "node:assert/strict";
import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, readlink } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

async function inventory(root: string, relative = ""): Promise<readonly string[]> {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const records: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const childRelative = path.join(relative, entry.name);
    const child = path.join(root, childRelative);
    const metadata = await lstat(child);
    if (entry.isDirectory()) {
      records.push(`directory\t${childRelative}\t${String(metadata.mode)}`);
      records.push(...(await inventory(root, childRelative)));
    } else if (entry.isSymbolicLink()) {
      records.push(
        `symlink\t${childRelative}\t${String(metadata.mode)}\t${await readlink(child)}`,
      );
    } else {
      const digest = createHash("sha256").update(await readFile(child)).digest("hex");
      records.push(`file\t${childRelative}\t${String(metadata.mode)}\t${digest}`);
    }
  }
  return records;
}

async function waitForWorkTab(): Promise<void> {
  const count = (): number => vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => tab.label === "Piarre Work").length;
  if (count() === 1) return;
  await new Promise<void>((resolve, reject) => {
    const listener = vscode.window.tabGroups.onDidChangeTabs(() => {
      if (count() !== 1) return;
      clearTimeout(timeout);
      listener.dispose();
      resolve();
    });
    const timeout = setTimeout(() => {
      listener.dispose();
      reject(new Error(`Expected one Piarre Work tab after opening; observed ${String(count())}`));
    }, 5000);
  });
}

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
    const extension = vscode.extensions.getExtension(process.env.PIARRE_PACKAGE_ID ?? "sysung.piarre");

    assert.ok(extension, "Piarre extension must be installed in the test host");
    await vscode.commands.executeCommand("piarre.open");

    assert.equal(extension.isActive, true);
    assert.equal(vscode.workspace.isTrusted, true);
    await waitForWorkTab();
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
  test("typed proposal command leaves the selected repository unchanged", async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder);
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("piarre.proposeTask"));
    const before = await inventory(folder.uri.fsPath);

    await vscode.commands.executeCommand(
      "piarre.proposeTask",
      "Add a pricing page",
    );

    assert.deepEqual(await inventory(folder.uri.fsPath), before);
  });
});
