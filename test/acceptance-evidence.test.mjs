import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { observedHostTests, readExternalEvidence, sha256, supportedExecutionTests } from "../scripts/acceptance-evidence.mjs";

const identity = { sourceCommit: "a".repeat(40), bundleSha256: "b".repeat(64) };
function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "piarre-acceptance-evidence-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = "Observed supported execution result\n";
  writeFileSync(path.join(directory, "run.log"), log);
  const report = {
    schemaVersion: 1, ...identity, sourceDirty: false, platform: "darwin",
    command: ["node", "scripts/verify-supported-execution.mjs"], skips: [], errors: [],
    logPath: "run.log", logSha256: sha256(log),
    provider: { kind: "codex", authRoute: "chatgpt", model: "observed-model", threadId: "observed-thread", turnId: "observed-turn" },
    results: supportedExecutionTests.map(name => ({ name, status: "passed", skipped: false })),
  };
  const file = path.join(directory, "report.json");
  const read = () => { writeFileSync(file, JSON.stringify(report)); return readExternalEvidence(file, "supported-execution", identity); };
  return { directory, report, read };
}

test("acceptance observes exact successful host lines rather than skipped names or prose", () => {
  assert.deepEqual([...observedHostTests("  ✓ actual case (30ms)\n  - skipped case\nstdout says ✓ false case\n  ✔ another case\n")], ["actual case", "another case"]);
  assert.equal(observedHostTests("").size, 0);
});
test("external evidence binds named results, source, bundle, authentication and captured bytes", t => {
  const { read, report, directory } = fixture(t);
  assert.equal(read().passedTests.size, 3);
  for (const [key, value] of [["sourceCommit", "c".repeat(40)], ["bundleSha256", "d".repeat(64)], ["sourceDirty", true], ["platform", "linux"], ["results", []], ["skips", ["unobserved"]], ["errors", ["failed"]]]) {
    const before = report[key]; report[key] = value; assert.throws(read); report[key] = before;
  }
  report.results[0].skipped = true; assert.throws(read); report.results[0].skipped = false;
  report.results.push(report.results[0]); assert.throws(read); report.results.pop();
  report.provider.authRoute = "unknown"; assert.throws(read); report.provider.authRoute = "chatgpt";
  delete report.provider.turnId; assert.throws(read); report.provider.turnId = "observed-turn";
  writeFileSync(path.join(directory, "run.log"), "changed bytes"); assert.throws(read);
});
test("fixture execution cannot stand in for an unsupported authenticated execution", t => {
  const { report, read } = fixture(t);
  report.results[1].status = "unsupported"; report.results[2].status = "unsupported";
  delete report.provider;
  const evidence = read();
  assert.deepEqual([...evidence.passedTests], [supportedExecutionTests[0]]);
});
test("dirty implementation acceptance remains blocked and never claims product readiness", t => {
  const directory = mkdtempSync(path.join(tmpdir(), "piarre-acceptance-source-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const file of ["scripts/accept-candidate.mjs", "scripts/acceptance-evidence.mjs", "config/vscode-version.mjs", "test/acceptance/catalog.json", "test/acceptance/principles.json", "docs/01_PRODUCT_PRD.md", "docs/02_TECHNICAL_DESIGN.md"]) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    writeFileSync(path.join(directory, file), readFileSync(new URL(`../${file}`, import.meta.url)));
  }
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  git("init"); git("-c", "user.name=Acceptance fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-m", "Isolated acceptance fixture");
  const result = spawnSync(process.execPath, ["scripts/accept-candidate.mjs", "--scope=implementation"], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 1);
  const match = /Acceptance report: (.+)/.exec(result.stdout);
  assert.ok(match);
  const report = JSON.parse(readFileSync(path.join(directory, match[1]), "utf8"));
  assert.equal(report.scope, "implementation"); assert.equal(report.productReady, false);
  assert.equal(report.scopePassed, false); assert.match(report.blocker, /Commit the working tree/);
  assert.equal(report.checks.length, 0);
  assert.ok(report.scenarios.filter(scenario => scenario.owner !== "C08").every(scenario => scenario.status !== "passed"));
  assert.equal(report.scenarios.find(scenario => scenario.owner === "C08").status, "not-tested");
});

test("installed proof requires both repository identities, reopening and diagnostic stages", t => {
  const { report, directory } = fixture(t);
  report.command = ["node", "scripts/test-installed-candidate.mjs"];
  report.platform = "linux"; report.extensionId = "sysung.piarre-candidate";
  report.vsixSha256 = "c".repeat(64); report.stableSentinelPreserved = true;
  report.status = "passed"; report.skipped = false;
  report.results = ["counter", "piarre"].flatMap((repository, index) => {
    const common = {
      ...identity, vsixSha256: report.vsixSha256, extensionId: report.extensionId, platform: report.platform,
      projectId: `project-${index}`, repositoryUri: `file:///fixture/${repository}`, repositoryCommit: "d".repeat(40),
      revision: 2, proposalId: `proposal-${index}`, proposalGoalSha256: "e".repeat(64), diagnosticExportSha256: "f".repeat(64),
      status: "passed", skipped: false,
    };
    return [
      { ...common, name: `installed candidate ${repository} create`, diagnostics: ["capture", "synchronized-revisions", "redaction", "export", "explicit-deletion", "expiry", "export-preserved"] },
      { ...common, name: `installed candidate ${repository} reopen`, diagnostics: ["reopened-project", "export-preserved"] },
    ];
  });
  const file = path.join(directory, "installed.json");
  const read = () => { writeFileSync(file, JSON.stringify(report)); return readExternalEvidence(file, "installed-candidate", identity); };
  assert.equal(read().passedTests.size, 4);
  for (const [key, value] of [["command", ["node", "unrelated.mjs"]], ["status", "failed"], ["skipped", true], ["stableSentinelPreserved", false]]) {
    const before = report[key]; report[key] = value; assert.throws(read); report[key] = before;
  }
  report.results[0].skipped = true; assert.throws(read); report.results[0].skipped = false;
  const originalBundle = report.results[0].bundleSha256;
  report.results[0].bundleSha256 = "0".repeat(64); assert.throws(read); report.results[0].bundleSha256 = originalBundle;
  report.results[1].proposalId = "changed"; assert.throws(read); report.results[1].proposalId = report.results[0].proposalId;
  report.results[2].diagnostics = ["capture"]; assert.throws(read);
});
