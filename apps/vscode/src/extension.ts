import * as vscode from "vscode";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { GoalInterpreter } from "./goal-interpreter.js";
import { CodexAppServerWorker } from "./codex-app-server-worker.js";
import { SqliteProjectRepository } from "./sqlite-project-repository.js";
import { assertStorageOutsideRepository } from "./storage-boundary.js";
import { TaskRunner } from "./task-runner.js";
import { WorkView } from "./work-view.js";
import type {
  ExecutionGrant,
  ProjectSnapshot,
  ProposedTask,
} from "../../../packages/core/src/index.js";
import { ownsWriter } from "../../../packages/core/src/index.js";

const execute = promisify(execFile);
const isTrusted = (): boolean => vscode.workspace.isTrusted;
const approvedCommands = [{ argv: ["git", "status", "--short"] }] as const;

export function codexMediationVersion(stdout: string): string | undefined {
  const match = /^codex-cli (\d+\.\d+\.\d+)\s*$/.exec(stdout);
  return match?.[1] === "0.164.0" ? match[1] : undefined;
}

export function approvalSummary(input: {
  readonly task: ProposedTask;
  readonly repositoryRoot: string;
}): string {
  const { task, repositoryRoot } = input;
  return [
    `Task: ${task.title}`,
    `Plan version: ${String(task.planVersion)}`,
    `Writable root: ${repositoryRoot}`,
    `Exact commands: ${approvedCommands.map(({ argv }) => JSON.stringify(argv)).join(", ")}`,
    `Attempts: ${String(task.proposedBudget.maxAttempts)}`,
    `Elapsed time: ${String(task.proposedBudget.maxElapsedMinutes)} minutes`,
    `Tokens: ${task.proposedBudget.maxTokens.toLocaleString("en-US")} observed soft budget. Codex 0.164.0 does not expose a hard token limit.`,
  ].join("\n");
}

export function approvedExecutionGrant(input: {
  readonly approvalId: string;
  readonly task: ProposedTask;
  readonly repositoryRoot: string;
  readonly cliVersion: string | undefined;
  readonly confirmed: boolean;
}): ExecutionGrant | undefined {
  if (!input.confirmed || input.cliVersion !== "0.164.0") return undefined;
  return {
    approvalId: input.approvalId,
    taskId: input.task.taskId,
    planVersion: input.task.planVersion,
    repositoryRoot: input.repositoryRoot,
    writableRoot: input.repositoryRoot,
    commands: approvedCommands,
    budget: input.task.proposedBudget,
  };
}

export function runnableTasks(project: ProjectSnapshot): readonly ProposedTask[] {
  if (project.runs.some(ownsWriter)) return [];
  return project.tasks.filter((task) => {
    if (task.state.kind === "unapproved") return true;
    const attempts = project.runs.filter(
      ({ taskId }) => taskId === task.taskId,
    ).length;
    return attempts < task.proposedBudget.maxAttempts;
  });
}

