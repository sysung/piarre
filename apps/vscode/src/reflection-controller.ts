import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { renderReflection, reflectionArtifactPath, reflectionDrift, type Reflection, type ReflectionAction, type ProjectSnapshot } from "../../../packages/core/src/index.js";
import type { SqliteProjectRepository } from "./sqlite-project-repository.js";

export class ReflectionController {
  private disposed = false;
  private busy = false;
  constructor(private readonly repository: SqliteProjectRepository, private readonly update: (project: ProjectSnapshot) => void, private readonly closeView: () => void) {}
  dispose(): void { this.disposed = true; }
  private current(): boolean { return !this.disposed && vscode.workspace.isTrusted; }
  private apply(action: ReflectionAction): boolean {
    if (!this.current()) return false;
    const project = this.repository.read();
    const result = this.repository.dispatch({ commandId: randomUUID(), projectId: project.projectId, expectedProjectRevision: project.revision, action });
    if (result.kind !== "applied") return false;
    this.update(result.snapshot); return true;
  }
  async handle(kind: "end" | "review" | "preference"): Promise<void> {
    if (!this.current() || this.busy) return;
    this.busy = true;
    try {
      if (kind === "preference") { await this.preferences(); return; }
      let pending = this.repository.read().reflections.find(item => item.status === "pending");
      if (kind === "end" && !pending) {
        if (!this.apply({ kind: "offer-reflection" })) return;
        pending = this.repository.read().reflections.find(item => item.status === "pending");
      }
      if (!pending) {
        const history = this.repository.read().reflections;
        const selected = await vscode.window.showQuickPick(history.map(item => ({ label: `${item.reflectionId} (${item.status})`, reflection: item })), { placeHolder: "Inspect a recorded reflection. No changes will be applied." });
        if (selected && this.current()) await this.inspect(selected.reflection);
        return;
      }
      const id = pending.reflectionId;
      const selected = await vscode.window.showQuickPick(["Decline and close", "Inspect reflection", "Add feedback or correction", "Mark reviewed and close", "Close now; keep pending"],
        { placeHolder: "Optional reflection. Closing never stops agents or approves proposals. Escape leaves reflection pending." });
      if (!this.current()) return;
      if (selected === "Decline and close" || selected === "Mark reviewed and close") {
        try { this.apply({ kind: "resolve-reflection", reflectionId: id, resolution: selected === "Decline and close" ? "declined" : "reviewed" }); }
        finally { this.closeView(); }
      }
      else if (selected === "Close now; keep pending") this.closeView();
      else if (selected === "Inspect reflection") await this.inspect(pending);
      else if (selected === "Add feedback or correction") {
        const feedback = await vscode.window.showInputBox({ prompt: "Feedback or correction. This records a proposal only; it changes no rules, memory, or code.", ignoreFocusOut: true,
          validateInput: value => value.trim() && value.length <= 10_000 ? undefined : "Enter 1 to 10,000 characters." });
        if (feedback !== undefined && this.current()) this.apply({ kind: "correct-reflection", reflectionId: id, feedback });
      }
    } catch {
      if (this.current()) await vscode.window.showWarningMessage("Reflection could not be saved. You can close the Work view immediately and review pending reflection later.");
    } finally { this.busy = false; }
  }
  private async inspect(reflection: Reflection): Promise<void> {
    const project = this.repository.read();
    const source = this.repository.read(reflection.sourceRevision);
    const drift = reflectionDrift(source, project);
    const text = renderReflection(source, reflection, project.explanationPreference) + `\n\nSelf-reported component familiarity: ${project.expertisePreference}. This preference is optional, inspectable, reversible, and does not change authority.\n` + (drift.length ? `\n\n## Current review warnings\n\n${drift.map(warning => `- ${warning}`).join("\n")}` : "");
    const uri = vscode.Uri.file(path.join(fileURLToPath(project.repositoryUri), reflectionArtifactPath(reflection))).with({ scheme: "untitled" });
    const document = await vscode.workspace.openTextDocument(uri);
    if (!this.current()) return;
    if (document.getText() && document.getText() !== text) {
      const separate = await vscode.workspace.openTextDocument({ content: text, language: "markdown" });
      if (this.current()) await vscode.window.showTextDocument(separate, { preview: true });
      return;
    }
    if (!document.getText()) {
      const edit = new vscode.WorkspaceEdit(); edit.insert(uri, new vscode.Position(0, 0), text);
      await vscode.workspace.applyEdit(edit);
    }
    if (this.current()) await vscode.window.showTextDocument(document, { preview: true });
  }
  private async preferences(): Promise<void> {
    const current = this.repository.read();
    const mode = await vscode.window.showQuickPick(["Explanation detail", "Component familiarity", "Skip"], { placeHolder: `Optional preferences. Explanation: ${current.explanationPreference}; self-reported familiarity: ${current.expertisePreference}. Both can be reset.` });
    if (!this.current() || !mode || mode === "Skip") return;
    if (mode === "Component familiarity") {
      const selected = await vscode.window.showQuickPick(["Keep current / skip", "Unspecified (reset)", "Learning", "Familiar"], { placeHolder: "Self-report only; never inferred from performance. Applies to optional reflection explanations." });
      if (!selected || !this.current() || selected === "Keep current / skip") return;
      this.apply({ kind: "set-expertise-preference", preference: selected === "Learning" ? "learning" : selected === "Familiar" ? "familiar" : "unspecified" });
      return;
    }
    const preference = current.explanationPreference;
    const selected = await vscode.window.showQuickPick([
      { label: "Keep current / skip", value: preference },
      { label: "Default (reset)", value: "default" }, { label: "Brief", value: "brief" }, { label: "Guided", value: "guided" },
], { placeHolder: `Current explanation preference: ${preference}. Optional and reversible; affects supporting conversation and reflection detail, never authority.` });
    if (!selected || !this.current() || selected.label === "Keep current / skip") return;
    if (selected.value === "default" || selected.value === "brief" || selected.value === "guided") this.apply({ kind: "set-explanation-preference", preference: selected.value });
  }
}
