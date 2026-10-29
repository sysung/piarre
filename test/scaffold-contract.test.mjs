import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { vscodeVersion } from "../config/vscode-version.mjs";

const extensionManifestUrl = new URL(
  "../apps/vscode/package.json",
  import.meta.url,
);
const rootManifestUrl = new URL("../package.json", import.meta.url);

test("the extension exposes the Piarre: Open activation seam", async () => {
  const manifest = JSON.parse(await readFile(extensionManifestUrl, "utf8"));

  assert.deepEqual(manifest.activationEvents, ["onCommand:piarre.open"]);
  assert.deepEqual(manifest.contributes?.commands, [
    {
      command: "piarre.open",
      title: "Piarre: Open",
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
