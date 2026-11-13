export * from "vscode";
import * as vscode from "vscode";

export const resultDialogs = {
  warning: undefined as ((message: string, options: vscode.MessageOptions | undefined, ...items: string[]) => Promise<string | undefined>) | undefined,
};
export const window = {
  showInputBox: vscode.window.showInputBox,
  showQuickPick: vscode.window.showQuickPick,
  showWarningMessage: (message: string, options: vscode.MessageOptions, ...items: string[]) => resultDialogs.warning
    ? resultDialogs.warning(message, options, ...items) : vscode.window.showWarningMessage(message, options, ...items),
};
