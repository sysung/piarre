import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";

const execute = promisify(execFile);

export async function findRepositoryRoot(cwd: string): Promise<string> {
  const { stdout } = await execute("git", ["rev-parse", "--show-toplevel"], {
    cwd, encoding: "buffer", timeout: 5000, maxBuffer: 1024 * 1024,
  });
  return realpath(stdout.toString("utf8").trim());
}
