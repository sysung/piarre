import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveDocumentation, validateCatalogSources, validateHistoricalSources } from "../scripts/documentation-sources.mjs";

const sourceDocument = "openspec/specs/acceptance/spec.md";
const source = { document: sourceDocument, heading: "Requirement: inspect-project", level: 3 };
const catalog = { schemaVersion: 1, scenarios: [{ id: "inspect-project", source }] };
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "piarre-docs-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const checkout = path.join(root, "piarre");
  mkdirSync(path.join(checkout, path.dirname(sourceDocument)), { recursive: true });
  git(checkout, "init", "--quiet");
  git(checkout, "config", "user.email", "fixture@example.com");
  git(checkout, "config", "user.name", "Documentation fixture");
  const spec = path.join(checkout, sourceDocument);
  writeFileSync(spec, "# Acceptance\n\n### Requirement: inspect-project\n\nProject inspection.\n");
  git(checkout, "add", ".");
  git(checkout, "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Pin acceptance specification");
  const revision = git(checkout, "rev-parse", "HEAD");
  return { codeRoot: checkout, checkout, revision, root, spec };
}

test("a clean Piarre checkout resolves its committed documentation without a lock", (t) => {
  const { codeRoot, revision } = fixture(t);
  const resolved = resolveDocumentation(codeRoot);
  assert.equal(resolved.revision, revision);
  assert.equal(resolved.preview, false);
  assert.doesNotThrow(() => validateCatalogSources(catalog, resolved));
});

test("a child directory or another non-repository directory is rejected", (t) => {
  const { codeRoot, root } = fixture(t);
  assert.throws(() => resolveDocumentation(root), /inaccessible or not a Git working tree/);
  assert.throws(() => resolveDocumentation(path.join(codeRoot, "openspec")), /repository root/);
});

test("an unreadable Git directory makes the checkout inaccessible", { skip: process.getuid?.() === 0 }, (t) => {
  const { codeRoot } = fixture(t);
  const gitDirectory = path.join(codeRoot, ".git");
  chmodSync(gitDirectory, 0o000);
  try {
    assert.throws(() => resolveDocumentation(codeRoot), /inaccessible or not a Git working tree/);
  } finally {
    chmodSync(gitDirectory, 0o700);
  }
});

test("the specified evidence revision must be available", (t) => {
  const { codeRoot } = fixture(t);
  assert.throws(() => resolveDocumentation(codeRoot, { revision: "b".repeat(40) }), /revision.*unavailable/);
});

test("rechecking the original evidence revision fails after HEAD changes", (t) => {
  const { codeRoot, revision } = fixture(t);
  git(codeRoot, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "New revision");
  assert.throws(() => resolveDocumentation(codeRoot, { revision }), /revision changed/);
});

test("tracked and untracked changes require explicit unverified preview", (t) => {
  const { codeRoot, checkout, spec } = fixture(t);
  writeFileSync(spec, "# Changed\n");
  assert.throws(() => resolveDocumentation(codeRoot), /dirty/);
  assert.equal(resolveDocumentation(codeRoot, { preview: true }).preview, true);
  git(checkout, "restore", ".");
  writeFileSync(path.join(checkout, "untracked.md"), "# Draft\n");
  assert.throws(() => resolveDocumentation(codeRoot), /dirty/);
});

test("catalog references resolve exactly in the pinned documents", (t) => {
  const { codeRoot, spec } = fixture(t);
  const documentation = resolveDocumentation(codeRoot);
  assert.doesNotThrow(() => validateCatalogSources(catalog, documentation));
  writeFileSync(spec, "# Acceptance\n\n### Requirement: inspect-project-detail\n\n```md\n### Requirement: inspect-project\n```\n");
  const preview = resolveDocumentation(codeRoot, { preview: true });
  assert.throws(() => validateCatalogSources(catalog, preview), /inspect-project.*exact heading/);
});

test("a missing or unreadable document identifies its scenario and source", (t) => {
  const { codeRoot, spec } = fixture(t);
  if (process.getuid?.() !== 0) {
    const strict = resolveDocumentation(codeRoot);
    chmodSync(spec, 0o000);
    assert.throws(() => validateCatalogSources(catalog, strict), /inspect-project.*inaccessible document/);
    chmodSync(spec, 0o600);
  }
  rmSync(spec);
  const preview = resolveDocumentation(codeRoot, { preview: true });
  assert.throws(() => validateCatalogSources(catalog, preview), /inspect-project.*Missing or inaccessible document/);
});

