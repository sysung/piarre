import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from "@vscode/test-electron";
import { isolatedSettings } from "../test/profile-settings.mjs";
import { vscodeVersion } from "../../../config/vscode-version.mjs";

const temporaryProfile = await mkdtemp(path.join(tmpdir(), "piarre-package-"));
try {
  await mkdir(path.join(temporaryProfile, "user", "User"), { recursive: true });
  await writeFile(path.join(temporaryProfile, "user", "User", "settings.json"), JSON.stringify(isolatedSettings));
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
  const repository = path.join(temporaryProfile, "repository");
  await mkdir(repository);
  execFileSync("git", ["init", repository], { stdio: "ignore" });
  execFileSync("npm", ["run", "test:compile"], { stdio: "inherit" });
  await runTests({
    extensionDevelopmentPath: path.join(temporaryProfile, "extensions", `${manifest.publisher}.${manifest.name}-${manifest.version}`),
    extensionTestsPath: path.resolve("dist-test/suite/index.js"),
    version: vscodeVersion,
    extensionTestsEnv: { PIARRE_PACKAGE_TEST: "1" },
    launchArgs: [repository, "--disable-workspace-trust", "--disable-extensions", ...profile],
  });
  console.log("Packaged extension opened a real repository successfully.");
} finally {
  await rm(temporaryProfile, { recursive: true, force: true });
}
