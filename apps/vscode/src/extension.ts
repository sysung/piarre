import * as vscode from "vscode";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { GoalInterpreter } from "./goal-interpreter.js";
import { SqliteProjectRepository } from "./sqlite-project-repository.js";
import { assertStorageOutsideRepository } from "./storage-boundary.js";
import { WorkView } from "./work-view.js";

const execute = promisify(execFile);
const isTrusted = (): boolean => vscode.workspace.isTrusted;

export function activate(context: vscode.ExtensionContext): void {
  const interpreter = new GoalInterpreter();
  const output = vscode.window.createOutputChannel("Piarre");
  let repository: SqliteProjectRepository | undefined;
  let opening: Promise<void> | undefined;
  let generation = 0;
  const view = new WorkView(undefined, {
    prepare: (goal) => interpreter.propose(goal),
    save: (snapshot, draft, commandId) => {
      if (!repository || !isTrusted()) return;
      const result = repository.dispatch({ commandId, projectId: snapshot.projectId,
        expectedProjectRevision: snapshot.revision, action: { kind: "propose-tasks", draft } });
      if (result.kind !== "applied" && result.kind !== "duplicate") return;
      view.update(result.snapshot);
      return result.snapshot;
    },
  });
  const open = async (interactive: boolean, observedGeneration: number): Promise<void> => {
    const isCurrent = (): boolean => observedGeneration === generation && isTrusted();
    if (!isTrusted()) {
      if (interactive)
        await vscode.window.showInformationMessage(
          "Trust this workspace before opening a Piarre project.",
        );
      return;
    }
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
      if (interactive)
        await vscode.window.showInformationMessage(
          "Open a local Git repository folder in VS Code, then run Piarre: Open.",
        );
      return;
    }
    const folder =
      folders.length === 1
        ? folders[0]
        : interactive
          ? await vscode.window.showWorkspaceFolderPick({
              placeHolder: "Choose a repository for Piarre",
            })
          : undefined;
    if (!folder || folder.uri.scheme !== "file" || !isCurrent()) return;
    const { stdout } = await execute("git", ["rev-parse", "--show-toplevel"], {
      cwd: folder.uri.fsPath,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    const root = await realpath(stdout.trim());
    if (!isCurrent()) return;
    const repositoryUri = vscode.Uri.file(root).toString();
    const key = createHash("sha256").update(repositoryUri).digest("hex");
    const storage = path.join(context.globalStorageUri.fsPath, "projects", key);
    await assertStorageOutsideRepository({
      repositoryRoot: root,
      storagePath: storage,
    });
    await mkdir(storage, { recursive: true });
    if (!isCurrent()) return;
    const next = new SqliteProjectRepository(
      path.join(storage, "project.sqlite"),
    );
    try {
      const project = next.open({ repositoryUri, name: path.basename(root) });
      repository?.close();
      repository = next;
      view.show(project);
    } catch (error) {
      next.close();
      throw error;
    }
  };
  const requestOpen = (interactive: boolean): Promise<void> => {
    if (opening) return opening;
    const observedGeneration = generation;
    opening = open(interactive, observedGeneration)
      .catch(async (error: unknown) => {
        output.appendLine(
          `Could not open project: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (interactive)
          await vscode.window.showErrorMessage(
            `Piarre could not open the project. ${error instanceof Error ? error.message : String(error)}`,
          );
      })
      .finally(() => {
        if (observedGeneration === generation) opening = undefined;
      });
    return opening;
  };
  context.subscriptions.push(
    view,
    output,
    {
      dispose: () => {
        repository?.close();
      },
    },
    vscode.commands.registerCommand("piarre.open", () => requestOpen(true)),
    vscode.commands.registerCommand("piarre.renameProject", async () => {
      if (!repository) await requestOpen(true);
      if (!repository || !isTrusted()) return;
      const current = repository;
      try {
      const snapshot = current.read();
      const name = await vscode.window.showInputBox({
        prompt: "Project name",
        value: snapshot.name,
        validateInput: (value) =>
          value.trim() && value.length <= 200
            ? undefined
            : "Enter a name of 1 to 200 characters.",
      });
      if (name === undefined || !isTrusted() || repository !== current) return;
        const result = current.dispatch({
          commandId: randomUUID(),
          projectId: snapshot.projectId,
          expectedProjectRevision: snapshot.revision,
          action: { kind: "rename-project", name: name.trim() },
        });
        if (result.kind === "applied" || result.kind === "duplicate")
          view.show(result.snapshot);
        else
          await vscode.window.showWarningMessage(
            "The project changed. Run Piarre: Open and try again.",
          );
      } catch (error) {
        await vscode.window.showErrorMessage(
          `Piarre could not rename the project. ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
    vscode.commands.registerCommand(
      "piarre.proposeTask",
      async (commandGoal: unknown) => {
        if (!repository) await requestOpen(true);
        if (!repository || !isTrusted()) return;
        const current = repository;
        const observedGeneration = generation;
        try {
          const snapshot = current.read();
          const goal =
            typeof commandGoal === "string"
              ? commandGoal
              : await vscode.window.showInputBox({
                  prompt: "What should Piarre help you accomplish?",
                  validateInput: (value) =>
                    value.trim() ? undefined : "Enter a goal.",
                });
          if (
            goal === undefined ||
            !goal.trim() ||
            !isTrusted() ||
            repository !== current ||
            generation !== observedGeneration
          )
            return;
          const draft = await interpreter.propose(goal.trim());
          if (
            !isTrusted() ||
            repository !== current ||
            generation !== observedGeneration
          )
            return;
          const result = current.dispatch({
            commandId: randomUUID(),
            projectId: snapshot.projectId,
            expectedProjectRevision: snapshot.revision,
            action: { kind: "propose-tasks", draft },
          });
          if (result.kind === "applied" || result.kind === "duplicate")
            view.show(result.snapshot);
          else
            await vscode.window.showWarningMessage(
              "The project changed. Review the latest Work view and try again.",
            );
        } catch (error) {
          if (
            isTrusted() &&
            repository === current &&
            generation === observedGeneration
          )
            await vscode.window.showErrorMessage(
              `Piarre could not create the proposal. ${error instanceof Error ? error.message : String(error)}`,
            );
        }
      },
    ),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      void requestOpen(false);
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      generation += 1;
      opening = undefined;
      repository?.close();
      repository = undefined;
      view.close();
      void requestOpen(false);
    }),
  );
  void requestOpen(false);
}
