import { realpath } from "node:fs/promises";
import path from "node:path";

async function resolveFuturePath(target: string): Promise<string> {
  const missing: string[] = [];
  let current = path.resolve(target);
  for (;;) {
    try {
      const existing = await realpath(current);
      return path.join(existing, ...missing.reverse());
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missing.push(path.basename(current));
      current = parent;
    }
  }
}

export async function assertStorageOutsideRepository(input: {
  readonly repositoryRoot: string;
  readonly storagePath: string;
}): Promise<void> {
  const [repositoryRoot, storagePath] = await Promise.all([
    realpath(input.repositoryRoot),
    resolveFuturePath(input.storagePath),
  ]);
  const relative = path.relative(repositoryRoot, storagePath);
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  )
    throw new Error("Piarre storage must be outside the selected repository.");
}
