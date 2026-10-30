import { build, context } from "esbuild";

const options = {
  bundle: true,
  entryPoints: ["src/extension.ts"],
  external: ["vscode"],
  format: "cjs",
  logLevel: "info",
  minify: true,
  outfile: "dist/extension.js",
  platform: "node",
  sourcemap: false,
  target: "node22",
};

if (process.argv.includes("--watch")) {
  const buildContext = await context(options);
  await buildContext.watch();
} else {
  await build(options);
}
