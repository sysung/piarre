import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const extension = path.join(root, "apps/vscode");
const output = path.join(extension, "dist-package/candidate");
const stage = mkdtempSync(path.join(tmpdir(), "piarre-candidate-package-"));
try {
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
  const manifest = JSON.parse(readFileSync(path.join(extension, "package.json"), "utf8"));
  manifest.name = "piarre-candidate";
  manifest.displayName = "Piarre Candidate";
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(stage, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0 && manifest.files.length <= 50, "List exact runtime files in the extension manifest");
  for (const file of manifest.files) {
    assert.ok(typeof file === "string" && !path.isAbsolute(file) && !file.includes("\\") && !/[*?{}]/.test(file) && file.split("/").every(part => part && part !== "." && part !== ".."), "Candidate packaging requires exact relative runtime file paths");
    const target = path.join(stage, file);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(extension, file), target);
  }
  const filename = `piarre-candidate-${manifest.version}.vsix`;
  const vsce = path.join(root, "node_modules/@vscode/vsce/vsce");
  execFileSync(process.execPath, [vsce, "package", "--no-dependencies", "--out", path.join(output, filename)], { cwd: stage, stdio: "inherit" });
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const provenance = { schemaVersion: 1, extensionId: "sysung.piarre-candidate", version: manifest.version,
    commit: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain", "--untracked-files=all") !== "",
    checks: "Package creation is not a passed check. Use revision-bound acceptance evidence separately.",
    sourceIdentity: "sysung.piarre", runtimeIsolation: "Distinct extension identity and explicit candidate user-data/extensions directories required." };
  writeFileSync(path.join(output, "build-info.json"), JSON.stringify(provenance, null, 2) + "\n");
  const sums = [filename, "build-info.json"].map(name => `${createHash("sha256").update(readFileSync(path.join(output, name))).digest("hex")}  ${name}`);
  writeFileSync(path.join(output, "SHA256SUMS"), sums.join("\n") + "\n");
  process.stdout.write(`Candidate package: ${path.join(output, filename)}\n`);
} finally { rmSync(stage, { recursive: true, force: true }); }
