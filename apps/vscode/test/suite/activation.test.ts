import assert from "node:assert/strict";
import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, readlink } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  approvalSummary,
  approvedExecutionGrant,
  codexMediationVersion,
  runnableTasks,
} from "../../src/extension.js";
import type { ProposedTask } from "../../../../packages/core/src/index.js";

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
  test("execution approval names every effective bound", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("piarre.approveAndRunTask"));
    const task: ProposedTask = {
      taskId: "task-one",
      groupId: "group-one",
      planVersion: 1,
      state: { kind: "unapproved" },
      title: "Change one file",
      requirements: [{ key: "change", text: "Change one file." }],
      proposedScope: { included: ["src/one.ts"], excluded: [] },
      checks: [],
      proposedBudget: {
        maxAttempts: 1,
        maxElapsedMinutes: 15,
        maxTokens: 20_000,
      },
      dependsOn: [],
    };

    const summary = approvalSummary({
      task,
      repositoryRoot: "/canonical/repository",
    });

    assert.match(summary, /Change one file/);
    assert.match(summary, /Plan version: 1/);
    assert.match(summary, /Writable root: \/canonical\/repository/);
    assert.match(summary, /\["git","status","--short"\]/);
    assert.match(summary, /Attempts: 1/);
    assert.match(summary, /Elapsed time: 15 minutes/);
    assert.match(summary, /20,000 observed soft budget/);
    assert.equal(codexMediationVersion("codex-cli 0.164.0\n"), "0.164.0");
    assert.equal(codexMediationVersion("codex-cli 0.165.0\n"), undefined);
    assert.equal(
      approvedExecutionGrant({
        approvalId: "cancelled",
        task,
        repositoryRoot: "/canonical/repository",
        cliVersion: "0.164.0",
        confirmed: false,
      }),
      undefined,
    );
    assert.equal(
      approvedExecutionGrant({
        approvalId: "wrong-version",
        task,
        repositoryRoot: "/canonical/repository",
        cliVersion: undefined,
        confirmed: true,
      }),
      undefined,
    );
    const approvedTask: ProposedTask = {
      ...task,
      state: { kind: "approved", approvalId: "approval-one" },
    };
    assert.deepEqual(
      runnableTasks({
        projectId: "project-one",
        repositoryUri: "file:///canonical/repository",
        name: "repository",
        revision: 3,
        proposals: [],
        tasks: [approvedTask],
        grants: [],
        runs: [],
      }),
      [approvedTask],
    );
  });
});
