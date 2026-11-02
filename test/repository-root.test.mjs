import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";

test("repository opening works without the host's text stream decoder", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "piarre-répô-"));
  try {
    execFileSync("git", ["init", directory], { stdio: "ignore" });
    const bundle = path.join(directory, "root.cjs");
    await build({ entryPoints: ["apps/vscode/src/repository-root.ts"], bundle: true,
      platform: "node", format: "cjs", outfile: bundle });
    const result = spawnSync(process.execPath, ["-e", `
      require('node:string_decoder').StringDecoder = undefined;
      require(process.argv[1]).findRepositoryRoot(process.argv[2]).then(
        root => process.stdout.write(root),
        error => { process.stderr.write(String(error)); process.exitCode = 1; }
      );
    `, bundle, directory], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, await realpath(directory));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
