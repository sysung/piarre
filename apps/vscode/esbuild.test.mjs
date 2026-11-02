import { build } from "esbuild";

await build({
  bundle: true,
  external: ["vscode", "mocha"],
  entryPoints: [
    "test/suite/activation.test.ts",
    "test/suite/index.ts",
    "test/suite/project.test.ts",
    "test/suite/proposal.test.ts",
    "test/suite/foundations.test.ts",
    "test/suite/costs.test.ts",
    "test/suite/provider-settings.test.ts",
    "test/suite/untrusted.test.ts",
  ],
  format: "cjs",
  logLevel: "info",
  outbase: "test/suite",
  outdir: "dist-test/suite",
  platform: "node",
  sourcemap: false,
  target: "node22",
});
