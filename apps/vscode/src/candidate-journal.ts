import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface FileImage { readonly relativePath: string; readonly content: string | null; readonly mode: number | null }
export interface FileChange { readonly relativePath: string; readonly before: string | null; readonly after: string | null; readonly beforeMode: number | null; readonly afterMode: number | null }
export interface Journal { readonly commandId: string; readonly changes: readonly FileChange[]; readonly completed: boolean }
export type JournalResult = { readonly kind: "current" | "changed"; readonly manifestHash: string }
  | { readonly kind: "partial" | "conflict"; readonly paths: readonly string[]; readonly reason: string };
export const digest = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
export const imageHash = (files: readonly FileImage[]): string => digest(JSON.stringify(files));
export function permissionMode(mode: number): number {
  if (mode & 0o7000) throw new Error("Special permission bits are unsupported");
  return mode & 0o777;
}
export function parseFileMode(value: unknown, content: string | null): number | null {
  if (content === null && value === null) return null;
  if (content !== null && typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 0o777) return value;
  throw new Error("Invalid file permissions");
}
export function imageChanges(before: readonly FileImage[], after: readonly FileImage[]): readonly FileChange[] {
  if (before.length !== after.length) throw new Error("Image scope mismatch");
  return after.flatMap((image, index) => {
    const previous = before[index];
    if (!previous || previous.relativePath !== image.relativePath) throw new Error("Image scope mismatch");
    return previous.content === image.content && previous.mode === image.mode ? [] : [{ relativePath: image.relativePath, before: previous.content, after: image.content, beforeMode: previous.mode, afterMode: image.mode }];
  });
}
export function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
export function safePath(root: string, relativePath: string): string {
  if (!relativePath || relativePath.includes("\\") || relativePath.includes("\0") || relativePath.split("/").some(part => !part || part === "." || part === ".." || part === ".git" || part === ".piarre")) throw new Error("Invalid candidate path");
  if (realpathSync(root) !== root || !lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) throw new Error("Candidate root changed");
  let cursor = root;
  const parts = relativePath.split("/");
  for (const [index, part] of parts.entries()) {
    cursor = path.join(cursor, part);
    if (!inside(root, cursor)) throw new Error("Candidate path escaped");
    try {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink() || (index < parts.length - 1 && !stat.isDirectory()) || (index === parts.length - 1 && (!stat.isFile() || stat.nlink !== 1))) throw new Error("Unsupported candidate file type or link");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  return cursor;
}
export function readImage(root: string, relativePath: string): FileImage {
  const target = safePath(root, relativePath);
  let descriptor: number;
  try { descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { relativePath, content: null, mode: null };
    throw error;
  }
  try {
    const before = fstatSync(descriptor);
    if (!before.isFile() || before.nlink !== 1 || before.size > 256_000) throw new Error("Unsupported bounded regular file");
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    const current = lstatSync(target);
    if (before.ino !== current.ino || before.dev !== current.dev || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || current.isSymbolicLink() || current.nlink !== 1 || current.mode !== before.mode) throw new Error("File changed while reading");
    const content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    if (content.includes("\0")) throw new Error("Binary files are unsupported");
    return { relativePath, content, mode: permissionMode(before.mode) };
  } finally { closeSync(descriptor); }
}
function syncDirectory(directory: string): void {
  const fd = openSync(directory, constants.O_RDONLY);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
export function writeRecord(directory: string, filename: string, value: unknown): void {
  if (path.basename(filename) !== filename || realpathSync(directory) !== directory || !lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw new Error("Invalid control directory");
  const temporary = path.join(directory, `.record-${randomUUID()}`);
  const fd = openSync(temporary, "wx", 0o600);
  try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, path.join(directory, filename)); syncDirectory(directory);
}
export function readRecord(directory: string, filename: string): unknown {
  if (path.basename(filename) !== filename || realpathSync(directory) !== directory || lstatSync(directory).isSymbolicLink()) throw new Error("Invalid control directory");
  const target = path.join(directory, filename);
  const stat = lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4_000_000) throw new Error("Invalid control record");
  const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { return JSON.parse(readFileSync(fd, "utf8")); } finally { closeSync(fd); }
}
export function parseImages(value: unknown): readonly FileImage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error("Invalid checkpoint");
  return value.map((item: unknown) => {
    if (typeof item !== "object" || item === null || !("relativePath" in item) || typeof item.relativePath !== "string" || !("content" in item) || (item.content !== null && typeof item.content !== "string")) throw new Error("Invalid checkpoint entry");
    return { relativePath: item.relativePath, content: item.content, mode: parseFileMode("mode" in item ? item.mode : undefined, item.content) };
  });
}
export function parseJournal(value: unknown): Journal {
  if (typeof value !== "object" || value === null || !("commandId" in value) || typeof value.commandId !== "string" || !("completed" in value) || typeof value.completed !== "boolean" || !("changes" in value) || !Array.isArray(value.changes)) throw new Error("Invalid candidate journal");
  const changes = value.changes.map((item: unknown): FileChange => {
    if (typeof item !== "object" || item === null || !("relativePath" in item) || typeof item.relativePath !== "string" || !("before" in item) || (typeof item.before !== "string" && item.before !== null) || !("after" in item) || (typeof item.after !== "string" && item.after !== null)) throw new Error("Invalid journal step");
    return { relativePath: item.relativePath, before: item.before, after: item.after, beforeMode: parseFileMode("beforeMode" in item ? item.beforeMode : undefined, item.before), afterMode: parseFileMode("afterMode" in item ? item.afterMode : undefined, item.after) };
  });
  if (changes.length > 20 || new Set(changes.map(change => change.relativePath)).size !== changes.length) throw new Error("Invalid journal scope");
  return { commandId: value.commandId, completed: value.completed, changes };
}
export function replayJournal({ root, controlDirectory, filename, journal, snapshot, afterStep }: {
  readonly root: string; readonly controlDirectory: string; readonly filename: string; readonly journal: Journal;
  readonly snapshot: () => readonly FileImage[]; readonly afterStep?: (index: number) => void;
}): JournalResult {
  if (journal.completed) return { kind: "current", manifestHash: imageHash(snapshot()) };
  let changed = false;
  try {
    for (const [index, change] of journal.changes.entries()) {
      const current = readImage(root, change.relativePath);
      if (current.content === change.after && current.mode === change.afterMode) continue;
      if (current.content !== change.before || current.mode !== change.beforeMode) return { kind: "conflict", paths: [change.relativePath], reason: "Current bytes diverged from the journal before and after images" };
      const target = safePath(root, change.relativePath);
      if (change.after === null) unlinkSync(target);
      else {
        mkdirSync(path.dirname(target), { recursive: true });
        safePath(root, change.relativePath);
        const temporary = path.join(path.dirname(target), `.piarre-${randomUUID()}`);
        const fd = openSync(temporary, "wx", 0o600);
        try {
          if (change.afterMode === null) throw new Error("Missing target file permissions");
          writeFileSync(fd, change.after); fchmodSync(fd, change.afterMode); fsyncSync(fd);
        } finally { closeSync(fd); }
        // Recheck immediately before rename. This is not an atomic CAS against external editors.
        const observed = readImage(root, change.relativePath);
        if (observed.content !== change.before || observed.mode !== change.beforeMode) { unlinkSync(temporary); return { kind: "conflict", paths: [change.relativePath], reason: "Candidate changed immediately before replacement" }; }
        renameSync(temporary, target);
      }
      syncDirectory(path.dirname(target)); changed = true; afterStep?.(index);
    }
    writeRecord(controlDirectory, filename, { ...journal, completed: true });
    return { kind: changed ? "changed" : "current", manifestHash: imageHash(snapshot()) };
  } catch (error) { return { kind: "partial", paths: journal.changes.map(change => change.relativePath), reason: error instanceof Error ? error.message : "Journal interrupted" }; }
}