export function activate(context: vscode.ExtensionContext): void {
  const view = new WorkView();
  const interpreter = new GoalInterpreter();
  const output = vscode.window.createOutputChannel("Piarre");
  let repository: SqliteProjectRepository | undefined;
  let repositoryRoot: string | undefined;
  let worker: CodexAppServerWorker | undefined;
  let opening: Promise<void> | undefined;
  let generation = 0;
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
      repositoryRoot = root;
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
        worker?.close();
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
    vscode.commands.registerCommand("piarre.approveAndRunTask", async () => {
      if (!isTrusted()) return;
      if (!repository) await requestOpen(true);
      if (!repository || !repositoryRoot || !isTrusted()) return;
      const current = repository;
      const root = repositoryRoot;
      const observedGeneration = generation;
      try {
        const before = current.read();
        const runnable = runnableTasks(before);
        if (runnable.length === 0) {
          await vscode.window.showInformationMessage(
            before.runs.some((run) =>
              run.state === "reserved" ||
              run.state === "running" ||
              run.state === "reconciliation-required",
            )
              ? "A coding task already owns the repository writer."
              : "No unapproved task is ready to run.",
          );
          return;
        }
        const task =
          runnable.length === 1
            ? runnable[0]
            : await vscode.window
                .showQuickPick(
                  runnable.map((candidate) => ({
                    label: candidate.title,
                    description: candidate.taskId,
                    task: candidate,
                  })),
                  { placeHolder: "Choose one task to approve and run" },
                )
                .then((selection) => selection?.task);
        if (!task) return;
        const { stdout } = await execute("codex", ["--version"], {
          cwd: root,
          timeout: 5000,
          maxBuffer: 1024 * 1024,
        });
        const cliVersion = codexMediationVersion(stdout);
        if (!cliVersion) {
          await vscode.window.showErrorMessage(
            "Piarre cannot run this task because the installed Codex version has not passed the command-mediation probe.",
          );
          return;
        }
        const approvedState =
          task.state.kind === "approved" ? task.state : undefined;
        const existingGrant = approvedState
          ? before.grants.find(
              ({ approvalId }) => approvalId === approvedState.approvalId,
            )
          : undefined;
        const approvalId = existingGrant?.approvalId ?? randomUUID();
        let grant = existingGrant;
        if (!grant) {
          const approved = await vscode.window.showInformationMessage(
            approvalSummary({ task, repositoryRoot: root }),
            { modal: true },
            "Approve and Run",
          );
          grant = approvedExecutionGrant({
            approvalId,
            task,
            repositoryRoot: root,
            cliVersion,
            confirmed: approved === "Approve and Run",
          });
        }
        if (
          !grant ||
          !isTrusted() ||
          repository !== current ||
          generation !== observedGeneration
        )
          return;
        const approval = existingGrant
          ? { kind: "duplicate" as const, snapshot: before }
          : current.dispatch({
              commandId: randomUUID(),
              projectId: before.projectId,
              expectedProjectRevision: before.revision,
              action: { kind: "approve-task", grant },
            });
        if (approval.kind !== "applied" && approval.kind !== "duplicate") {
          await vscode.window.showWarningMessage(
            "The task changed before approval. Review the latest Work view and try again.",
          );
          return;
        }
        worker?.close();
        worker = new CodexAppServerWorker({
          mediationEvidence: {
            cliVersion,
            approvalPolicy: "untrusted",
            sandboxPolicy: "workspaceWrite",
          },
        });
        const capabilities = await worker.capabilities();
        view.show(approval.snapshot, capabilities);
        const runner = new TaskRunner(current, worker);
        const runId = randomUUID();
        const started = await runner.startTask({
          taskId: task.taskId,
          approvalId,
          runId,
          adapterId: "codex-app-server",
          prompt: [
            task.title,
            ...task.requirements.map(({ text }) => `Requirement: ${text}`),
            `Writable root: ${root}`,
            `Approved commands: ${approvedCommands.map(({ argv }) => argv.join(" ")).join(", ")}`,
          ].join("\n"),
          reservationCommandId: randomUUID(),
          bindCommandId: randomUUID(),
          terminalCommandId: randomUUID(),
        });
        view.show(current.read(), capabilities);
        if (started.kind !== "started") {
          output.appendLine(`Run ${runId}: ${started.kind}`);
          return;
        }
        const activeWorker = worker;
        void (async () => {
          try {
            for await (const observation of activeWorker.observe(started.ref)) {
              output.appendLine(
                observation.kind === "message"
                  ? `Run ${runId}: worker message observed`
                  : `Run ${runId}: ${observation.kind}`,
              );
            }
            if (repository === current && generation === observedGeneration) {
              await runner.settle({
                runId,
                ref: started.ref,
                commandId: randomUUID(),
              });
              view.show(current.read(), capabilities);
            }
          } catch (error) {
            output.appendLine(
              `Run ${runId}: observation failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        })();
      } catch (error) {
        await vscode.window.showErrorMessage(
          `Piarre could not run the task. ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      void requestOpen(false);
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      generation += 1;
      opening = undefined;
      repository?.close();
      repository = undefined;
      repositoryRoot = undefined;
      worker?.close();
      worker = undefined;
      view.dispose();
      void requestOpen(false);
    }),
  );
  void requestOpen(false);
}
