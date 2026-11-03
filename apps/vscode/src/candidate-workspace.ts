import { createHash, randomUUID } from "node:crypto";
import { chmodSync, constants, existsSync, closeSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, writeFileSync, type Stats } from "node:fs";
import path from "node:path";
import { parsePatchProposal, validateFileManifest, type PatchProposal, type FileBaseline } from "../../../packages/core/src/execution-patch.js";

import { digest, imageHash, imageChanges, permissionMode, parseFileMode, inside, parseImages, parseJournal, readImage, readRecord, replayJournal, writeRecord, type FileImage, type FileChange, type JournalResult } from "./candidate-journal.js";

export interface CapturedFile {
  readonly baseline: FileBaseline;
  readonly content: string | null;
  readonly mode: number | null;
}

const sha256 = (content: Uint8Array): string => createHash("sha256").update(content).digest("hex");
function within(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function captureFile(root: string, relativePath: string): CapturedFile {
  const fileId = randomUUID();
  validateFileManifest([{ kind: "absent", fileId, relativePath }]);
  let cursor = root;
  const parts = relativePath.split("/");
  for (const [index, part] of parts.entries()) {
    cursor = path.join(cursor, part);
    let entry: Stats;
    try { entry = lstatSync(cursor); }
    catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      return { baseline: { kind: "absent", fileId, relativePath }, content: null, mode: null };
    }
    if (entry.isSymbolicLink() || !within(root, realpathSync(cursor))) throw new Error("Source paths must stay inside the repository without symbolic links.");
    if (index < parts.length - 1 && !entry.isDirectory()) throw new Error("A source parent is not a directory.");
  }
  const descriptor = openSync(cursor, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(descriptor);
    if (!before.isFile() || before.nlink !== 1 || before.size > 64_000) throw new Error("Select bounded regular files without hard links.");
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    const current = lstatSync(cursor);
    if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || current.ino !== before.ino || current.dev !== before.dev || current.isSymbolicLink()) throw new Error("Source changed during capture.");
    const content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    if (content.includes("\u0000")) throw new Error("Binary source is unsupported.");
    return { baseline: { kind: "existing", fileId, relativePath, sha256: sha256(bytes), bytes: bytes.byteLength }, content, mode: permissionMode(before.mode) };
  } finally { closeSync(descriptor); }
}

export class CandidateWorkspace {
  readonly captureHash: string;
  private constructor(readonly root: string, readonly files: readonly CapturedFile[], private readonly repositoryRoot: string, readonly controlDirectory: string) {
    this.captureHash = digest(JSON.stringify({ sourceRoot: repositoryRoot, root, files }));
  }

