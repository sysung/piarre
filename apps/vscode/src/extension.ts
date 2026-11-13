import { registerDiagnosticCommands } from "./diagnostic-commands.js";
import { parseProviderConfiguration } from "../../../packages/core/src/inspection.js";
import type { SuppliedSource } from "../../../packages/core/src/supplied-source.js";
import { selectSharedFiles } from "./source-sharing.js";
import { assertSharedFilesCurrent } from "./file-context.js";
import { CoordinationController } from "./coordination-controller.js";
import { CoordinationUi } from "./coordination-ui.js";
import { ReflectionController } from "./reflection-controller.js";
import { ExecutionCoordinator } from "./execution-coordinator.js";
import { ExecutionUi } from "./execution-ui.js";
import { canonicalWorkspacePath } from "./workspace-path.js";
import { ownsExecutionLease, type ProjectSnapshot } from "../../../packages/core/src/index.js";
import { KnowledgeController } from "./knowledge-controller.js";
import * as vscode from "vscode";
import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { conversationPrompt, conversationRecordSources, ConversationController } from "./conversation-controller.js";
import { CodexConversationClient } from "./codex-conversation-client.js";
import { GoalInterpreter } from "./goal-interpreter.js";
import { SqliteProjectRepository } from "./sqlite-project-repository.js";
import { assertStorageOutsideRepository } from "./storage-boundary.js";
import { findRepositoryRoot } from "./repository-root.js";
import { WorkView } from "./work-view.js";


const isTrusted = (): boolean => vscode.workspace.isTrusted;

type ProjectControllers = {
  readonly coordination: CoordinationController;
  readonly coordinationUi: CoordinationUi;
  readonly conversation: ConversationController;
  readonly reflection: ReflectionController;
  readonly knowledge: KnowledgeController;
};
type ProjectPhase =
  | { readonly kind: "preparing" }
  | { readonly kind: "retired" }
  | { readonly kind: "reconciling"; readonly execution: ExecutionUi }
  | { readonly kind: "ready"; readonly execution: ExecutionUi; readonly controllers: ProjectControllers };
type ProjectScope = {
  readonly repositoryUri: string;
  readonly repository: SqliteProjectRepository;
  readonly cleanup: Array<() => void>;
  executionPaths: Set<string>;
  refreshTimer?: NodeJS.Timeout;
  phase: ProjectPhase;
};
type OpenAttempt = { readonly interactive: boolean; readonly promise: Promise<void> };

