import { build } from "esbuild";
import { readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const entries = (await readdir("test/suite")).filter((name) => name === "index.ts" || name.endsWith(".test.ts"));
await rm("dist-test/suite", { recursive: true, force: true });

await build({
  bundle: true,
  external: ["vscode", "mocha"],
  plugins: [{
    name: "lifetime-host-fixture",
    setup(builder) {
      builder.onResolve({ filter: /^vscode$/ }, ({ importer }) => {
        if (!/[\\/](extension|diagnostic-commands|knowledge-controller)\.ts$/.test(importer)) return;
        return { path: fileURLToPath(new URL("./test/suite/project-lifetime-vscode.ts", import.meta.url)) };
      });
    },
  }],
  entryPoints: entries.map((name) => `test/suite/${name}`),
  format: "cjs",
  logLevel: "info",
  outbase: "test/suite",
  outdir: "dist-test/suite",
  platform: "node",
  sourcemap: false,
  target: "node22",
});
