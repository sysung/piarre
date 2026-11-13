import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { vscodeVersion } from "../config/vscode-version.mjs";
import { resolveDocumentation, validateCatalogSources, validateHistoricalSources } from "../scripts/documentation-sources.mjs";

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

test("the README links to the local documentation entry points", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  for (const file of ["docs/overview.md", "docs/workflow.md", "docs/USER_DESIGN_PRINCIPLE.md"]) {
    assert.ok(readme.includes(`](${file})`), `README must link to ${file}`);
    await access(new URL(`../${file}`, import.meta.url));
  }
});

test("the local OpenSpec project owns its specifications and changes", async () => {
  const config = await readFile(new URL("../openspec/config.yaml", import.meta.url), "utf8");
  assert.match(config, /^schema: spec-driven$/m);
  assert.doesNotMatch(config, /^store:/m);
  await access(new URL("../openspec/specs/", import.meta.url));
  await access(new URL("../openspec/changes/", import.meta.url));
});

test("the local OpenSpec project resolves every live acceptance reference", async () => {
  const catalog = JSON.parse(await readFile(new URL("./acceptance/catalog.json", import.meta.url), "utf8"));
  const codeRoot = fileURLToPath(new URL("../", import.meta.url));
  validateCatalogSources(catalog, resolveDocumentation(codeRoot, { preview: true }));
});

test("historical acceptance inputs resolve in the original code repository", async () => {
  const [principles, retrievalFixture] = await Promise.all([
    readFile(new URL("./acceptance/principles.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("./acceptance/retrieval-fixture.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  validateHistoricalSources(fileURLToPath(new URL("../", import.meta.url)), principles, retrievalFixture);
});
