import { build } from "esbuild";
import { readdir, rm } from "node:fs/promises";

const entries = (await readdir("test/suite")).filter((name) => name === "index.ts" || name.endsWith(".test.ts"));
await rm("dist-test/suite", { recursive: true, force: true });

await build({
  bundle: true,
  external: ["vscode", "mocha"],
  entryPoints: entries.map((name) => `test/suite/${name}`),
  format: "cjs",
  logLevel: "info",
  outbase: "test/suite",
  outdir: "dist-test/suite",
  platform: "node",
  sourcemap: false,
  target: "node22",
});
