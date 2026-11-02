import { createHash, randomUUID } from "node:crypto";
import { constants, closeSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, writeFileSync, type Stats } from "node:fs";
import path from "node:path";
import { validateFileManifest, type FileBaseline } from "../../../packages/core/src/execution-patch.js";

export interface CapturedFile {
  readonly baseline: FileBaseline;
  readonly content: string | null;
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
      return { baseline: { kind: "absent", fileId, relativePath }, content: null };
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
    return { baseline: { kind: "existing", fileId, relativePath, sha256: sha256(bytes), bytes: bytes.byteLength }, content };
  } finally { closeSync(descriptor); }
}

export class CandidateWorkspace {
  private constructor(readonly root: string, readonly files: readonly CapturedFile[], private readonly repositoryRoot: string) {}

  static capture({ repositoryRoot, relativePaths, storageDirectory }: {
    readonly repositoryRoot: string; readonly relativePaths: readonly string[]; readonly storageDirectory: string;
  }): CandidateWorkspace {
    const repository = realpathSync(repositoryRoot);
    const storage = realpathSync(storageDirectory);
    if (!lstatSync(repository).isDirectory() || !lstatSync(storage).isDirectory() || storage === repository || within(repository, storage)) {
      throw new Error("Candidate storage must be a directory outside the repository.");
    }
    const files = relativePaths.map(relative => captureFile(repository, relative));
    validateFileManifest(files.map(file => file.baseline));
    const normalized = files.map(file => file.baseline.relativePath.normalize("NFC").toLowerCase());
    if (new Set(normalized).size !== normalized.length || normalized.some(left => normalized.some(right => left !== right && right.startsWith(left + "/")))) {
      throw new Error("Overlapping or case-colliding file paths are unsupported.");
    }
    const root = mkdtempSync(path.join(storage, "candidate-"));
    for (const file of files) {
      if (file.content === null) continue;
      const target = path.join(root, file.baseline.relativePath);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, file.content, { flag: "wx", mode: 0o600 });
    }
    return new CandidateWorkspace(root, files, repository);
  }

  inspectOriginal(): { readonly kind: "unchanged" } | { readonly kind: "changed"; readonly paths: readonly string[] } {
    const root = realpathSync(this.repositoryRoot);
    const changed = this.files.filter(file => {
      try {
        const current = captureFile(root, file.baseline.relativePath);
        return current.baseline.kind !== file.baseline.kind || (current.baseline.kind === "existing" && file.baseline.kind === "existing" && current.baseline.sha256 !== file.baseline.sha256);
      } catch { return true; }
    }).map(file => file.baseline.relativePath);
    return changed.length ? { kind: "changed", paths: changed } : { kind: "unchanged" };
  }
}
