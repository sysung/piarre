export { Disposable, RelativePattern, StatusBarAlignment, Uri, version } from "vscode";
import * as vscode from "vscode";

// The production composition root uses the real Host APIs, with controlled
// workspace selection and native responses supplied by the lifetime fixture.
export const host = {
  folders: [] as readonly vscode.WorkspaceFolder[],
  changed: new vscode.EventEmitter<vscode.WorkspaceFoldersChangeEvent>(),
  errors: [] as string[],
  setupError: undefined as Error | undefined,
  watcherDisposals: 0,
  panel: undefined as vscode.WebviewPanel | undefined,
  createdPanels: 0,
  disposedPanels: 0,
  lookup: undefined as ((html: string) => void) | undefined,
  stopVisible: false,
  rename: undefined as (() => Promise<string | undefined>) | undefined,
};
export const workspace = {
  isTrusted: vscode.workspace.isTrusted,
  createFileSystemWatcher: (pattern: vscode.GlobPattern) => {
    if (host.setupError) throw host.setupError;
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    return {
      onDidChange: watcher.onDidChange, onDidCreate: watcher.onDidCreate, onDidDelete: watcher.onDidDelete,
      dispose: () => { host.watcherDisposals++; watcher.dispose(); },
    };
  },
  getConfiguration: vscode.workspace.getConfiguration,
  get textDocuments() { return vscode.workspace.textDocuments; },
  onDidChangeTextDocument: vscode.workspace.onDidChangeTextDocument,
  onDidSaveTextDocument: vscode.workspace.onDidSaveTextDocument,
  onDidGrantWorkspaceTrust: vscode.workspace.onDidGrantWorkspaceTrust,
  openTextDocument: vscode.workspace.openTextDocument,
  get workspaceFolders() { return host.folders; },
  onDidChangeWorkspaceFolders: host.changed.event,
};
export const window = {
  createOutputChannel: vscode.window.createOutputChannel,
  createStatusBarItem: (alignment: vscode.StatusBarAlignment, priority: number) => {
    const item = vscode.window.createStatusBarItem(alignment, priority);
    return {
      set text(value: string) { item.text = value; },
      set command(value: string) { item.command = command(value); },
      set tooltip(value: string) { item.tooltip = value; },
      show: () => { host.stopVisible = true; item.show(); },
      hide: () => { host.stopVisible = false; item.hide(); },
      dispose: () => { host.stopVisible = false; item.dispose(); },
    };
  },
  createWebviewPanel: (...args: Parameters<typeof vscode.window.createWebviewPanel>) => {
    const panel = vscode.window.createWebviewPanel(...args);
    if (args[0] === "piarre.work") {
      host.panel = panel;
      host.createdPanels++;
      panel.onDidDispose(() => {
        host.disposedPanels++;
        if (host.panel === panel) host.panel = undefined;
      });
      const post = panel.webview.postMessage.bind(panel.webview);
      panel.webview.postMessage = (message: unknown) => {
        if (host.panel === panel && message && typeof message === "object" && "html" in message && typeof message.html === "string" && message.html.includes('aria-label="Project lookup"')) host.lookup?.(message.html);
        return post(message);
      };
    }
    return panel;
  },
  showWorkspaceFolderPick: vscode.window.showWorkspaceFolderPick,
  showWarningMessage: vscode.window.showWarningMessage,
  showInformationMessage: () => Promise.resolve(undefined),
  showQuickPick: (choices: readonly string[], options: vscode.QuickPickOptions) => options.title === "Route lookup to its owning source"
    ? Promise.resolve(choices[0]) : vscode.window.showQuickPick(choices, options),
  showInputBox: (options: vscode.InputBoxOptions) => options.prompt?.startsWith("Look up exact identifiers")
    ? Promise.resolve("replacementLookupMarker") : host.rename?.() ?? Promise.resolve(undefined),
  showTextDocument: vscode.window.showTextDocument,
  showSaveDialog: vscode.window.showSaveDialog,
  showErrorMessage: (message: string) => { host.errors.push(message); return Promise.resolve(undefined); },
};
export const command = (id: string) => `${id}.lifetime-fixture`;
export const commands = {
  registerCommand: (id: string, handler: (...args: unknown[]) => unknown) => vscode.commands.registerCommand(command(id), handler),
};
