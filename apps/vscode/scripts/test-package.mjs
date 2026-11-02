import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron";
import { vscodeVersion } from "../../../config/vscode-version.mjs";

const temporaryProfile = await mkdtemp(path.join(tmpdir(), "piarre-package-"));
try {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  const executable = await downloadAndUnzipVSCode(vscodeVersion);
  const [cli] = resolveCliArgsFromVSCodeExecutablePath(executable);
  const profile = [
    "--user-data-dir", path.join(temporaryProfile, "user"),
    "--extensions-dir", path.join(temporaryProfile, "extensions"),
  ];
  const options = { encoding: "utf8", shell: process.platform === "win32" };
  const vsix = path.resolve("dist-package", `piarre-${manifest.version}.vsix`);
  console.log(execFileSync(cli, [...profile, "--install-extension", vsix], options));
  const installed = execFileSync(cli, [...profile, "--list-extensions", "--show-versions"], options);
  const expected = `${manifest.publisher}.${manifest.name}@${manifest.version}`;
  assert.ok(installed.split(/\r?\n/).includes(expected), `Installed package missing: ${expected}`);
  console.log(`Verified installed VSIX: ${expected}`);
} finally {
  await rm(temporaryProfile, { recursive: true, force: true });
}
