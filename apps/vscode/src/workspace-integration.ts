import { publicationParents } from "./scoped-publication.js";
import { existsSync } from "node:fs";
import path from "node:path";
import { CandidateWorkspace } from "./candidate-workspace.js";
import { digest, imageHash, imageChanges, parseImages, parseJournal, readImage, readRecord, replayJournal, writeRecord, type FileChange, type FileImage, type JournalResult, type JournalAuthority, assertJournalAuthority } from "./candidate-journal.js";

export class WorkspaceIntegration {
  private readonly candidate: CandidateWorkspace;
  constructor({ candidate }: { readonly candidate: CandidateWorkspace }) { this.candidate = candidate; }
  private snapshot(): readonly FileImage[] { return this.candidate.files.map(file => readImage(this.candidate.sourceRoot, file.baseline.relativePath)); }
  private candidateSnapshot(): readonly FileImage[] { return this.candidate.files.map(file => readImage(this.candidate.root, file.baseline.relativePath)); }
  private changes(current: readonly FileImage[], target: readonly FileImage[]): readonly FileChange[] {
    return imageChanges(current, target);
  }

  preview(): { readonly sourceManifestHash: string; readonly currentCandidateHash: string; readonly changes: readonly FileChange[] } {
    const current = this.snapshot(); const target = this.candidateSnapshot();
    return { sourceManifestHash: imageHash(current), currentCandidateHash: imageHash(target), changes: this.changes(current, target) };
  }
  private recordName(commandId: string): string { return `integration-journal-${digest(commandId)}.json`; }
  private checkpoint(checkpointId: string, images: readonly FileImage[]): void {
    const filename = `integration-checkpoint-${digest(checkpointId)}.json`;
    if (existsSync(path.join(this.candidate.controlDirectory, filename))) {
      if (imageHash(this.loadCheckpoint(checkpointId)) !== imageHash(images)) throw new Error("Integration checkpoint already exists with different bytes");
    } else writeRecord(this.candidate.controlDirectory, filename, images);
  }
  private loadCheckpoint(checkpointId: string): readonly FileImage[] {
    const images = parseImages(readRecord(this.candidate.controlDirectory, `integration-checkpoint-${digest(checkpointId)}.json`));
    if (images.length !== this.candidate.files.length || images.some((image, index) => image.relativePath !== this.candidate.files[index]?.baseline.relativePath)) throw new Error("Integration checkpoint scope mismatch");
    return images;
  }
  async apply({ commandId, expectedSourceManifestHash, expectedCandidateManifestHash, parentIdentityHash, afterStep }: {
    readonly commandId: string; readonly expectedSourceManifestHash: string; readonly expectedCandidateManifestHash: string; readonly parentIdentityHash?: string; readonly afterStep?: (index: number) => void;
  }): Promise<JournalResult> {
    if (existsSync(path.join(this.candidate.controlDirectory, this.recordName(commandId)))) return this.reconcile({ commandId, authority: { expectedManifestHash: expectedSourceManifestHash, targetManifestHash: expectedCandidateManifestHash, parentIdentityHash }, ...(afterStep ? { afterStep } : {}) });
    const current = this.snapshot(); const target = this.candidateSnapshot();
    const baseline = this.candidate.files.map(file => ({ relativePath: file.baseline.relativePath, content: file.content, mode: file.mode }));
    if (imageHash(current) !== expectedSourceManifestHash || imageHash(current) !== imageHash(baseline) || imageHash(target) !== expectedCandidateManifestHash) return { kind: "conflict", paths: current.map(file => file.relativePath), reason: "Source or candidate changed since capture or review" };
    this.checkpoint(`integration-before:${commandId}`, current);
    return this.begin({ commandId, before: current, target, expectedManifestHash: expectedSourceManifestHash, targetManifestHash: expectedCandidateManifestHash, parentIdentityHash, afterStep });
  }
  previewRestore({ checkpointId }: { readonly checkpointId: string }): { readonly currentManifestHash: string; readonly targetManifestHash: string; readonly changes: readonly (FileChange & { readonly kind: "create" | "replace" | "delete" })[] } {
    const current = this.snapshot(); const target = this.loadCheckpoint(checkpointId);
    return { currentManifestHash: imageHash(current), targetManifestHash: imageHash(target), changes: this.changes(current, target).map(change => ({ ...change, kind: change.after === null ? "delete" : change.before === null ? "create" : "replace" })) };
  }
  async restore({ restoreCommandId, checkpointId, expectedManifestHash, targetManifestHash, parentIdentityHash, afterStep }: {
    readonly restoreCommandId: string; readonly checkpointId: string; readonly expectedManifestHash: string; readonly targetManifestHash?: string; readonly parentIdentityHash?: string; readonly afterStep?: (index: number) => void;
  }): Promise<JournalResult> {
    if (existsSync(path.join(this.candidate.controlDirectory, this.recordName(restoreCommandId)))) return this.reconcile({ commandId: restoreCommandId, authority: { expectedManifestHash, targetManifestHash: targetManifestHash ?? imageHash(this.loadCheckpoint(checkpointId)), parentIdentityHash }, ...(afterStep ? { afterStep } : {}) });
    const current = this.snapshot(); const target = this.loadCheckpoint(checkpointId);
    if (imageHash(current) !== expectedManifestHash || (targetManifestHash && imageHash(target) !== targetManifestHash)) return { kind: "conflict", paths: current.map(file => file.relativePath), reason: "Source restore preview is stale" };
    this.checkpoint(`integration-preserved:${restoreCommandId}`, current);
    return this.begin({ commandId: restoreCommandId, before: current, target, expectedManifestHash, targetManifestHash: imageHash(target), parentIdentityHash, afterStep });
  }
  private async begin({ commandId, before, target, expectedManifestHash, targetManifestHash, parentIdentityHash: expectedParents, afterStep }: { readonly commandId: string; readonly before: readonly FileImage[]; readonly target: readonly FileImage[]; readonly expectedManifestHash: string; readonly targetManifestHash: string; readonly parentIdentityHash?: string; readonly afterStep?: (index: number) => void }): Promise<JournalResult> {
    const changes = this.changes(before, target);
    const parents = changes.map(change => publicationParents(this.candidate.sourceRoot, change.relativePath));
    const parentIdentityHash = digest(JSON.stringify(parents));
    if (expectedParents && expectedParents !== parentIdentityHash) throw new Error("Reviewed publication directories changed.");
    writeRecord(this.candidate.controlDirectory, `integration-before-${digest(commandId)}.json`, before);
    writeRecord(this.candidate.controlDirectory, `integration-target-${digest(commandId)}.json`, target);
    writeRecord(this.candidate.controlDirectory, this.recordName(commandId), { commandId, changes, completed: false, parents });
    return this.reconcile({ commandId, authority: { expectedManifestHash, targetManifestHash, parentIdentityHash }, ...(afterStep ? { afterStep } : {}) });
  }
  async reconcile({ commandId, authority, afterStep }: { readonly commandId: string; readonly authority?: Pick<JournalAuthority, "expectedManifestHash" | "targetManifestHash" | "parentIdentityHash">; readonly afterStep?: (index: number) => void }): Promise<JournalResult> {
    const filename = this.recordName(commandId);
    const journal = parseJournal(readRecord(this.candidate.controlDirectory, filename));
    if (journal.commandId !== commandId || journal.changes.some(change => !this.candidate.files.some(file => file.baseline.relativePath === change.relativePath))) throw new Error("Integration journal scope mismatch");
    const target = parseImages(readRecord(this.candidate.controlDirectory, `integration-target-${digest(commandId)}.json`));
    if (target.length !== this.candidate.files.length || target.some((file, index) => file.relativePath !== this.candidate.files[index]?.baseline.relativePath)) throw new Error("Integration target scope mismatch");
    if (!authority) return { kind: "conflict", paths: target.map(file => file.relativePath), reason: "Recorded operation authority is required before replay." };
    const before = parseImages(readRecord(this.candidate.controlDirectory, `integration-before-${digest(commandId)}.json`));
    try { assertJournalAuthority(this.candidate.sourceRoot, journal, { ...authority, before, target }); }
    catch (error) { return { kind: "conflict", paths: target.map(file => file.relativePath), reason: error instanceof Error ? error.message : "Journal authority unavailable." }; }
    const result = await replayJournal({ root: this.candidate.sourceRoot, controlDirectory: this.candidate.controlDirectory, filename, journal, snapshot: () => this.snapshot(), ...(afterStep ? { afterStep } : {}) });
    if ((result.kind === "changed" || result.kind === "current") && result.manifestHash !== imageHash(target)) return { kind: "conflict", paths: target.map(file => file.relativePath), reason: "Source differs from the reviewed target; completed commands are never reapplied" };
    return result;
  }
}
