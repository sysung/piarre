import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
