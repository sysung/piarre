import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";

export const supportedExecutionTests = [
  "supported macOS containment and correction journey",
  "authenticated bounded Codex execution with current checks",
  "manual edit preserved after authenticated proposal",
];
export const installedCandidateTests = [
  "installed candidate counter create", "installed candidate counter reopen",
  "installed candidate piarre create", "installed candidate piarre reopen",
];
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function observedHostTests(output) {
  const names = new Set();
  for (const line of stripVTControlCharacters(output).split(/\r?\n/)) {
    const match = /^\s*[✓✔]\s+(.+?)(?: \(\d+ms\))?\s*$/.exec(line);
    if (match) names.add(match[1]);
  }
  return names;
}

export function readExternalEvidence(file, kind, identity) {
  const bytes = readFileSync(file);
  const report = JSON.parse(bytes);
  assert.equal(report.schemaVersion, 1, "Unsupported external evidence schema");
  assert.equal(report.sourceCommit, identity.sourceCommit, "External evidence source commit differs");
  assert.equal(report.sourceDirty, false, "External evidence was collected from dirty source");
  assert.equal(report.bundleSha256, identity.bundleSha256, "External evidence bundle differs");
  assert.match(report.bundleSha256, /^[a-f0-9]{64}$/);
  assert.ok(Array.isArray(report.results) && report.results.length > 0, "External evidence has no named results");
  assert.ok(Array.isArray(report.skips) && report.skips.length === 0, "External evidence has skips");
  assert.ok(Array.isArray(report.errors) && report.errors.length === 0, "External evidence has errors");
  assert.ok(typeof report.logPath === "string" && report.logPath.length > 0 && !path.isAbsolute(report.logPath), "External evidence needs a relative captured log path");
  assert.match(report.logSha256, /^[a-f0-9]{64}$/);
  const log = readFileSync(path.resolve(path.dirname(file), report.logPath));
  assert.ok(log.length > 0, "External evidence captured log is empty");
  assert.equal(sha256(log), report.logSha256, "External evidence captured log changed");
  const results = new Map();
  for (const result of report.results) {
    assert.ok(typeof result.name === "string" && result.name.trim() && !results.has(result.name), "Duplicate or missing external result name");
    assert.ok(["passed", "failed", "unsupported"].includes(result.status), "Invalid external result status");
    assert.equal(result.skipped, false, "External result must explicitly declare it was not skipped");
    results.set(result.name, result);
  }
  if (kind === "supported-execution") {
    assert.equal(report.platform, "darwin", "Supported execution needs the supported macOS runtime");
    assert.deepEqual(report.command, ["node", "scripts/verify-supported-execution.mjs"]);
    for (const name of supportedExecutionTests) assert.ok(results.has(name), `Missing external result: ${name}`);
    if (supportedExecutionTests.slice(1).some(name => results.get(name).status === "passed")) {
      assert.equal(report.provider?.kind, "codex");
      assert.ok(["chatgpt", "apiKey"].includes(report.provider.authRoute), "Live evidence needs an observed authentication route");
      for (const field of ["model", "threadId", "turnId"]) assert.ok(typeof report.provider[field] === "string" && report.provider[field].trim(), `Missing observed provider ${field}`);
    }
  } else {
    assert.equal(kind, "installed-candidate");
    assert.equal(report.extensionId, "sysung.piarre-candidate");
    assert.equal(report.status, "passed");
    assert.equal(report.skipped, false);
    assert.ok(["linux", "darwin", "win32"].includes(report.platform));
    assert.ok(Array.isArray(report.command) && report.command[0] === "node" && report.command[1] === "scripts/test-installed-candidate.mjs");
    assert.match(report.vsixSha256, /^[a-f0-9]{64}$/);
    assert.equal(report.stableSentinelPreserved, true);
    for (const name of installedCandidateTests) {
      const result = results.get(name);
      assert.ok(result, `Missing installed journey: ${name}`);
      for (const field of ["sourceCommit", "bundleSha256", "vsixSha256", "extensionId", "platform"]) assert.equal(result[field], report[field], `Installed journey ${field} differs`);
      for (const field of ["projectId", "repositoryUri", "repositoryCommit", "proposalId", "proposalGoalSha256", "diagnosticExportSha256"]) assert.ok(typeof result[field] === "string" && result[field].length > 0, `Missing installed journey ${field}`);
      assert.match(result.repositoryCommit, /^[a-f0-9]{40}$/);
      for (const field of ["proposalGoalSha256", "diagnosticExportSha256"]) assert.match(result[field], /^[a-f0-9]{64}$/);
      assert.ok(Number.isSafeInteger(result.revision) && result.revision > 0);
      assert.ok(Array.isArray(result.diagnostics));
    }
    const [counter, counterReopen, piarre, piarreReopen] = installedCandidateTests.map(name => results.get(name));
    assert.notEqual(counter.projectId, piarre.projectId, "Repository projects must stay separate");
    assert.notEqual(counter.repositoryUri, piarre.repositoryUri);
    for (const [created, reopened] of [[counter, counterReopen], [piarre, piarreReopen]]) {
      for (const field of ["projectId", "repositoryUri", "repositoryCommit", "revision", "proposalId", "proposalGoalSha256", "diagnosticExportSha256"]) assert.equal(reopened[field], created[field], `Reopened journey lost ${field}`);
      for (const stage of ["capture", "synchronized-revisions", "redaction", "export", "explicit-deletion", "expiry", "export-preserved"]) assert.ok(created.diagnostics.includes(stage), `Missing diagnostic stage: ${stage}`);
      assert.ok(reopened.diagnostics.includes("reopened-project"));
    }
  }
  return { file, sha256: sha256(bytes), report, results, passedTests: new Set([...results.values()].filter(result => result.status === "passed").map(result => result.name)) };
}
