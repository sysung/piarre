import { realpathSync } from "node:fs";
import path from "node:path";

export function canonicalWorkspacePath(value: string): string {
  const absolute = path.resolve(value);
  let cursor = absolute;
  const missing: string[] = [];
  for (;;) {
    try { return path.join(realpathSync(cursor), ...missing.reverse()); }
    catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") return absolute;
      const parent = path.dirname(cursor);
      if (parent === cursor) return absolute;
      missing.push(path.basename(cursor)); cursor = parent;
    }
  }
}
