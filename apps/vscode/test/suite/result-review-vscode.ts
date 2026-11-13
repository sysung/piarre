export * from "vscode";
import * as vscode from "vscode";

export const resultDialogs = {
  information: undefined as ((message: string) => Promise<undefined>) | undefined,
  input: undefined as ((options: vscode.InputBoxOptions) => Promise<string | undefined>) | undefined,
  warning: undefined as ((message: string, options: vscode.MessageOptions | undefined, ...items: string[]) => Promise<string | undefined>) | undefined,
};
export const window = {
  createWebviewPanel: vscode.window.createWebviewPanel,
  showInformationMessage: (message: string) => resultDialogs.information ? resultDialogs.information(message) : vscode.window.showInformationMessage(message),
  showErrorMessage: vscode.window.showErrorMessage,
  showInputBox: (options: vscode.InputBoxOptions) => resultDialogs.input ? resultDialogs.input(options) : vscode.window.showInputBox(options),
  showQuickPick: vscode.window.showQuickPick,
  showWarningMessage: (message: string, options: vscode.MessageOptions, ...items: string[]) => resultDialogs.warning
    ? resultDialogs.warning(message, options, ...items) : vscode.window.showWarningMessage(message, options, ...items),
};
