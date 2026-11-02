import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { vscodeVersion } from "../config/vscode-version.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const scope = args.length === 0 ? "foundation" : args[0]?.replace(/^--scope=/, "");
assert.ok(args.length <= 1 && ["foundation", "candidate"].includes(scope), "Use --scope=foundation or --scope=candidate");
function git(...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, "Cannot bind acceptance evidence to a Git revision");
  return result.stdout.trim();
}
const revision = git("rev-parse", "HEAD");
const catalogText = readFileSync(path.join(root, "test/acceptance/catalog.json"), "utf8");
const catalog = JSON.parse(catalogText);
assert.equal(catalog.schemaVersion, 1);
const ids = new Set();
for (const scenario of catalog.scenarios) {
  assert.ok(/^[a-z][a-z0-9-]+$/.test(scenario.id) && !ids.has(scenario.id), "Duplicate or invalid scenario ID");
  ids.add(scenario.id);
  assert.ok(/^C0[1-8]$/.test(scenario.owner), "Missing owning issue package");
  assert.ok(["docs/01_PRODUCT_PRD.md", "docs/02_TECHNICAL_DESIGN.md"].includes(scenario.source.document));
  const document = readFileSync(path.join(root, scenario.source.document), "utf8");
  assert.ok(document.split("\n").includes(`## ${scenario.source.heading}`), `Missing requirement source for ${scenario.id}`);
  assert.ok(["automated", "pending"].includes(scenario.verification.kind));
  if (scenario.verification.kind === "automated") {
    assert.equal(scenario.verification.check, "host-tests");
    assert.ok(scenario.verification.tests.length > 0);
  }
}
const directory = path.join(root, ".artifacts", "acceptance", randomUUID());
mkdirSync(directory, { recursive: true });
const report = {
  scope, revision, catalogHash: createHash("sha256").update(catalogText).digest("hex"),
  node: process.version, platform: process.platform, arch: process.arch, vscode: vscodeVersion,
  recordedAt: new Date().toISOString(), checks: [], scenarios: [], productReady: false,
};
const clean = () => git("rev-parse", "HEAD") === revision && git("status", "--porcelain", "--untracked-files=all") === "";
const blocked = !clean() ? "Commit the working tree before collecting revision-bound acceptance evidence."
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
const stable = clean();
const checksPassed = report.checks.length === 2 && report.checks.every(({ status }) => status === "passed");
for (const scenario of catalog.scenarios) {
  const pending = scenario.verification.kind === "pending";
  let status = pending ? "not-tested" : "blocked";
  if (!pending && !blocked && stable) {
    const observed = scenario.verification.tests.every((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`[✓✔]\\s+${escaped}(?:\\s|$)`).test(hostOutput);
    });
    status = checksPassed && observed ? "passed" : "failed";
  }
  report.scenarios.push({ ...scenario, status });
}
if (blocked) report.blocker = blocked;
if (!stable) report.blocker = "Source changed during verification; evidence cannot establish acceptance.";
const selected = report.scenarios.filter(({ owner }) => scope === "candidate" || owner === "C01");
report.scopePassed = !report.blocker && selected.length > 0 && selected.every(({ status }) => status === "passed");
report.productReady = scope === "candidate" && report.scopePassed;
const reportPath = path.join(directory, "report.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
process.stdout.write(`Acceptance report: ${path.relative(root, reportPath)}\n`);
process.stdout.write(`Scope ${scope}: ${report.scopePassed ? "passed" : "not passed"}. Integrated product ready: ${String(report.productReady)}.\n`);
if (report.blocker) process.stdout.write(report.blocker + "\n");
process.exitCode = report.scopePassed ? 0 : 1;
