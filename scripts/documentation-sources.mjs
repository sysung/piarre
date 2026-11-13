import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { accessSync, constants, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

const revisionPattern = /^[a-f0-9]{40}$/;

function git(root, args, message) {
  const result = spawnSync("git", ["--no-replace-objects", ...args], { cwd: root });
  if (result.status !== 0) throw new Error(message, { cause: result.error });
  return result.stdout;
}

export function resolveDocumentation(codeRoot, { preview = false, revision } = {}) {
  let root;
  try {
    root = realpathSync(codeRoot);
  } catch (cause) {
    throw new Error(`Piarre checkout is missing or inaccessible at ${codeRoot}.`, { cause });
  }

  const topLevel = git(root, ["rev-parse", "--show-toplevel"], `Piarre checkout is inaccessible or not a Git working tree at ${root}.`);
  assert.equal(realpathSync(topLevel.toString().trim()), root, `Expected the Piarre repository root at ${root}.`);

  const head = git(root, ["rev-parse", "HEAD"], `Cannot read the Piarre revision at ${root}.`).toString().trim();
  if (revision !== undefined) {
    assert.ok(typeof revision === "string" && revisionPattern.test(revision), "Evidence requires a full Git commit SHA.");
    if (head !== revision) {
      git(root, ["cat-file", "-e", `${revision}^{commit}`], `Piarre revision ${revision} is unavailable at ${root}. Fetch the original code repository history.`);
      throw new Error(`Piarre revision changed from ${revision} to ${head}.`);
    }
  }
  if (!preview) {
    const status = git(root, ["-c", "core.fsmonitor=false", "status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"],
      `Cannot check Piarre working tree status at ${root}.`);
    if (status.length > 0) {
      throw new Error("Piarre checkout is dirty. Commit the working tree before collecting revision-bound acceptance evidence or request --preview.");
    }
  }
  return { root, revision: head, preview };
}

const scopedDocument = /^openspec\/(specs|changes)\/(?:[^/]+\/)+[^/]+\.md$/;

function headings(markdown) {
  const counts = new Map();
  let fence;
  for (const line of markdown.split(/\r?\n/)) {
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (delimiter) {
      const [, marker, suffix] = delimiter;
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length && !suffix.trim()) fence = undefined;
      continue;
    }
    if (!fence && /^#{1,6} /.test(line)) counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return counts;
}

export function validateCatalogSources(catalog, { root, revision, preview }) {
  assert.equal(catalog.schemaVersion, 1, "Unsupported acceptance catalog version.");
  const documents = new Map();
  for (const { id, source } of catalog.scenarios) {
    const document = source?.document;
    const category = typeof document === "string" && scopedDocument.exec(document)?.[1];
    const message = `Invalid requirement source for ${id}`;
    assert.ok(category && !document.includes("\\") && !document.split("/").some((segment) => segment === "." || segment === ".."),
      `${message}. Use a relative Markdown path scoped to openspec/specs or openspec/changes.`);

    const expected = category === "specs" ? { level: 3, heading: `Requirement: ${id}` } : { level: 2, heading: id };
    assert.ok(source.level === expected.level && source.heading === expected.heading,
      `${message}. Expected heading identity "${expected.heading}" at level ${expected.level}.`);

    if (!documents.has(document)) {
      let file;
      try {
        file = realpathSync(path.join(root, document));
      } catch (cause) {
        throw new Error(`${message}. Missing or inaccessible document ${document}.`, { cause });
      }
      const relative = path.relative(root, file).split(path.sep).join("/");
      assert.equal(scopedDocument.exec(relative)?.[1], category, `${message}. ${document} resolves outside its OpenSpec scope.`);
      try {
        assert.ok(statSync(file).isFile());
        accessSync(file, constants.R_OK);
      } catch (cause) {
        throw new Error(`${message}. Missing or inaccessible document ${document}.`, { cause });
      }
      const contents = preview
        ? readFileSync(file, "utf8")
        : git(root, ["cat-file", "blob", `${revision}:${document}`],
          `${message}. Document ${document} is unavailable in Piarre revision ${revision}.`).toString("utf8");
      documents.set(document, headings(contents));
    }
    const heading = `${"#".repeat(source.level)} ${source.heading}`;
    assert.equal(documents.get(document).get(heading), 1,
      `${message}. Expected exactly one exact heading "${heading}" in ${document}.`);
  }
}

export function validateHistoricalSources(codeRoot, principleInventory, retrievalFixture) {
  const hashes = new Map();
  const sources = [
    ...principleInventory.principles.filter(({ source }) => source.kind === "product").map(({ source }) => source),
    ...retrievalFixture.paths.map((path) => ({ revision: retrievalFixture.revision, path })),
  ];
  for (const { revision, path, sha256 } of sources) {
    assert.ok(revisionPattern.test(revision), `Historical Git source ${path} requires a full commit SHA.`);
    const object = `${revision}:${path}`;
    if (!hashes.has(object)) {
      const blob = git(codeRoot, ["cat-file", "blob", object],
        `Cannot read historical Git source ${object}. Fetch the original code repository history.`);
      hashes.set(object, createHash("sha256").update(blob).digest("hex"));
    }
    if (sha256 !== undefined) assert.equal(hashes.get(object), sha256, `Historical Git source hash mismatch for ${object}.`);
  }
  return hashes;
}
