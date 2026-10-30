import * as vscode from "vscode";

const OPEN_COMMAND = "piarre.open";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Piarre");
  const command = vscode.commands.registerCommand(OPEN_COMMAND, () => {
    output.appendLine("Piarre scaffold is ready");
  });

  context.subscriptions.push(output, command);
}

export function deactivate(): void {}