  static capture({ repositoryRoot, relativePaths, storageDirectory }: {
    readonly repositoryRoot: string; readonly relativePaths: readonly string[]; readonly storageDirectory: string;
  }): CandidateWorkspace {
    const repository = realpathSync(repositoryRoot);
    const storage = realpathSync(storageDirectory);
    if (!lstatSync(repository).isDirectory() || !lstatSync(storage).isDirectory() || storage === repository || within(repository, storage) || within(storage, repository)) throw new Error("Candidate storage must be separate from the repository.");
    const files = relativePaths.map(relative => captureFile(repository, relative));
    validateFileManifest(files.map(file => file.baseline));
    const normalized = files.map(file => file.baseline.relativePath.normalize("NFC").toLowerCase());
    if (new Set(normalized).size !== normalized.length || normalized.some(left => normalized.some(right => left !== right && right.startsWith(left + "/")))) throw new Error("Overlapping or case-colliding file paths are unsupported.");
    const runDirectory = mkdtempSync(path.join(storage, "run-"));
    const root = path.join(runDirectory, "candidate");
    const controlDirectory = path.join(runDirectory, "control");
    mkdirSync(root, { mode: 0o700 }); mkdirSync(controlDirectory, { mode: 0o700 });
    for (const file of files) {
      if (file.content === null) continue;
      const target = path.join(root, file.baseline.relativePath);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, file.content, { flag: "wx", mode: 0o600 });
      if (file.mode === null) throw new Error("Missing captured permissions");
      chmodSync(target, file.mode);
    }
    const candidate = new CandidateWorkspace(root, files, repository, controlDirectory);
    writeRecord(controlDirectory, "capture.json", { sourceRoot: repository, root, files, captureHash: candidate.captureHash });
    candidate.checkpoint({ checkpointId: "baseline" });
    return candidate;
  }

  static reopen({ controlDirectory, storageDirectory, expectedCaptureHash }: { readonly controlDirectory: string; readonly storageDirectory: string; readonly expectedCaptureHash: string }): CandidateWorkspace {
    const storage = realpathSync(storageDirectory);
    const control = realpathSync(controlDirectory);
    if (control !== controlDirectory || !inside(storage, control) || path.basename(control) !== "control") throw new Error("Control directory is outside owned storage");
    const value = readRecord(control, "capture.json");
    if (typeof value !== "object" || value === null || !("root" in value) || typeof value.root !== "string" || !("sourceRoot" in value) || typeof value.sourceRoot !== "string" || !("files" in value) || !Array.isArray(value.files)) throw new Error("Invalid capture metadata");
    const root = realpathSync(value.root);
    if (root !== value.root || path.dirname(root) !== path.dirname(control) || path.basename(root) !== "candidate" || !inside(storage, root) || root === value.sourceRoot || inside(value.sourceRoot, root)) throw new Error("Invalid isolated candidate root");
    const files = value.files.map((file: unknown): CapturedFile => {
      if (typeof file !== "object" || file === null || !("baseline" in file) || typeof file.baseline !== "object" || file.baseline === null || !("content" in file) || (typeof file.content !== "string" && file.content !== null)) throw new Error("Invalid captured file");
      const mode = parseFileMode("mode" in file ? file.mode : undefined, file.content);
      const baseline = file.baseline;
      if (!("fileId" in baseline) || typeof baseline.fileId !== "string" || !("relativePath" in baseline) || typeof baseline.relativePath !== "string" || !("kind" in baseline)) throw new Error("Invalid capture baseline");
      if (baseline.kind === "absent" && file.content === null) return { baseline: { kind: "absent", fileId: baseline.fileId, relativePath: baseline.relativePath }, content: null, mode: null };
      if (baseline.kind !== "existing" || !("sha256" in baseline) || typeof baseline.sha256 !== "string" || !("bytes" in baseline) || typeof baseline.bytes !== "number" || typeof file.content !== "string" || digest(file.content) !== baseline.sha256 || Buffer.byteLength(file.content) !== baseline.bytes) throw new Error("Captured bytes mismatch");
      return { baseline: { kind: "existing", fileId: baseline.fileId, relativePath: baseline.relativePath, sha256: baseline.sha256, bytes: baseline.bytes }, content: file.content, mode };
    });
    validateFileManifest(files.map(file => file.baseline));
    const candidate = new CandidateWorkspace(root, files, value.sourceRoot, control);
    if (candidate.captureHash !== expectedCaptureHash) throw new Error("Capture identity mismatch");
    return candidate;
  }

  get sourceRoot(): string { return this.repositoryRoot; }

  private snapshot(): readonly FileImage[] { return this.files.map(file => readImage(this.root, file.baseline.relativePath)); }
  manifestHash(): string { return imageHash(this.snapshot()); }
  diff(): readonly FileChange[] {
    return imageChanges(this.files.map(file => ({ relativePath: file.baseline.relativePath, content: file.content, mode: file.mode })), this.snapshot());
  }

  checkpoint({ checkpointId }: { readonly checkpointId: string }): { readonly checkpointId: string; readonly manifestHash: string } {
    const images = this.snapshot();
    const filename = `checkpoint-${digest(checkpointId)}.json`;
    if (existsSync(path.join(this.controlDirectory, filename))) {
      const previous = this.loadCheckpoint(checkpointId);
      if (imageHash(previous) !== imageHash(images)) throw new Error("Checkpoint identity already exists");
    } else writeRecord(this.controlDirectory, filename, images);
    return { checkpointId, manifestHash: imageHash(images) };
  }
  private loadCheckpoint(checkpointId: string): readonly FileImage[] {
    const images = parseImages(readRecord(this.controlDirectory, `checkpoint-${digest(checkpointId)}.json`));
    if (images.length !== this.files.length || images.some((image, index) => image.relativePath !== this.files[index]?.baseline.relativePath)) throw new Error("Checkpoint scope mismatch");
    return images;
  }
  previewRestore({ checkpointId }: { readonly checkpointId: string }): { readonly currentManifestHash: string; readonly targetManifestHash: string; readonly changes: readonly (FileChange & { readonly kind: "create" | "replace" | "delete" })[] } {
    const target = this.loadCheckpoint(checkpointId);
    const current = this.snapshot();
    return { currentManifestHash: imageHash(current), targetManifestHash: imageHash(target), changes: imageChanges(current, target).map(change => ({ ...change, kind: change.after === null ? "delete" : change.before === null ? "create" : "replace" })) };
  }

  apply({ commandId, proposal, afterStep }: { readonly commandId: string; readonly proposal: PatchProposal; readonly afterStep?: (index: number) => void }): JournalResult {
    const filename = `journal-${digest(commandId)}.json`;
    if (existsSync(path.join(this.controlDirectory, filename))) return this.reconcile({ commandId, afterStep });
    const parsed = parsePatchProposal({ files: this.files.map(file => file.baseline), value: { summary: proposal.summary, operations: proposal.operations.map(operation => ({ fileId: operation.baseline.fileId, content: operation.kind === "delete" ? null : operation.content })) } });
    const changes = parsed.operations.map(operation => {
      const captured = this.files.find(file => file.baseline.fileId === operation.baseline.fileId);
      if (!captured || JSON.stringify(captured.baseline) !== JSON.stringify(operation.baseline)) throw new Error("Patch baseline mismatch");
      return { relativePath: operation.baseline.relativePath, before: captured.content, after: operation.kind === "delete" ? null : operation.content, beforeMode: captured.mode, afterMode: operation.kind === "delete" ? null : captured.mode ?? 0o600 };
    });
    const current = this.snapshot();
    const conflicts = imageChanges(this.files.map(file => ({ relativePath: file.baseline.relativePath, content: file.content, mode: file.mode })), current).map(file => file.relativePath);
    if (conflicts.length) return { kind: "conflict", paths: conflicts, reason: "Candidate differs from approved baseline" };
    return this.begin(commandId, changes, afterStep);
  }
  restore({ commandId, checkpointId, expectedManifestHash, afterStep }: { readonly commandId: string; readonly checkpointId: string; readonly expectedManifestHash: string; readonly afterStep?: (index: number) => void }): JournalResult {
    if (existsSync(path.join(this.controlDirectory, `journal-${digest(commandId)}.json`))) return this.reconcile({ commandId, afterStep });
    const preview = this.previewRestore({ checkpointId });
    if (preview.currentManifestHash !== expectedManifestHash) return { kind: "conflict", paths: this.files.map(file => file.baseline.relativePath), reason: "Restore preview is stale" };
    this.checkpoint({ checkpointId: `preserved:${commandId}` });
    return this.begin(commandId, preview.changes, afterStep);
  }
  private begin(commandId: string, changes: readonly FileChange[], afterStep?: (index: number) => void): JournalResult {
    const filename = `journal-${digest(commandId)}.json`;
    writeRecord(this.controlDirectory, filename, { commandId, changes, completed: false });
    return this.reconcile({ commandId, afterStep });
  }
  reconcile({ commandId, afterStep }: { readonly commandId: string; readonly afterStep?: (index: number) => void }): JournalResult {
    const filename = `journal-${digest(commandId)}.json`;
    const journal = parseJournal(readRecord(this.controlDirectory, filename));
    if (journal.commandId !== commandId || journal.changes.some(change => !this.files.some(file => file.baseline.relativePath === change.relativePath))) throw new Error("Journal scope mismatch");
    return replayJournal({ root: this.root, controlDirectory: this.controlDirectory, filename, journal, snapshot: () => this.snapshot(), ...(afterStep ? { afterStep } : {}) });
  }
  inspectOriginal(): { readonly kind: "unchanged" } | { readonly kind: "changed"; readonly paths: readonly string[] } {
    const root = realpathSync(this.repositoryRoot);
    const changed = this.files.filter(file => {
      try {
        const current = captureFile(root, file.baseline.relativePath);
        return current.mode !== file.mode || current.baseline.kind !== file.baseline.kind || (current.baseline.kind === "existing" && file.baseline.kind === "existing" && current.baseline.sha256 !== file.baseline.sha256);
      } catch { return true; }
    }).map(file => file.baseline.relativePath);
    return changed.length ? { kind: "changed", paths: changed } : { kind: "unchanged" };
  }
}
