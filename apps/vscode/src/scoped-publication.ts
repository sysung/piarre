import { spawnSync } from "node:child_process";
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
function invoke(input: unknown): Record<string, unknown> {
  const executable = ["/usr/bin/python3", "/opt/homebrew/bin/python3", "/usr/local/bin/python3"].find(existsSync);
  if (!executable) throw new Error("Scoped publication requires an installed Python 3 runtime with Unix directory-descriptor support.");
  const result = spawnSync(executable, ["-I", helperPath()], { input: JSON.stringify(input), encoding: "utf8", timeout: 15_000, maxBuffer: 2_000_000 });
  if (result.error || result.status !== 0) throw new Error("Scoped publication helper did not return; retain ownership and inspect escrow.");
  const value: unknown = JSON.parse(result.stdout);
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid scoped publication receipt.");
  return value as Record<string, unknown>;
}
export function publicationCapability(): void {
  const result = invoke({ kind: "capability" });
  if (result.kind !== "supported" || result.version !== 1) throw new Error(typeof result.reason === "string" ? result.reason : "Scoped publication unavailable.");
}
export function checkEscrowLayout(root: string, controlDirectory: string, paths: readonly string[] = []): void {
  publicationCapability();
  const result = invoke({ kind: "preflight", root, control: controlDirectory, paths });
  if (result.kind !== "supported") throw new Error(typeof result.reason === "string" ? result.reason : "Scoped publication preflight failed.");
}
export type ParentIdentity = readonly [number, number] | null;
export function publicationParents(root: string, relativePath: string): readonly ParentIdentity[] {
  const parents = [root]; let cursor = root;
  for (const part of relativePath.split("/").slice(0, -1)) { cursor = path.join(cursor, part); parents.push(cursor); }
  return parents.map(parent => { if (!existsSync(parent)) return null; const stat = lstatSync(parent); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Parent identity unavailable"); return [stat.dev, stat.ino]; });
}
export function publishScopedChange(root: string, control: string, key: string, change: FileChange, parents: readonly ParentIdentity[]): void {
  const result = invoke({ root, control, key, change, parents });
  if (result.kind !== "complete") throw new Error(typeof result.reason === "string" ? result.reason : "Publication unknown; retained escrow needs review.");
}
export function retainedEscrowDirectories(control: string): readonly string[] {
  return readdirSync(control).filter(name => /^escrow-[a-f0-9]{64}$/.test(name)).map(name => path.join(control, name));
}