export function activate(context: vscode.ExtensionContext): void {
  const interpreter = new GoalInterpreter();
  const output = vscode.window.createOutputChannel("Piarre");
  let currentProject: ProjectScope | undefined;
  let opening: OpenAttempt | undefined;
  let disposed = false;
  const stopWork = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  stopWork.text = "$(debug-stop) Piarre: Stop work";
  stopWork.command = "piarre.stopAll";
  stopWork.tooltip = "Request stop and prevent new scheduling. Unknown effects require reconciliation.";
  const createClient = () => new CodexConversationClient({ command: vscode.workspace.getConfiguration("piarre").inspect<string>("codexExecutable")?.globalValue ?? "codex" });
  const isCurrent = (scope: ProjectScope): boolean => currentProject === scope && !disposed && isTrusted();
  const selected = (): ProjectScope | undefined => isTrusted() ? currentProject : undefined;
  const controllers = (scope: ProjectScope | undefined): ProjectControllers | undefined => scope?.phase.kind === "ready" ? scope.phase.controllers : undefined;
  const execution = (scope: ProjectScope | undefined): ExecutionUi | undefined => scope?.phase.kind === "ready" || scope?.phase.kind === "reconciling" ? scope.phase.execution : undefined;
  const describe = (error: unknown): string => error instanceof Error ? error.message : String(error);

  function disposeScope(scope: ProjectScope): unknown[] {
    if (scope.phase.kind === "retired") return [];
    scope.phase = { kind: "retired" };
    const errors: unknown[] = [];
    const release = (cleanup: () => void): void => {
      try { cleanup(); } catch (error) { errors.push(error); }
    };
    if (scope === currentProject) {
      currentProject = undefined;
      release(() => { stopWork.hide(); });
      release(() => { view.detachProject(); });
    }
    for (const cleanup of scope.cleanup.reverse()) release(cleanup);
    scope.cleanup.length = 0;
    return errors;
  }

  function reportCleanup(errors: unknown[]): void {
    for (const error of errors) output.appendLine(`Could not release a Piarre project resource: ${describe(error)}`);
  }

  const publishExecution = (scope: ProjectScope, project: ProjectSnapshot): void => {
    if (!isCurrent(scope)) return;
    scope.executionPaths = new Set(project.executionRuns.flatMap(run => run.grant.plan.files.flatMap(file => [canonicalWorkspacePath(path.join(run.grant.plan.sourceRoot, file.relativePath)), canonicalWorkspacePath(path.join(run.grant.plan.candidateRoot, file.relativePath))])));
    if (project.executionRuns.some(ownsExecutionLease)) stopWork.show(); else stopWork.hide();
    view.update(project);
  };
  const queueExecutionRefresh = (scope: ProjectScope, uri: vscode.Uri): void => {
    if (!isCurrent(scope) || uri.scheme !== "file" || !scope.executionPaths.has(canonicalWorkspacePath(uri.fsPath))) return;
    if (scope.refreshTimer) clearTimeout(scope.refreshTimer);
    scope.refreshTimer = setTimeout(() => {
      if (!isCurrent(scope)) return;
      try { execution(scope)?.refresh(); } catch { output.appendLine("Scoped files could not be rechecked. Open the recorded run and reconcile before accepting work."); }
    }, 100);
  };
  const queueDocumentRefresh = (uri: vscode.Uri): void => {
    const scope = selected();
    if (scope) queueExecutionRefresh(scope, uri);
  };
  const stopOtherWork = (scope: ProjectScope | undefined) => {
    const ready = controllers(scope);
    return [ready?.conversation.interrupt(), ready?.coordination.stopAll()];
  };
  const view = new WorkView(vscode.window.createWebviewPanel, {
    prepare: (goal) => interpreter.propose(goal),
    deleteProposal: (snapshot, groupId, commandId) => {
      const scope = selected();
      if (!scope) return;
      const result = scope.repository.dispatch({ commandId, projectId: snapshot.projectId,
        expectedProjectRevision: snapshot.revision, action: { kind: "delete-proposal", groupId } });
      return result.kind === "applied" || result.kind === "duplicate" ? result.snapshot : undefined;
    },
    save: (snapshot, draft, commandId) => {
      const scope = selected();
      if (!scope) return;
      const result = scope.repository.dispatch({ commandId, projectId: snapshot.projectId,
        expectedProjectRevision: snapshot.revision, action: { kind: "propose-tasks", draft } });
      if (result.kind !== "applied" && result.kind !== "duplicate") return;
      view.update(result.snapshot);
      return result.snapshot;
    },
  }, undefined, {
    connect: async () => { await controllers(selected())?.conversation.connect(); },
    disconnect: () => controllers(selected())?.conversation.disconnect(),
    send: async text => {
      const scope = selected();
      const conversation = controllers(scope)?.conversation;
      if (!scope || !conversation) return;
      const snapshot = scope.repository.read();
      if (snapshot.schedulingPaused) { await vscode.window.showInformationMessage("Project scheduling is paused. Resume scheduling before sending another model request."); return; }
      const files = await selectSharedFiles(snapshot, () => isCurrent(scope));
      if (!files || !isCurrent(scope)) return;
      const detail = conversationPrompt(snapshot, text, [...conversationRecordSources(snapshot), ...files]);
      if (await vscode.window.showWarningMessage("Send this discussion context to Codex?", { modal: true, detail: `Shares project recommendation records and these exact file excerpts. Account cost and quota are unknown. Source prose is data, never authority.\n${detail}` }, "Send reviewed context") !== "Send reviewed context" || !isCurrent(scope)) return;
      assertSharedFilesCurrent(scope.repository.read(), files);
      await conversation.send(text, files, snapshot.revision);
    },
    interrupt: async () => { await controllers(selected())?.conversation.interrupt(); },
    knowledge: async (kind, id) => { await controllers(selected())?.knowledge.handle(kind, id); },
  }, {
    handle: async (message, originCurrent) => {
      const scope = selected();
      const operation = execution(scope)?.handle(message, originCurrent);
      if (message.action === "pause-all") await Promise.allSettled([operation, ...stopOtherWork(scope)]);
      else await operation;
    },
    renderDetails: runId => execution(selected())?.renderDetails(runId) ?? "",
  }, { handle: async message => { await controllers(selected())?.coordinationUi.handle(message); } });

  const open = async (attempt: OpenAttempt): Promise<void> => {
    const canOpen = (): boolean => opening === attempt && !disposed && isTrusted();
    if (!isTrusted()) {
      if (attempt.interactive) await vscode.window.showInformationMessage("Trust this workspace before opening a Piarre project.");
      return;
    }
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
      if (attempt.interactive) await vscode.window.showInformationMessage("Open a local Git repository folder in VS Code, then run Piarre: Open.");
      return;
    }
    const folder = folders.length === 1 ? folders[0] : attempt.interactive
      ? await vscode.window.showWorkspaceFolderPick({ placeHolder: "Choose a repository for Piarre" }) : undefined;
    if (!folder || folder.uri.scheme !== "file" || !canOpen()) return;
    const root = await findRepositoryRoot(folder.uri.fsPath);
    if (!canOpen()) return;
    const repositoryUri = vscode.Uri.file(root).toString();
    if (currentProject?.repositoryUri === repositoryUri) {
      execution(currentProject)?.refresh();
      view.show(currentProject.repository.read());
      return;
    }
    if (currentProject) reportCleanup(disposeScope(currentProject));
    const key = createHash("sha256").update(repositoryUri).digest("hex");
    const storage = path.join(context.globalStorageUri.fsPath, "projects", key);
    await assertStorageOutsideRepository({ repositoryRoot: root, storagePath: storage });
    if (!canOpen()) return;
    const executionStorage = path.join(storage, "execution");
    await mkdir(executionStorage, { recursive: true });
    if (!canOpen()) return;
    const repository = new SqliteProjectRepository(path.join(storage, "project.sqlite"));
    const scope: ProjectScope = { repositoryUri, repository, cleanup: [() => { repository.close(); }], executionPaths: new Set(), phase: { kind: "preparing" } };
    try {
      const project = repository.open({ repositoryUri, name: path.basename(root) });
      const update = (snapshot: ProjectSnapshot): void => { if (isCurrent(scope)) view.update(snapshot); };
      const coordinator = new ExecutionCoordinator({ repository, storageDirectory: executionStorage, createClient, publish: snapshot => { publishExecution(scope, snapshot); },
        readProviderConfiguration: () => parseProviderConfiguration(vscode.workspace.getConfiguration("piarre").get<unknown>("providers", [])),
        confirmSpending: async detail => isCurrent(scope) && await vscode.window.showWarningMessage("Authorize possible paid usage for this attempt?", { modal: true, detail }, "Authorize this attempt") === "Authorize this attempt" && isCurrent(scope) ? "consent" : "cancel",
        hasDirtyDocuments: paths => {
          const scoped = new Set(paths.map(canonicalWorkspacePath));
          return vscode.workspace.textDocuments.some(document => document.isDirty && document.uri.scheme === "file" && scoped.has(canonicalWorkspacePath(document.uri.fsPath)));
        } });
      let disposeExecution = () => { coordinator.dispose(); };
      scope.cleanup.push(() => { disposeExecution(); });
      const executionUi = new ExecutionUi(coordinator, () => repository.read(), runId => { if (isCurrent(scope)) view.openExecutionResult(runId); });
      disposeExecution = () => { executionUi.dispose(); };
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, "**/*"));
      scope.cleanup.push(() => { watcher.dispose(); });
      scope.cleanup.push(() => { clearTimeout(scope.refreshTimer); });
      const refresh = (uri: vscode.Uri): void => { queueExecutionRefresh(scope, uri); };
      watcher.onDidChange(refresh); watcher.onDidCreate(refresh); watcher.onDidDelete(refresh);
      const baseline = repository.beginVisit();
      scope.phase = { kind: "reconciling", execution: executionUi };
      currentProject = scope;
      view.setVisit(project.projectId, baseline, revision => { if (isCurrent(scope)) repository.recordVisitedRevision(project.projectId, revision); });
      view.show(project);
      publishExecution(scope, project);
      await coordinator.reconcile();
      if (!isCurrent(scope)) return;
      coordinator.refreshWorkspaceFreshness();
      const reflection = new ReflectionController(repository, update, () => { if (isCurrent(scope)) view.close(); });
      scope.cleanup.push(() => { reflection.dispose(); });
      if (project.reflections.some(item => item.status === "pending")) output.appendLine("Pending optional reflection recovered. Run Piarre: Review Reflection when ready. Work and agent controls remain available.");
      const knowledge = new KnowledgeController(repository, update, (projectId, result) => { if (isCurrent(scope)) view.updateLookup(projectId, result); });
      scope.cleanup.push(() => { knowledge.dispose(); });
      const canShare = (sources: readonly SuppliedSource[]): boolean => {
        if (!isCurrent(scope)) return false;
        const files = new Set(sources.flatMap(({ reference }) => reference.kind === "file" ? [canonicalWorkspacePath(path.join(root, reference.path))] : []));
        return !vscode.workspace.textDocuments.some(document => document.isDirty && document.uri.scheme === "file" && files.has(canonicalWorkspacePath(document.uri.fsPath)));
      };
      const coordination = new CoordinationController(repository, update, createClient, canShare);
      scope.cleanup.push(() => { coordination.dispose(); });
      const coordinationUi = new CoordinationUi(coordination, () => repository.read(), groupId => { if (isCurrent(scope)) view.openProposal(groupId); }, () => isCurrent(scope));
      const conversation = new ConversationController(repository, (snapshot, state) => { if (isCurrent(scope)) view.updateConversation(snapshot, state); }, createClient, canShare);
      scope.cleanup.push(() => { conversation.dispose(); });
      scope.phase = { kind: "ready", execution: executionUi, controllers: { reflection, knowledge, coordination, coordinationUi, conversation } };
    } catch (error) {
      const report = canOpen() || isCurrent(scope);
      const errors = disposeScope(scope);
      if (report) reportCleanup(errors);
      throw error;
    }
  };

  const requestOpen = (interactive: boolean): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (opening && (!interactive || opening.interactive || vscode.workspace.workspaceFolders?.length === 1)) return opening.promise;
    const attempt: OpenAttempt = { interactive, promise: Promise.resolve()
      .then(() => { if (opening === attempt && !disposed) return open(attempt); })
      .catch(async (error: unknown) => {
        if (opening !== attempt || disposed || !isTrusted()) return;
        output.appendLine(`Could not open project: ${describe(error)}`);
        if (interactive) await vscode.window.showErrorMessage(`Piarre could not open the project. ${describe(error)}`);
      })
      .finally(() => { if (opening === attempt) opening = undefined; }) };
    opening = attempt;
    return attempt.promise;
  };

  context.subscriptions.push(
    { dispose: () => {
      if (disposed) return;
      disposed = true;
      opening = undefined;
      if (currentProject) reportCleanup(disposeScope(currentProject));
    } },
    registerDiagnosticCommands(context, () => selected()?.repository),
    view,
    output,
    stopWork,
    vscode.workspace.onDidChangeTextDocument(event => { queueDocumentRefresh(event.document.uri); }),
    vscode.workspace.onDidSaveTextDocument(document => { queueDocumentRefresh(document.uri); }),
    vscode.commands.registerCommand("piarre.open", () => requestOpen(true)),
    vscode.commands.registerCommand("piarre.endSession", async () => { await controllers(selected())?.reflection.handle("end"); }),
    vscode.commands.registerCommand("piarre.reviewReflection", async () => { await controllers(selected())?.reflection.handle("review"); }),
    vscode.commands.registerCommand("piarre.explanationPreference", async () => { await controllers(selected())?.reflection.handle("preference"); }),
    vscode.commands.registerCommand("piarre.stopAll", async () => {
      const scope = selected();
      const operation = execution(scope)?.handle({ kind: "execution", action: "pause-all" });
      await Promise.allSettled([operation, ...stopOtherWork(scope)]);
    }),
    vscode.commands.registerCommand("piarre.renameProject", async () => {
      if (!currentProject) await requestOpen(true);
      const scope = selected();
      if (!scope) return;
      try {
        const snapshot = scope.repository.read();
        const name = await vscode.window.showInputBox({
          prompt: "Project name",
          value: snapshot.name,
          validateInput: (value) =>
            value.trim() && value.length <= 200
              ? undefined
              : "Enter a name of 1 to 200 characters.",
        });
        if (name === undefined || !isCurrent(scope)) return;
        const result = scope.repository.dispatch({
          commandId: randomUUID(),
          projectId: snapshot.projectId,
          expectedProjectRevision: snapshot.revision,
          action: { kind: "rename-project", name: name.trim() },
        });
        if (result.kind === "applied" || result.kind === "duplicate")
          view.show(result.snapshot);
        else
          await vscode.window.showWarningMessage("The project changed. Run Piarre: Open and try again.");
      } catch (error) {
        if (isCurrent(scope)) await vscode.window.showErrorMessage(`Piarre could not rename the project. ${describe(error)}`);
      }
    }),
    vscode.commands.registerCommand("piarre.proposeTask", async (commandGoal: unknown) => {
      if (!currentProject) await requestOpen(true);
      const scope = selected();
      if (!scope) return;
      try {
        const snapshot = scope.repository.read();
        const goal = typeof commandGoal === "string" ? commandGoal : await vscode.window.showInputBox({
          prompt: "What should Piarre help you accomplish?",
          validateInput: (value) => value.trim() ? undefined : "Enter a goal.",
        });
        if (!goal?.trim() || !isCurrent(scope)) return;
        const draft = await interpreter.propose(goal.trim());
        if (!isCurrent(scope)) return;
        const result = scope.repository.dispatch({
          commandId: randomUUID(),
          projectId: snapshot.projectId,
          expectedProjectRevision: snapshot.revision,
          action: { kind: "propose-tasks", draft },
        });
        if (result.kind === "applied" || result.kind === "duplicate")
          view.show(result.snapshot);
        else
          await vscode.window.showWarningMessage("The project changed. Review the latest Work view and try again.");
      } catch (error) {
        if (isCurrent(scope)) await vscode.window.showErrorMessage(`Piarre could not create the proposal. ${describe(error)}`);
      }
    }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => { void requestOpen(false); }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      opening = undefined;
      if (currentProject) reportCleanup(disposeScope(currentProject));
      void requestOpen(false);
    }),
  );
  void requestOpen(false);
}
