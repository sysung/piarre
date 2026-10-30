import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";
import { vscodeVersion } from "../../../config/vscode-version.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testRoot = await mkdtemp(path.join(tmpdir(), "piarre-smoke-"));
const fixturePath = path.join(testRoot, "workspace");
const userDataPath = path.join(testRoot, "user-data");
const extensionsPath = path.join(testRoot, "extensions");
const logPath = path.join(packageRoot, "dist-test", "smoke.log");

await Promise.all([
  mkdir(fixturePath, { recursive: true }),
  mkdir(userDataPath, { recursive: true }),
  mkdir(extensionsPath, { recursive: true }),
  mkdir(path.dirname(logPath), { recursive: true }),
]);

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
    extensionTestsPath: path.join(packageRoot, "dist-test", "suite", "index.js"),
    launchArgs: [
      fixturePath,
      "--disable-extensions",
      "--user-data-dir",
      userDataPath,
      "--extensions-dir",
      extensionsPath,
    ],
    version: vscodeVersion,
  });
  await writeFile(logPath, `${environment}\nResult: passed\n`, "utf8");
} catch (error) {
  await writeFile(logPath, `${environment}\nResult: failed\n${String(error)}\n`, "utf8");
  throw error;
}
