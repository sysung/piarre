import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { vscodeVersion } from "../config/vscode-version.mjs";

const extensionManifestUrl = new URL(
  "../apps/vscode/package.json",
  import.meta.url,
);
const rootManifestUrl = new URL("../package.json", import.meta.url);

test("F5 opens the contributor repository in the development host", async () => {
  const launch = JSON.parse(
    await readFile(new URL("../.vscode/launch.json", import.meta.url), "utf8"),
  );
  const configuration = launch.configurations.find(
    ({ name }) => name === "Run Piarre Extension",
  );
  assert.ok(configuration.args.includes("${workspaceFolder}"));
  assert.ok(configuration.args.includes("--disable-extensions"));
});

test("the extension exposes the Piarre: Open activation seam", async () => {
  const manifest = JSON.parse(await readFile(extensionManifestUrl, "utf8"));

  assert.deepEqual(manifest.activationEvents, [
    "onCommand:piarre.open",
    "workspaceContains:.git",
  ]);
  assert.deepEqual(manifest.contributes?.commands, [
    {
      command: "piarre.open",
      title: "Piarre: Open",
    },
    {
      command: "piarre.renameProject",
      title: "Piarre: Rename Project",
      enablement: "isWorkspaceTrusted",
    },
    {
      command: "piarre.proposeTask",
      title: "Piarre: Propose Task",
      enablement: "isWorkspaceTrusted",
    },
    {
      command: "piarre.stopAll",
      title: "Piarre: Stop All Work",
      enablement: "isWorkspaceTrusted",
    },
    ...[ ["createDiagnosticBundle", "Create Diagnostic Bundle"], ["exportDiagnosticBundle", "Export Diagnostic Bundle"], ["deleteDiagnosticBundle", "Delete Diagnostic Bundle"] ].map(([command, title]) => ({ command: `piarre.${command}`, title: `Piarre: ${title}`, enablement: "isWorkspaceTrusted" })),
    { command: "piarre.endSession", title: "Piarre: End Session (Optional Reflection)", enablement: "isWorkspaceTrusted" },
    { command: "piarre.reviewReflection", title: "Piarre: Review Reflection", enablement: "isWorkspaceTrusted" },
    { command: "piarre.explanationPreference", title: "Piarre: Explanation Preference", enablement: "isWorkspaceTrusted" },
  ]);
});

test("the editor toolchain stays aligned to the pinned VS Code version", async () => {
  const [extensionManifest, rootManifest] = await Promise.all([
    readFile(extensionManifestUrl, "utf8").then(JSON.parse),
    readFile(rootManifestUrl, "utf8").then(JSON.parse),
  ]);

  assert.match(vscodeVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(extensionManifest.engines?.vscode, `^${vscodeVersion}`);
  assert.equal(rootManifest.devDependencies?.["@types/vscode"], vscodeVersion);
});

test("docs contains only the five lasting project documents", async () => {
  const entries = await readdir(new URL("../docs/", import.meta.url));
  assert.deepEqual(entries.sort(), [
    "00_README.md",
    "01_PRODUCT_PRD.md",
    "02_TECHNICAL_DESIGN.md",
    "03_IMPLEMENTATION_BACKLOG.md",
    "04_USER_DESIGN_PRINCIPLES.md",
  ], "Keep lasting content in the five docs files. Put temporary plans, evidence, and history in .artifacts; track work in GitHub issues.");
});
