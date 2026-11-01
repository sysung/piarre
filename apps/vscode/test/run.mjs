import { mkdir, mkdtemp, writeFile, rm, readdir } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests, downloadAndUnzipVSCode } from "@vscode/test-electron";
import { vscodeVersion } from "../../../config/vscode-version.mjs";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const testRoot = await mkdtemp(path.join(tmpdir(), "piarre-smoke-"));
const fixturePath = path.join(testRoot, "workspace");
const userDataPath = path.join(testRoot, "user-data");
const extensionsPath = path.join(testRoot, "extensions");
const logPath = path.join(packageRoot, "dist-test", "smoke.log");
const cachePath = process.env.PIARRE_VSCODE_CACHE_PATH;

await Promise.all([
  mkdir(fixturePath, { recursive: true }),
  mkdir(userDataPath, { recursive: true }),
  mkdir(extensionsPath, { recursive: true }),
  mkdir(path.dirname(logPath), { recursive: true }),
]);
execFileSync("git", ["init", fixturePath]);

const environment = [
  `Node: ${process.version}`,
  `Platform: ${process.platform} ${process.arch}`,
  `VS Code: ${vscodeVersion}`,
].join("\n");

await writeFile(logPath, `${environment}\n`, "utf8");
console.log(environment);

try {
  await runTests({
    extensionDevelopmentPath: packageRoot,
    extensionTestsPath: path.join(
      packageRoot,
      "dist-test",
      "suite",
      "index.js",
    ),
    launchArgs: [
      fixturePath,
      "--disable-extensions",
      "--disable-workspace-trust",
      "--user-data-dir",
      userDataPath,
      "--extensions-dir",
      extensionsPath,
    ],
    version: vscodeVersion,
    ...(cachePath ? { cachePath } : {}),
  });
  await writeFile(logPath, `${environment}\nResult: passed\n`, "utf8");
  const restrictedUserData = path.join(testRoot, "restricted-user-data");
  await mkdir(path.join(restrictedUserData, "User"), { recursive: true });
  await writeFile(path.join(restrictedUserData, "User", "settings.json"), JSON.stringify({
    "security.workspace.trust.enabled": true,
    "security.workspace.trust.startupPrompt": "never",
    "security.workspace.trust.emptyWindow": false,
  }));
  const executable = await downloadAndUnzipVSCode(
    cachePath ? { version: vscodeVersion, cachePath } : vscodeVersion,
  );
  await new Promise((resolve, reject) => {
    const child = spawn(executable, [fixturePath, "--no-sandbox", "--skip-welcome",
      "--disable-extensions", "--user-data-dir", restrictedUserData,
      "--extensions-dir", extensionsPath, `--extensionDevelopmentPath=${packageRoot}`,
      `--extensionTestsPath=${path.join(packageRoot, "dist-test", "suite", "index.js")}`], {
      stdio: "inherit", env: { ...process.env, PIARRE_UNTRUSTED_TEST: "1" },
    });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Restricted host exited ${code}`)));
  });
  const restrictedFiles = await readdir(restrictedUserData, { recursive: true });
  if (restrictedFiles.some((file) => file.endsWith("project.sqlite"))) {
    throw new Error("Restricted workspace persisted a project database");
  }
  await writeFile(logPath, `${environment}\nTrusted and restricted hosts: passed\n`, "utf8");
} catch (error) {
  await writeFile(
    logPath,
    `${environment}\nResult: failed\n${String(error)}\n`,
    "utf8",
  );
  throw error;
} finally {
  await rm(testRoot, { recursive: true, force: true });
}
