import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { vscodeVersion } from "../config/vscode-version.mjs";
import { resolveDocumentation, validateCatalogSources, validateHistoricalSources } from "./documentation-sources.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const preview = args.includes("--preview");
const scopes = args.filter((arg) => arg !== "--preview");
const scope = scopes.length === 0 ? "foundation" : scopes[0].replace(/^--scope=/, "");
assert.ok(args.length <= scopes.length + 1 && scopes.length <= 1 && ["foundation", "candidate"].includes(scope),
  "Use --scope=foundation or --scope=candidate, optionally with --preview.");
const documentation = resolveDocumentation(root, { preview });
const { revision } = documentation;
const catalogText = readFileSync(path.join(root, "test/acceptance/catalog.json"), "utf8");
const catalog = JSON.parse(catalogText);
const principleText = readFileSync(path.join(root, "test/acceptance/principles.json"), "utf8");
const principleInventory = JSON.parse(principleText);
validateCatalogSources(catalog, documentation);
const retrievalFixture = JSON.parse(readFileSync(path.join(root, "test/acceptance/retrieval-fixture.json"), "utf8"));
validateHistoricalSources(root, principleInventory, retrievalFixture);
const ids = new Set();
for (const scenario of catalog.scenarios) {
  assert.ok(/^[a-z][a-z0-9-]+$/.test(scenario.id) && !ids.has(scenario.id), "Duplicate or invalid scenario ID");
  ids.add(scenario.id);
  assert.ok(/^C0[1-8]$/.test(scenario.owner), "Missing owning issue package");
  assert.ok(["automated", "pending"].includes(scenario.verification.kind));
  if (scenario.verification.kind === "automated") {
    assert.equal(scenario.verification.check, "host-tests");
    assert.ok(scenario.verification.tests.length > 0);
  }
}
assert.equal(principleInventory.schemaVersion, 1);
const principleIds = new Set();
for (const principle of principleInventory.principles) {
  assert.ok(typeof principle.id === "string" && !principleIds.has(principle.id), "Duplicate or missing principle identity");
  principleIds.add(principle.id);
  assert.ok(typeof principle.behavior === "string" && principle.behavior.trim());
  assert.ok(/^[a-f0-9]{64}$/.test(principle.source.sha256), "Principle source must have an exact content version");
  assert.ok(principle.scenarios.length > 0 && principle.scenarios.every((id) => ids.has(id)), "Principle must link existing acceptance scenarios");
}
const directory = path.join(root, ".artifacts", "acceptance", randomUUID());
mkdirSync(directory, { recursive: true });
const report = {
  scope, revision, mode: preview ? "preview" : "pinned",
  catalogHash: createHash("sha256").update(catalogText).digest("hex"),
  principleInventoryHash: createHash("sha256").update(principleText).digest("hex"),
  node: process.version, platform: process.platform, arch: process.arch, vscode: vscodeVersion,
  recordedAt: new Date().toISOString(), checks: [], scenarios: [], productReady: false,
};
const blocked = preview ? "Documentation preview is unverified."
  : scope === "candidate" && catalog.scenarios.some(({ verification }) => verification.kind === "pending")
    ? "The integrated candidate has unimplemented or unverified requirements. Foundation checks cannot satisfy them."
    : undefined;
let hostOutput = "";
if (!blocked) {
  for (const [id, argv] of [["static-checks", ["run", "check"]], ["host-tests", ["test"]]]) {
    const result = spawnSync("npm", argv, { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    const log = path.join(directory, `${id}.log`);
    writeFileSync(log, (result.stdout ?? "") + (result.stderr ?? ""));
    report.checks.push({ id, command: ["npm", ...argv], status: result.status === 0 ? "passed" : "failed", exitCode: result.status, log: path.relative(root, log) });
    if (id === "host-tests") hostOutput = stripVTControlCharacters(result.stdout ?? "");
    if (result.status !== 0) break;
  }
}
let stabilityBlocker;
if (!preview) {
  try {
    validateCatalogSources(catalog, resolveDocumentation(root, { revision }));
  } catch (error) {
    stabilityBlocker = `Code or documentation changed or became inaccessible during verification. ${error.message}`;
  }
}
const checksPassed = report.checks.length === 2 && report.checks.every(({ status }) => status === "passed");
for (const scenario of catalog.scenarios) {
  const pending = scenario.verification.kind === "pending";
  let status = preview ? "unverified" : pending ? "not-tested" : "blocked";
  if (!pending && !blocked && !stabilityBlocker) {
    const observed = scenario.verification.tests.every((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`[✓✔]\\s+${escaped}(?:\\s|$)`).test(hostOutput);
    });
    status = checksPassed && observed ? "passed" : "failed";
  }
  report.scenarios.push({ ...scenario, status });
}
report.principles = principleInventory.principles.map((principle) => ({
  ...principle,
  coverage: principle.scenarios.map((id) => {
    const scenario = report.scenarios.find((item) => item.id === id);
    return { id, owner: scenario.owner, status: scenario.status };
  }),
}));
if (blocked) report.blocker = blocked;
if (stabilityBlocker) report.blocker = stabilityBlocker;
const selected = report.scenarios.filter(({ owner }) => scope === "candidate" || owner === "C01");
report.scopePassed = !report.blocker && selected.length > 0 && selected.every(({ status }) => status === "passed");
report.productReady = scope === "candidate" && report.scopePassed;
const reportPath = path.join(directory, "report.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(`Acceptance report: ${path.relative(root, reportPath)}\n`);
process.stdout.write(`Scope ${scope}: ${report.scopePassed ? "passed" : "not passed"}. Integrated product ready: ${String(report.productReady)}.\n`);
if (report.blocker) process.stdout.write(report.blocker + "\n");
process.exitCode = report.scopePassed ? 0 : 1;
