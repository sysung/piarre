import { build } from "esbuild";

await build({
  bundle: false,
  entryPoints: [
    "test/suite/activation.test.ts",
    "test/suite/index.ts",
  ],
  format: "cjs",
  logLevel: "info",
  outbase: "test/suite",
  outdir: "dist-test/suite",
  platform: "node",
  sourcemap: false,
  target: "node22",
});
