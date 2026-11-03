import { execFile } from "node:child_process";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import path from "node:path";
import type { FileChange } from "./candidate-journal.js";

function helperPath(): string {
  // __dirname is dist/ in the installed extension and dist-test/suite/ in tests.
  const candidates = [path.resolve(__dirname, "../native/scoped-publication.py"), path.resolve(__dirname, "../../native/scoped-publication.py")];
  const found = candidates.find(existsSync);
  if (!found) throw new Error("Packaged scoped publication helper is missing.");
  return found;
}
export async function runPublicationHelper({ executable, helper, input }: { readonly executable: string; readonly helper: string; readonly input: unknown }): Promise<unknown> {
  const stdout = await new Promise<string>((resolve, reject) => {
    const child = execFile(executable, ["-I", helper], { encoding: "utf8", timeout: 15_000, maxBuffer: 2_000_000 }, (error, output) => {
      if (error) reject(new Error("Scoped publication helper did not return; retain ownership and inspect escrow."));
      else resolve(output);
    });
    child.stdin?.on("error", () => { /* Completion is established only by the exit receipt. */ });
    child.stdin?.end(JSON.stringify(input));
  });
  const value: unknown = JSON.parse(stdout);
  return value;
}
async function invoke(input: unknown): Promise<Record<string, unknown>> {
  const executable = ["/usr/bin/python3", "/opt/homebrew/bin/python3", "/usr/local/bin/python3"].find(existsSync);
  if (!executable) throw new Error("Scoped publication requires an installed Python 3 runtime with Unix directory-descriptor support.");
  const value = await runPublicationHelper({ executable, helper: helperPath(), input });
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid scoped publication receipt.");
  return value as Record<string, unknown>;
}
export async function publicationCapability(): Promise<void> {
  const result = await invoke({ kind: "capability" });
  if (result.kind !== "supported" || result.version !== 1) throw new Error(typeof result.reason === "string" ? result.reason : "Scoped publication unavailable.");
}
export async function checkEscrowLayout(root: string, controlDirectory: string, paths: readonly string[] = []): Promise<void> {
  await publicationCapability();
  const result = await invoke({ kind: "preflight", root, control: controlDirectory, paths });
  if (result.kind !== "supported") throw new Error(typeof result.reason === "string" ? result.reason : "Scoped publication preflight failed.");
}
export type ParentIdentity = readonly [number, number] | null;
export function publicationParents(root: string, relativePath: string): readonly ParentIdentity[] {
  const parents = [root]; let cursor = root;
  for (const part of relativePath.split("/").slice(0, -1)) { cursor = path.join(cursor, part); parents.push(cursor); }
  return parents.map(parent => { if (!existsSync(parent)) return null; const stat = lstatSync(parent); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Parent identity unavailable"); return [stat.dev, stat.ino]; });
}
export async function publishScopedChange(root: string, control: string, commandId: string, key: string, change: FileChange, parents: readonly ParentIdentity[]): Promise<void> {
  const result = await invoke({ root, control, commandId, key, change, parents });
  if (result.kind !== "complete") throw new Error(typeof result.reason === "string" ? result.reason : "Publication unknown; retained escrow needs review.");
}
export async function supersedePublication(control: string, commandId: string, successorId: string, previewId: string): Promise<void> {
  const result = await invoke({ kind: "supersede", control, commandId, successorId, previewId });
  if (result.kind !== "complete") throw new Error(typeof result.reason === "string" ? result.reason : "A publication helper may still own the control directory; recovery retains ownership.");
}
export function retainedEscrowDirectories(control: string): readonly string[] {
  return readdirSync(control).filter(name => /^escrow-[a-f0-9]{64}$/.test(name)).map(name => path.join(control, name));
}
