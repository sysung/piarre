import * as vscode from "vscode";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createDiagnosticBundle, diagnosticFailureMessage, DiagnosticBundleStore, validateRecordingLink } from "./diagnostic-bundle.js";
import type { SqliteProjectRepository } from "./sqlite-project-repository.js";

function extensionVersion(manifest: unknown): string {
  return manifest && typeof manifest === "object" && "version" in manifest && typeof manifest.version === "string" ? manifest.version : "unknown";
}

export function registerDiagnosticCommands(context: vscode.ExtensionContext, currentRepository: () => SqliteProjectRepository | undefined): vscode.Disposable {
  let cachedStore: DiagnosticBundleStore | undefined;
  const storage = (): DiagnosticBundleStore => cachedStore ??= new DiagnosticBundleStore(context.globalStorageUri.fsPath);
  const expire = (): void => { try { storage().expire(); } catch { /* Corrupt bundles remain visible for explicit deletion. */ } };
  expire();
  const timer = setInterval(expire, 60_000);
  const run = (operation: () => Promise<void>) => async (): Promise<void> => {
    try { expire(); await operation(); } catch (error: unknown) { await vscode.window.showErrorMessage(diagnosticFailureMessage(error)); }
  };
  const choose = async (): Promise<string | undefined> => {
    const items = storage().list().map(name => {
      const summary = storage().summary(name);
      return summary ? { name, label: summary.capturedAt, description: summary.detail === "metadata" ? "Metadata only" : "Reviewable content",
        detail: `Expires ${summary.expiresAt} · Project ${summary.project}` }
        : { name, label: "Unreadable diagnostic bundle", description: "Metadata unavailable; can be deleted", detail: name };
    });
    const selected = await vscode.window.showQuickPick(items, { placeHolder: "Choose a retained diagnostic bundle to review", matchOnDescription: true, matchOnDetail: true });
    return selected?.name;
  };
  const preview = async (name: string, action: "export" | "delete"): Promise<boolean> => {
    try {
      await vscode.window.showTextDocument(vscode.Uri.file(storage().path(name)), { preview: false });
      const proceed = action === "export" ? "Continue to export" : "Continue to deletion";
      return await vscode.window.showInformationMessage("Review the opened diagnostic bundle before continuing. You can keep reading in the editor or dismiss this message to cancel.", proceed) === proceed;
    } catch {
      if (action !== "delete") throw new Error("Diagnostic preview unavailable");
      return await vscode.window.showWarningMessage("This bundle cannot be previewed. Delete the unreadable local file? Exported copies remain separate.", { modal: true }, "Continue to deletion") === "Continue to deletion";
    }
  };
  return vscode.Disposable.from(
    { dispose: () => { clearInterval(timer); } },
    vscode.commands.registerCommand("piarre.createDiagnosticBundle", run(async () => {
      if (!vscode.workspace.isTrusted) return;
      const repository = currentRepository();
      if (!repository) { await vscode.window.showInformationMessage("Open a Piarre project before collecting diagnostics."); return; }
      const detail = await vscode.window.showQuickPick([
        { label: "Metadata only", description: "States, revisions and checks; text and identifiers stay private", value: "metadata" as const },
        { label: "Metadata with recording link", description: "Link an existing recording. Piarre does not capture or upload it.", value: "metadata" as const, recording: true },
        { label: "Reviewable content", description: "Includes redacted statements, memory, prompts and outputs. Secret detection is incomplete.", value: "reviewable-content" as const },
      ], { placeHolder: "Choose what to collect. Collection does not share or upload." });
      if (!detail) return;
      const retention = await vscode.window.showQuickPick([
        { label: "Preview only", description: "No retained bundle; save a copy yourself if needed", days: 0 as const },
        { label: "Keep locally for 1 day", days: 1 as const },
        { label: "Keep locally for 7 days", days: 7 as const },
      ], { placeHolder: "Choose local retention. Expiration runs while Piarre is active and when next opened." });
      if (!retention || currentRepository() !== repository) return;
      const recordingLink = "recording" in detail ? await vscode.window.showInputBox({ prompt: "Optional existing HTTPS recording link. It will be visible in the bundle. No query parameters or credentials.", ignoreFocusOut: true, validateInput: validateRecordingLink }) : undefined;
      if ("recording" in detail && recordingLink === undefined) return;
      if (currentRepository() !== repository) return;
      const { snapshot, events } = repository.readDiagnosticSnapshot();
      let commit: string | null = null;
      let dirty: boolean | null = null;
      try {
        const cwd = fileURLToPath(snapshot.repositoryUri);
        const options = { cwd, encoding: "utf8" as const, timeout: 2_000, maxBuffer: 64 * 1024 };
        commit = execFileSync("git", ["rev-parse", "HEAD"], options).trim();
        dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], options).trim() !== "";
      } catch { /* Unborn or unavailable repository revisions remain unknown. */ }
      const serialized = createDiagnosticBundle({ snapshot, events, extensionId: context.extension.id,
        extensionVersion: extensionVersion(context.extension.packageJSON), vscodeVersion: vscode.version,
        repository: { commit, dirty }, providers: vscode.workspace.getConfiguration("piarre").get<unknown>("providers"),
        detail: detail.value, retentionDays: retention.days, ...(recordingLink ? { recordingLink } : {}) });
      if (retention.days === 0) {
        const document = await vscode.workspace.openTextDocument({ content: serialized, language: "json" });
        await vscode.window.showTextDocument(document, { preview: false });
      } else {
        const name = storage().save(serialized);
        await vscode.window.showTextDocument(vscode.Uri.file(storage().path(name)), { preview: false });
      }
      await vscode.window.showInformationMessage("Diagnostics are local. Review before export. No recording, upload or remote analysis was started. Copies and provider retention are separate.");
    })),
    vscode.commands.registerCommand("piarre.exportDiagnosticBundle", run(async () => {
      const name = await choose(); if (!name || !await preview(name, "export")) return;
      const action = await vscode.window.showWarningMessage("Export this diagnostic bundle? Review its contents first. The exported copy has its own retention and may contain private information.", { modal: true }, "Export reviewed bundle");
      if (action !== "Export reviewed bundle") return;
      const destination = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(name), filters: { JSON: ["json"] }, title: "Export diagnostic bundle to a new file" });
      if (!destination || destination.scheme !== "file") return;
      storage().export(name, destination.fsPath);
      await vscode.window.showInformationMessage("Diagnostic export verified. No upload occurred. Delete the exported copy separately when no longer needed.");
    })),
    vscode.commands.registerCommand("piarre.deleteDiagnosticBundle", run(async () => {
      const name = await choose(); if (!name || !await preview(name, "delete")) return;
      const action = await vscode.window.showWarningMessage("Delete this retained local bundle? Exported copies, open editor content and provider data are separate.", { modal: true }, "Delete local bundle");
      if (action !== "Delete local bundle") return;
      storage().delete(name);
      await vscode.window.showInformationMessage("Local bundle deletion verified. Exported copies, open editor content, backups and provider retention were not deleted.");
    })),
  );
}
