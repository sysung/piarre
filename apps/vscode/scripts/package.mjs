import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const packageRoot = process.cwd();
const outputDirectory = path.join(packageRoot, "dist-package");
const manifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const outputPath = path.join(outputDirectory, `piarre-${String(manifest.version)}.vsix`);

await mkdir(outputDirectory, { recursive: true });
execFileSync("npm", ["run", "build"], { stdio: "inherit" });
execFileSync(
  "npx",
  ["vsce", "package", "--no-dependencies", "--out", outputPath],
  { stdio: "inherit" },
);

const listing = execFileSync("npx", ["vsce", "ls", "--no-dependencies"], {
  encoding: "utf8",
});
const files = listing.trim().split("\n").filter(Boolean);
const expectedFiles = new Set(["README.md", "package.json", "dist/extension.js"]);
const unexpected = files.filter((file) => !expectedFiles.has(file));
const missing = [...expectedFiles].filter((file) => !files.includes(file));

if (unexpected.length > 0 || missing.length > 0) {
  throw new Error(
    `Unexpected VSIX content. Extra: ${unexpected.join(", ")}; missing: ${missing.join(", ")}`,
  );
}

await writeFile(path.join(outputDirectory, "contents.txt"), `${listing.trim()}\n`, "utf8");
console.log(listing.trim());
