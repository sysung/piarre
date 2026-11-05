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
import { conversationHistory, ownsExecutionLease, type ProjectSnapshot, type SessionAction } from "../../../packages/core/src/index.js";
import { KnowledgeController } from "./knowledge-controller.js";
import * as vscode from "vscode";
import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { ConversationController } from "./conversation-controller.js";
import { resolveConversationContext } from "./conversation-context.js";
import { conversationProviderLabel } from "../../../packages/core/src/conversation.js";
import { DockerModelRunnerConversationClient, localDiscussionDefaults, parseLocalDiscussionConfiguration } from "./docker-model-runner-conversation-client.js";
import { CodexConversationClient } from "./codex-conversation-client.js";
import { GoalInterpreter } from "./goal-interpreter.js";
import { SqliteProjectRepository } from "./sqlite-project-repository.js";
import { assertStorageOutsideRepository } from "./storage-boundary.js";
import { findRepositoryRoot } from "./repository-root.js";
import { WorkView } from "./work-view.js";


const isTrusted = (): boolean => vscode.workspace.isTrusted;

export function activate(context: vscode.ExtensionContext): void {
  const interpreter = new GoalInterpreter();
  const output = vscode.window.createOutputChannel("Piarre");
  let repository: SqliteProjectRepository | undefined;
  let conversation: ConversationController | undefined;
  let coordination: CoordinationController | undefined;
  let coordinationUi: CoordinationUi | undefined;
  let knowledge: KnowledgeController | undefined;
  let reflection: ReflectionController | undefined;
  let execution: ExecutionUi | undefined;
  let executionPaths = new Set<string>();
  let refreshTimer: NodeJS.Timeout | undefined;
  let fileWatcher: vscode.FileSystemWatcher | undefined;
  const stopWork = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  stopWork.text = "$(debug-stop) Piarre: Stop work";
  stopWork.command = "piarre.stopAll";
  stopWork.tooltip = "Request stop and prevent new scheduling. Unknown effects require reconciliation.";
  const createClient = () => new CodexConversationClient({ command: vscode.workspace.getConfiguration("piarre").inspect<string>("codexExecutable")?.globalValue ?? "codex" });
  const localConfiguration = () => {
    const settings = vscode.workspace.getConfiguration("piarre");
    return parseLocalDiscussionConfiguration({ endpoint: settings.inspect<string>("localDiscussion.endpoint")?.globalValue ?? localDiscussionDefaults.endpoint,
      model: settings.inspect<string>("localDiscussion.model")?.globalValue ?? localDiscussionDefaults.model,
      digest: settings.inspect<string>("localDiscussion.digest")?.globalValue ?? localDiscussionDefaults.digest });
  };
  const publishExecution = (project: ProjectSnapshot): void => {
    executionPaths = new Set(project.executionRuns.flatMap(run => run.grant.plan.files.flatMap(file => [canonicalWorkspacePath(path.join(run.grant.plan.sourceRoot, file.relativePath)), canonicalWorkspacePath(path.join(run.grant.plan.candidateRoot, file.relativePath))])));
    if (project.executionRuns.some(ownsExecutionLease)) stopWork.show(); else stopWork.hide();
    view.update(project);
  };
  const queueExecutionRefresh = (uri: vscode.Uri): void => {
    if (uri.scheme !== "file" || !executionPaths.has(canonicalWorkspacePath(uri.fsPath))) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    const observedGeneration = generation;
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      if (observedGeneration === generation && isTrusted()) {
        try { execution?.refresh(); } catch { output.appendLine("Scoped files could not be rechecked. Open the recorded run and reconcile before accepting work."); }
      }
    }, 100);
  };
  let opening: Promise<void> | undefined;
  let generation = 0;
  const view = new WorkView(undefined, {
    prepare: (goal) => interpreter.propose(goal),
    deleteProposal: (snapshot, groupId, commandId) => {
      if (!repository || !isTrusted()) return;
      const result = repository.dispatch({ commandId, projectId: snapshot.projectId,
        expectedProjectRevision: snapshot.revision, action: { kind: "delete-proposal", groupId } });
      return result.kind === "applied" || result.kind === "duplicate" ? result.snapshot : undefined;
    },
    save: (snapshot, draft, commandId, sessionId) => {
      if (!repository || !isTrusted()) return;
      const result = repository.dispatch({ commandId, projectId: snapshot.projectId,
        expectedProjectRevision: snapshot.revision, action: { kind: "propose-tasks", draft, ...(sessionId && { sessionId }) } });
      if (result.kind !== "applied" && result.kind !== "duplicate") return;
      view.update(result.snapshot);
      return result.snapshot;
    },
  }, undefined, {
    connect: async route => { if (isTrusted()) await conversation?.connect(route); },
    selectRoute: (route, selectionChanged) => { if (isTrusted()) conversation?.selectRoute(route, selectionChanged); },
    localModel: () => vscode.workspace.getConfiguration("piarre").inspect<string>("localDiscussion.model")?.globalValue ?? localDiscussionDefaults.model,
    disconnect: () => conversation?.disconnect(),
    models: async () => {
      if (!isTrusted()) return [];
      const profiles = await conversation?.models() ?? [];
      return profiles.map(profile => profile.model);
    },
    send: async (text, sessionId, selectedModel, attachFiles, recordIds, accepted) => {
      const local = selectedModel.startsWith("docker-model-runner::");
      const model = selectedModel.startsWith("codex::") ? selectedModel.slice(7) : local ? selectedModel.slice(21) : selectedModel;
      if (!isTrusted()) return;
      const store = repository;
      const controller = conversation;
      const snapshot = store?.read();
      if (!store || !controller || !snapshot || !snapshot.sessions.some(session => session.id === sessionId && !session.archived)) return;
      if (snapshot.schedulingPaused) { await vscode.window.showInformationMessage("Project scheduling is paused. Resume scheduling before sending another model request."); return; }
      const selected = resolveConversationContext(snapshot, recordIds);
      const records = selected.filter(source => source.reference.kind !== "file");
      const files = attachFiles ? await selectSharedFiles(snapshot, true) : [];
      if (!files) return;
      if (model && !(await controller.models()).some(profile => profile.model === model)) throw new Error("Selected model is unavailable");
      const capturedFiles = [...selected.filter(source => source.reference.kind === "file"), ...files];
      const sources = [...records, ...capturedFiles];
      if (sources.length > 20 || sources.some(source => Buffer.byteLength(source.text) > 10_000) || sources.reduce((bytes, source) => bytes + Buffer.byteLength(source.text), 0) > 60_000) {
        await vscode.window.showWarningMessage("Choose fewer references or smaller excerpts. Context allows 20 sources, 10,000 UTF-8 bytes each and 60,000 bytes total.");
        return;
      }
      assertSharedFilesCurrent(snapshot, sources);
      const reviewed = controller.review(snapshot, text, sources, sessionId, model);
      if (local !== (reviewed.route === "docker-model-runner")) throw new Error("Discussion provider selection changed. Reconnect the selected provider.");
      const detail = reviewed.prompt;
      if (await vscode.window.showWarningMessage(`Send this discussion context to ${local ? "Docker Model Runner" : "Codex"}?`, { modal: true, detail: `Model: ${model || "Codex account default"}. ${local ? "Local discussion only. Configured digest is operator supplied; installed weights and compute are not independently verified. Full prompt is limited to 6,000 UTF-8 bytes; a general 8K tokenizer/template guarantee is unverified." : "Shares this session’s recent discussion and the exact sources below. Account cost and quota are unknown."}
${detail}` }, "Send reviewed context") !== "Send reviewed context") return;
      if (repository !== store || conversation !== controller || !isTrusted()) return;
      assertSharedFilesCurrent(store.read(), capturedFiles);
      await controller.send(text, capturedFiles, snapshot.revision, { sessionId, model, recordSources: records, accepted, reviewed });
    },
    session: async (operation, id) => {
      const store = repository;
      const snapshot = store?.read();
      if (!isTrusted() || !store || !snapshot) return;
      const session = snapshot.sessions.find(item => item.id === id && !item.archived);
      if (operation !== "new" && !session) return;
      let action: SessionAction;
      if (operation === "share" && session) {
        const transcript = conversationHistory(snapshot, session.id).map(turn =>
          `You: ${turn.submitted.originalStatement}
${turn.kind === "answered" ? `${conversationProviderLabel(turn)}: ${turn.text}` : `Status: ${turn.kind}`}`).join("\n\n");
        if (await vscode.window.showInformationMessage("Copy this session’s transcript?", { modal: true, detail: "Copies the conversation to your clipboard. Source excerpts and provider identifiers are excluded." }, "Copy transcript") === "Copy transcript" && repository === store && isTrusted()) {
          await vscode.env.clipboard.writeText(`${session.title}

${transcript}`);
        }
        return;
      }
      if (operation === "archive" && session) {
        if (await vscode.window.showWarningMessage(`Remove “${session.title}” from Sessions?`, { modal: true, detail: "Conversation history is retained in the local project log and remains available to existing forks." }, "Remove session") !== "Remove session") return;
        action = { kind: "archive-session", id: session.id };
      } else if (operation === "rename" && session) {
        const title = await vscode.window.showInputBox({ title: "Rename session", value: session.title, validateInput: value => value.trim() && value.length <= 100 ? undefined : "Enter a name of 1 to 100 characters." });
        if (!title?.trim()) return;
        action = { kind: "rename-session", id: session.id, title: title.trim() };
      } else {
        action = { kind: "create-session", id: randomUUID(), title: operation === "fork" && session ? `Fork of ${session.title}`.slice(0, 100) : "New chat",
          ...(operation === "fork" && session ? { parentId: session.id } : {}) };
      }
      if (repository !== store || !isTrusted()) return;
      const result = store.dispatch({ commandId: randomUUID(), projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision, action });
      if (result.kind !== "applied" && result.kind !== "duplicate") throw new Error("Session revision changed");
      view.update(result.snapshot);
      return action.kind === "archive-session" ? undefined : action.id;
    },
    interrupt: async () => { await conversation?.interrupt(); },
    knowledge: async (kind, id) => { if (isTrusted()) await knowledge?.handle(kind, id); },
  }, {
    handle: async message => {
      if (!isTrusted()) return;
      const operation = execution?.handle(message);
      if (message.action === "pause-all") await Promise.allSettled([operation, conversation?.interrupt(), coordination?.stopAll()]);
      else await operation;
    },
    renderDetails: runId => execution?.renderDetails(runId) ?? "",
  }, { handle: async message => { if (isTrusted()) await coordinationUi?.handle(message); } }, (projectId, query) => {
    if (!isTrusted() || !repository || repository.read().projectId !== projectId) return undefined;
    return repository.readActivityEvents(query);
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
    if (!context.globalState.get<boolean>("piarre.secondarySidebar.v1")) {
      const resetLocation = "workbench.view.extension.piarre.resetViewContainerLocation";
      if ((await vscode.commands.getCommands(true)).includes(resetLocation)) {
        await vscode.commands.executeCommand(resetLocation);
        await context.globalState.update("piarre.secondarySidebar.v1", true);
        if (!isCurrent()) return;
      }
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
    const root = await findRepositoryRoot(folder.uri.fsPath);
    if (!isCurrent()) return;
    const repositoryUri = vscode.Uri.file(root).toString();
    if (repository?.read().repositoryUri === repositoryUri) {
      execution?.refresh(); view.show(repository.read()); return;
    }
    const key = createHash("sha256").update(repositoryUri).digest("hex");
    const storage = path.join(context.globalStorageUri.fsPath, "projects", key);
    await assertStorageOutsideRepository({
      repositoryRoot: root,
      storagePath: storage,
    });
    await mkdir(storage, { recursive: true });
    const executionStorage = path.join(storage, "execution");
    await mkdir(executionStorage, { recursive: true });
    if (!isCurrent()) return;
    const next = new SqliteProjectRepository(
      path.join(storage, "project.sqlite"),
    );
    try {
      const project = next.open({ repositoryUri, name: path.basename(root) });
      execution?.dispose(); execution = undefined;
      fileWatcher?.dispose(); fileWatcher = undefined;
      coordination?.dispose(); coordination = undefined; coordinationUi = undefined;
      conversation?.dispose(); knowledge?.dispose(); reflection?.dispose();
      repository?.close();
      repository = next;
      view.setVisit(project.projectId, next.beginVisit(), revision => { next.recordVisitedRevision(project.projectId, revision); });
      view.show(project);
      const coordinator = new ExecutionCoordinator({ repository: next, storageDirectory: executionStorage, createClient, publish: publishExecution,
        readProviderConfiguration: () => parseProviderConfiguration(vscode.workspace.getConfiguration("piarre").get<unknown>("providers", [])),
        confirmSpending: async detail => await vscode.window.showWarningMessage("Authorize possible paid usage for this attempt?", { modal: true, detail }, "Authorize this attempt") === "Authorize this attempt" ? "consent" : "cancel",
        hasDirtyDocuments: paths => {
          const scoped = new Set(paths.map(canonicalWorkspacePath));
          return vscode.workspace.textDocuments.some(document => document.isDirty && document.uri.scheme === "file" && scoped.has(canonicalWorkspacePath(document.uri.fsPath)));
        } });
      execution = new ExecutionUi(coordinator, () => next.read(), runId => { view.openExecutionResult(runId); });
      publishExecution(project);
      fileWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, "**/*"));
      fileWatcher.onDidChange(queueExecutionRefresh); fileWatcher.onDidCreate(queueExecutionRefresh); fileWatcher.onDidDelete(queueExecutionRefresh);
      await coordinator.reconcile();
      coordinator.refreshWorkspaceFreshness();
      reflection = new ReflectionController(next, snapshot => { view.update(snapshot); }, () => { view.close(); });
      if (project.reflections.some(item => item.status === "pending")) output.appendLine("Pending optional reflection recovered. Run Piarre: Review Reflection when ready. Work and agent controls remain available.");
      knowledge = new KnowledgeController(next, snapshot => { view.update(snapshot); }, (projectId, result) => { view.updateLookup(projectId, result); });
      const canShare = (sources: readonly SuppliedSource[]): boolean => {
        if (!isCurrent()) return false;
        const files = new Set(sources.flatMap(({ reference }) => reference.kind === "file" ? [canonicalWorkspacePath(path.join(root, reference.path))] : []));
        return !vscode.workspace.textDocuments.some(document => document.isDirty && document.uri.scheme === "file" && files.has(canonicalWorkspacePath(document.uri.fsPath)));
      };
      coordination = new CoordinationController(next, snapshot => { view.update(snapshot); }, createClient, canShare);
      coordinationUi = new CoordinationUi(coordination, () => next.read(), groupId => { view.openProposal(groupId); });
      conversation = new ConversationController(next, (snapshot, state) => { view.updateConversation(snapshot, state); },
        route => route === "codex" ? createClient() : new DockerModelRunnerConversationClient(localConfiguration()), canShare);
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
    registerDiagnosticCommands(context, () => repository),
    view,
    vscode.window.registerWebviewViewProvider("piarre.sidebar", view),
    output,
    stopWork,
    vscode.workspace.onDidChangeTextDocument(event => { queueExecutionRefresh(event.document.uri); }),
    vscode.workspace.onDidSaveTextDocument(document => { queueExecutionRefresh(document.uri); }),
    {
      dispose: () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        fileWatcher?.dispose();
        execution?.dispose();
        reflection?.dispose();
        knowledge?.dispose();
        coordination?.dispose(); coordination = undefined; coordinationUi = undefined;
        conversation?.dispose();
        repository?.close();
      },
    },
    vscode.commands.registerCommand("piarre.open", () => requestOpen(true)),
    vscode.commands.registerCommand("piarre.endSession", async () => { if (isTrusted()) await reflection?.handle("end"); }),
    vscode.commands.registerCommand("piarre.reviewReflection", async () => { if (isTrusted()) await reflection?.handle("review"); }),
    vscode.commands.registerCommand("piarre.explanationPreference", async () => { if (isTrusted()) await reflection?.handle("preference"); }),
    vscode.commands.registerCommand("piarre.stopAll", async () => {
      if (!isTrusted()) return;
      const operation = execution?.handle({ kind: "execution", action: "pause-all" });
      await Promise.allSettled([operation, conversation?.interrupt(), coordination?.stopAll()]);
    }),
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
      if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = undefined;
      fileWatcher?.dispose(); fileWatcher = undefined;
      execution?.dispose(); execution = undefined; executionPaths.clear(); stopWork.hide();
      reflection?.dispose(); reflection = undefined;
      knowledge?.dispose(); knowledge = undefined;
      coordination?.dispose(); coordination = undefined; coordinationUi = undefined;
      conversation?.dispose(); conversation = undefined;
      repository?.close();
      repository = undefined;
      view.close();
      void requestOpen(false);
    }),
  );
  void requestOpen(false);
}