test("an existing but unrelated heading is rejected for this scenario", (t) => {
  const { codeRoot } = fixture(t);
  assert.throws(() => validateCatalogSources({
    ...catalog, scenarios: [{ id: "review-project", source }],
  }, resolveDocumentation(codeRoot)), /review-project.*heading identity/);
});

test("catalog paths reject traversal and symlink escapes", (t) => {
  const { codeRoot, checkout, root } = fixture(t);
  writeFileSync(path.join(root, "outside.md"), "### Requirement: inspect-project\n");
  const symlink = "openspec/specs/acceptance/outside.md";
  symlinkSync(path.join(root, "outside.md"), path.join(checkout, symlink));
  const documentation = resolveDocumentation(codeRoot, { preview: true });
  for (const document of ["../outside.md", path.join(root, "outside.md"), symlink]) {
    assert.throws(() => validateCatalogSources({
      ...catalog, scenarios: [{ id: "inspect-project", source: { ...source, document } }],
    }, documentation), /inspect-project.*outside|inspect-project.*scoped/);
  }
});

test("an unavailable historical Git object fails with its original path and revision", (t) => {
  const { checkout, revision } = fixture(t);
  assert.throws(() => validateHistoricalSources(checkout, { principles: [] }, {
    revision, paths: ["docs/old-prd.md"],
  }), new RegExp(`historical Git source ${revision}:docs/old-prd.md.*code repository history`));
});


test("an existing historical source must match its recorded hash", (t) => {
  const { checkout, revision } = fixture(t);
  const principleInventory = {
    principles: [{ source: { kind: "product", path: sourceDocument, revision, sha256: "b".repeat(64) } }],
  };
  assert.throws(() => validateHistoricalSources(checkout, principleInventory, { revision, paths: [] }), /Historical Git source hash mismatch/);
});


test("acceptance blocks a report if a documentation source becomes inaccessible during collection", { skip: process.getuid?.() === 0 }, (t) => {
  const { codeRoot, spec } = fixture(t);
  for (const file of ["scripts/accept-candidate.mjs", "scripts/documentation-sources.mjs", "config/vscode-version.mjs"]) {
    mkdirSync(path.dirname(path.join(codeRoot, file)), { recursive: true });
    copyFileSync(new URL(`../${file}`, import.meta.url), path.join(codeRoot, file));
  }
  const acceptance = path.join(codeRoot, "test/acceptance");
  mkdirSync(acceptance, { recursive: true });
  writeFileSync(path.join(acceptance, "catalog.json"), JSON.stringify({
    schemaVersion: 1,
    scenarios: [{
      id: "inspect-project",
      source,
      owner: "C01",
      verification: { kind: "automated", check: "host-tests", tests: ["Inspect project"] },
    }],
  }));
  writeFileSync(path.join(acceptance, "principles.json"), JSON.stringify({ schemaVersion: 1, principles: [] }));
  writeFileSync(path.join(acceptance, "retrieval-fixture.json"), JSON.stringify({ paths: [] }));
  writeFileSync(path.join(codeRoot, ".gitignore"), ".artifacts/\n");
  writeFileSync(path.join(codeRoot, "package.json"), JSON.stringify({
    scripts: { check: "node make-source-inaccessible.mjs", test: "node report-host-test.mjs" },
  }));
  writeFileSync(path.join(codeRoot, "make-source-inaccessible.mjs"),
    `import { chmodSync } from "node:fs"; chmodSync(${JSON.stringify(sourceDocument)}, 0o000);\n`);
  writeFileSync(path.join(codeRoot, "report-host-test.mjs"), 'console.log("✓ Inspect project");\n');
  git(codeRoot, "add", ".");
  git(codeRoot, "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Prepare acceptance fixture");

  git(codeRoot, "update-index", "--skip-worktree", sourceDocument);
  const result = spawnSync(process.execPath, ["scripts/accept-candidate.mjs"], { cwd: codeRoot, encoding: "utf8" });
  chmodSync(spec, 0o600);
  const reportPath = /^Acceptance report: (.+)$/m.exec(result.stdout)?.[1];
  assert.ok(reportPath, result.stderr);
  const report = JSON.parse(readFileSync(path.join(codeRoot, reportPath), "utf8"));
  assert.equal(report.revision, git(codeRoot, "rev-parse", "HEAD"));
  assert.equal(report.mode, "pinned");
  assert.deepEqual(report.checks.map(({ status }) => status), ["passed", "passed"]);
  assert.equal(result.status, 1);
  assert.match(report.blocker, /changed or became inaccessible.*inspect-project/);
  assert.equal(report.scenarios[0].status, "blocked");
  assert.equal(report.scopePassed, false);
});
