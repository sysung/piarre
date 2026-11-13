import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import type { RecoverySelection } from "../../../packages/core/src/recovery.js";
import type { FileImage } from "./candidate-journal.js";
import type { ExecutionCoordinator } from "./execution-coordinator.js";

export interface RecoveryDialogs {
  review(message: string, detail: string, choices: readonly string[]): Promise<string | undefined>;
  choose(items: readonly { readonly id: string; readonly label: string; readonly detail: string }[]): Promise<string | undefined>;
  inspect(title: string, content: string, current?: () => boolean): Promise<void>;
}
export const nativeRecoveryDialogs: RecoveryDialogs = {
  review: async (message, detail, choices) => vscode.window.showWarningMessage(message, { modal: true, detail }, ...choices),
  choose: async items => (await vscode.window.showQuickPick(items, { title: "Saved versions", placeHolder: "Choose a recorded version to inspect; no files change yet", ignoreFocusOut: true }))?.id,
  inspect: async (title, content, current) => {
    const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${title}\n\n${content}` });
    if (!current || current()) await vscode.window.showTextDocument(document, { preview: true, preserveFocus: false });
  },
};
const mode = (image: FileImage): string => image.mode === null ? "absent" : image.mode.toString(8).padStart(4, "0");
function imageText(image: FileImage): string { return `${image.relativePath}\nPermissions: ${mode(image)}\n${image.content === null ? "[file absent]" : `Content (${String(Buffer.byteLength(image.content))} UTF-8 bytes):\n${JSON.stringify(image.content)}`}`; }
export class RecoveryUi {
  private readonly pending = new Set<string>();
  constructor(private readonly coordinator: ExecutionCoordinator, private readonly current: () => boolean,
    private readonly showResult: (runId: string) => void, private readonly dialogs: RecoveryDialogs = nativeRecoveryDialogs) {}
  async resolve(runId: string): Promise<void> { await this.review(runId, this.coordinator.recoverySelection(runId)); }
  async saved(runId: string): Promise<void> {
    const saved = this.coordinator.savedVersions(runId);
    const retained = saved.retained.map(entry => `${entry.path}\n${entry.status}\nPermissions: ${entry.kind === "unavailable" ? "unavailable" : entry.mode.toString(8)}\n${entry.kind === "available" ? JSON.stringify(entry.content) : "[unavailable]"}`).join("\n\n");
    const selected = await this.dialogs.choose([
      ...saved.versions.map(item => ({ id: item.version.versionId, label: `${item.version.target}: ${item.version.purpose}`, detail: `${item.kind} · ${item.version.versionId} · ${item.kind === "unavailable" ? item.reason : item.version.manifestHash}` })),
      ...saved.retained.flatMap(entry => entry.kind === "available" ? [{ id: `inode:${entry.entryKey}`, label: `${entry.target}: retained ${entry.relativePath}`, detail: entry.status }] : []),
      ...(saved.retained.length ? [{ id: "retained-inodes", label: "Inspect retained original file entries", detail: "Live inode bytes can change through older open descriptors. Retained independently of the source path." }] : []),
    ]);
    if (!selected || !this.current()) return;
    if (selected === "retained-inodes") { await this.dialogs.inspect("Retained original file entries", retained, this.current); return; }
    if (selected.startsWith("inode:")) {
      const entry = saved.retained.find(entry => entry.kind === "available" && `inode:${entry.entryKey}` === selected);
      if (!entry || entry.kind !== "available") return;
      const choice = await this.dialogs.review("Inspect retained original entry", `${entry.path}\n${entry.status}\n\n${imageText({ relativePath: entry.relativePath, content: entry.content, mode: entry.mode })}`, ["Review restore of current retained bytes", "Cancel"]);
      if (choice !== "Review restore of current retained bytes" || !this.current()) return;
      await this.review(runId, this.coordinator.captureRetained(runId, entry.entryKey)); return;
    }
    const item = saved.versions.find(item => item.version.versionId === selected); if (!item) return;
    if (item.kind === "unavailable") { await this.dialogs.inspect("Saved version unavailable", item.reason, this.current); return; }
    await this.review(runId, { kind: "snapshot", target: item.version.target, versionId: item.version.versionId });
  }
  async review(runId: string, selection: RecoverySelection): Promise<void> {
    if (this.pending.has(runId)) return;
    this.pending.add(runId);
    let previewId: string | undefined;
    try {
      const preview = await this.coordinator.previewRecovery({ runId, selection }); previewId = preview.previewId;
      if (!this.current()) return;
      const disclosure = `Run: ${runId}\nTarget: ${selection.target}\nSelection: ${JSON.stringify(selection)}\nSupersedes: ${preview.supersedes ?? "no pending operation"}\nProject revision: ${String(preview.projectRevision)}\nCurrent manifest: ${preview.currentManifestHash}\nIntended manifest: ${preview.intendedManifestHash}\nBinding: ${preview.bindingHash}\n\n${preview.current.map((image, index) => `State: ${preview.states[index]?.kind ?? "unavailable"}\nCURRENT\n${preview.states[index]?.kind === "unavailable" ? `${image.relativePath}: unavailable; absence is not established` : imageText(image)}\n\nINTENDED\n${imageText(preview.intended[index] ?? image)}`).join("\n\n")}\n\nAll files default to Keep current. Before any replacement, the entire current scope is durably preserved and registered as a saved version. Replacement also retains the actual displaced inode in private escrow; older open descriptors may still write there. Earlier checks and acceptance become historical. No checks, provider request, process stop, or external-effect rollback is authorized.`;
      if (preview.blockers.length) { await this.dialogs.inspect("Recovery blocked", `${preview.blockers.join("\n")}\n\n${disclosure}`, this.current); return; }
      await this.dialogs.inspect("Full scoped recovery preview", disclosure, this.current);
      if (!this.current()) return;
      const choice = await this.dialogs.review("Review scoped recovery", disclosure, ["Keep current files", "Review planned changes", "Cancel"]);
      if (!this.current() || choice === undefined || choice === "Cancel") return;
      const intendedPaths: string[] = [];
      if (choice === "Review planned changes") {
        for (const [index, image] of preview.current.entries()) {
          const intended = preview.intended[index]; if (!intended) throw new Error("Reviewed scope unavailable.");
          const fileChoice = await this.dialogs.review(`Recovery choice: ${image.relativePath}`, `Default: Keep current\n\nCURRENT\n${imageText(image)}\n\nINTENDED\n${imageText(intended)}\n\n${intended.content === null ? "Choosing intended deletes this scoped file." : image.content === null ? "Choosing intended creates this scoped file." : "Choosing intended replaces this scoped file and permissions."}`, ["Keep current", "Use intended", "Cancel"]);
          if (!this.current() || fileChoice === undefined || fileChoice === "Cancel") return;
          if (fileChoice === "Use intended") intendedPaths.push(image.relativePath);
        }
      } else if (choice !== "Keep current files") return;
      const operationId = randomUUID();
      const final = preview.current.map((image, index) => { const selected = intendedPaths.includes(image.relativePath) ? preview.intended[index] ?? image : image; return `${intendedPaths.includes(image.relativePath) ? "USE INTENDED" : "KEEP CURRENT"}\n${imageText(selected)}`; }).join("\n\n");
      const approved = await this.dialogs.review("Approve this recovery resolution?", `${final}\n\nSaved version: preserved:${operationId}\nThe full inspected current scope will be available in Saved versions before any target write. Displaced original inodes remain inspectable there, including later writes from older open descriptors. This successor permanently supersedes ${preview.supersedes ?? "no pending journal"}. Keep-current files will not be rewritten. Prior checks and acceptance remain historical; fresh planning and verification are required. Cancellation changes no target files.\n\nPreview ${preview.previewId}`, ["Approve recovery", "Cancel"]);
      if (approved !== "Approve recovery" || !this.current()) return;
      await this.coordinator.recover({ previewId: preview.previewId, intendedPaths, operationId });
      if (this.current()) this.showResult(runId);
    } finally { if (previewId) this.coordinator.cancelRecovery(previewId); this.pending.delete(runId); }
  }
}
