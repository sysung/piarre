import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const probePath = path.join(
  repositoryRoot,
  "packages/core/src/index.ts",
);

test("core rejects static and dynamic editor imports", async () => {
  const eslint = new ESLint({ cwd: repositoryRoot });
  const [result] = await eslint.lintText(
    [
      'import "vscode";',
      'import "../../../apps/vscode/src/extension";',
      'void import("vscode");',
      'void import("../../../apps/vscode/src/extension");',
    ].join("\n"),
    { filePath: probePath },
  );
  const boundaryFailures = result.messages.filter(
    ({ message }) => message.includes("Core must remain independent"),
  );

  assert.equal(boundaryFailures.length, 4);
});
