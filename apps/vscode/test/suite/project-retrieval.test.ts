import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectRetrieval, lookupProjectSources, type RetrievalRecord } from "../../src/project-retrieval.js";

suite("Grounded project retrieval", () => {
  let root: string;
  let records: RetrievalRecord[];
  let index: ProjectRetrieval;
  setup(() => {
    root = mkdtempSync(path.join(tmpdir(), "piarre-retrieval-"));
    writeFileSync(path.join(root, "refund.ts"), "export const refundWindowDays = 45;\n// Refunds must not expire early.\n");
    writeFileSync(path.join(root, "decisions.md"), "# Refund decision\nKeep a 45 day refund window because settlement takes time.\n");
    records = [{ projectId: "project-a", recordId: "refund-policy", revision: 7, text: "Refund window is 45 days.", category: "business", standing: "confirmed" }];
    index = new ProjectRetrieval({ projectId: "project-a", root, readRecords: () => records });
    index.rebuild();
  });
  teardown(() => { index.dispose(); rmSync(root, { recursive: true, force: true }); });
  const search = (query: string) => index.search({ projectId: "project-a", query });

  test("literal lookup returns exact file lines, project identity and full-file content hash", () => {
    const result = search("refundWindowDays");
    assert.equal(result.kind, "matched");
    const hit = result.hits[0]; assert.ok(hit);
    assert.equal(hit.projectId, "project-a"); assert.equal(hit.method, "exact");
    assert.deepEqual(hit.source, { kind: "file", path: "refund.ts", startLine: 1, endLine: 3 });
    assert.equal(hit.text, readFileSync(path.join(root, "refund.ts"), "utf8"));
    assert.equal(hit.contentHash, createHash("sha256").update(hit.text).digest("hex"));
  });

  test("FTS finds reordered terms and preserves confirmed record identity without generating answers", () => {
    const result = search("days window Refund");
    assert.equal(result.kind, "matched");
    const hit = result.hits.find(item => item.source.kind === "record"); assert.ok(hit);
    assert.equal(hit.method, "fts5");
    assert.deepEqual(hit.source, { kind: "record", recordId: "refund-policy", revision: 7, category: "business", standing: "confirmed" });
    assert.equal(hit.text, records[0]?.text);
    assert.match(result.coverage.limitation, /no semantic understanding/);
  });

  test("file and directory permission-only changes invalidate the bounded index", () => {
    chmodSync(path.join(root, "refund.ts"), 0o600);
    assert.equal(search("refundWindowDays").kind, "stale");
    index.rebuild();
    chmodSync(root, 0o755);
    assert.equal(search("refundWindowDays").kind, "stale");
  });

  test("unsupported encodings cannot masquerade as exact source bytes", () => {
    writeFileSync(path.join(root, "invalid.ts"), Buffer.from([0xff, 0xfe]));
    const coverage = index.rebuild();
    assert.ok(coverage.issues.some(issue => issue.includes("invalid.ts")));
    assert.equal(search("�").kind, "no-match");
  });

  test("no matching source is distinct from invalid query and wrong project", () => {
    assert.equal(search("unrecorded frobnication").kind, "no-match");
    assert.equal(search(" ").kind, "error");
    const wrong = index.search({ projectId: "project-b", query: "refund" });
    assert.equal(wrong.kind, "error"); assert.deepEqual(wrong.hits, []);
    assert.equal(index.search({ projectId: "project-a", query: '" OR *; DELETE', limit: 99 }).kind, "error");
    assert.equal(search('" OR *; DELETE').kind, "no-match");
  });

  test("same-length uncommitted edit invalidates old and new queries until rebuild", () => {
    const file = path.join(root, "refund.ts");
    const before = readFileSync(file, "utf8");
    writeFileSync(file, before.replace("45", "60"));
    assert.equal(search("refundWindowDays").kind, "stale");
    assert.equal(search("60").kind, "stale");
    index.rebuild();
    assert.equal(search("refundWindowDays").kind, "matched");
    const result = search("60"); assert.equal(result.kind, "matched");
    assert.ok(result.hits.some(hit => hit.text.includes("60")));
  });

  test("content hash recheck catches an edit even if file metadata is restored", () => {
    const file = path.join(root, "refund.ts");
    const stamp = new Date(1_700_000_000_000);
    utimesSync(file, stamp, stamp); index.rebuild();
    writeFileSync(file, readFileSync(file, "utf8").replace("45", "60"));
    utimesSync(file, stamp, stamp);
    assert.equal(search("refundWindowDays").kind, "stale");
  });

  test("rename, delete and new files invalidate inventory before no-match can hide changes", () => {
    renameSync(path.join(root, "refund.ts"), path.join(root, "settlement.ts"));
    assert.equal(search("anything absent").kind, "stale");
    index.rebuild();
    assert.ok(search("refundWindowDays").hits.some(hit => hit.source.kind === "file" && hit.source.path === "settlement.ts"));
    unlinkSync(path.join(root, "settlement.ts"));
    assert.equal(search("refundWindowDays").kind, "stale");
    index.rebuild();
    assert.equal(search("refundWindowDays").kind, "no-match");
    writeFileSync(path.join(root, "new.ts"), "newlyAddedIdentifier");
    assert.equal(search("newlyAddedIdentifier").kind, "stale");
    index.rebuild(); assert.equal(search("newlyAddedIdentifier").kind, "matched");
  });

  test("corrected, removed or cross-project authoritative records cannot reuse old knowledge", () => {
    records = [{ projectId: "project-a", recordId: "refund-policy", revision: 8, text: "Refund window is 60 days.", category: "business", standing: "confirmed" }];
    assert.equal(search("refund").kind, "stale");
    index.rebuild();
    const updated = search("60"); assert.equal(updated.kind, "matched");
    assert.ok(updated.hits.some(hit => hit.source.kind === "record" && hit.source.revision === 8));
    records = []; assert.equal(search("refund").kind, "stale");
    index.rebuild();
    records = [{ projectId: "project-b", recordId: "foreign", revision: 1, text: "Foreign private content", category: "decision", standing: "confirmed" }];
    assert.equal(search("Foreign").kind, "error");
    assert.throws(() => index.rebuild(), /Invalid or duplicate authoritative record/);
    assert.equal(search("Foreign").kind, "error");
  });

  test("hidden, secret-named, generated and symbolic-link sources do not enter lookup", () => {
    for (const directory of [".piarre", ".git", "node_modules", "dist"]) {
      mkdirSync(path.join(root, directory)); writeFileSync(path.join(root, directory, "private.md"), "privateMarker");
    }
    writeFileSync(path.join(root, ".env"), "privateMarker");
    writeFileSync(path.join(root, "credentials.json"), "privateMarker");
    symlinkSync(path.join(root, "decisions.md"), path.join(root, "linked.md"));
    const coverage = index.rebuild();
    assert.equal(coverage.files, 2);
    assert.ok(coverage.issues.some(issue => issue.includes("symbolic link")));
    assert.equal(search("privateMarker").kind, "no-match");
  });

  test("unsupported language and conflicted sources remain visible as incomplete coverage", () => {
    writeFileSync(path.join(root, "logic.rb"), "unsupportedRubyBehavior");
    writeFileSync(path.join(root, "conflict.ts"), "<<<<<<< HEAD\nconflictedMarker\n=======\nother\n>>>>>>> branch\n");
    const coverage = index.rebuild();
    assert.ok(coverage.issues.some(issue => issue.includes("Unsupported source: logic.rb")));
    assert.ok(coverage.issues.some(issue => issue.includes("conflicted")));
    assert.equal(search("unsupportedPythonBehavior").kind, "no-match");
    assert.equal(search("conflictedMarker").kind, "no-match");
    assert.equal(coverage.files, 2);
  });

  test("a source replaced by a symlink cannot return previously indexed content", () => {
    unlinkSync(path.join(root, "refund.ts"));
    symlinkSync(path.join(root, "decisions.md"), path.join(root, "refund.ts"));
    const result = search("refundWindowDays"); assert.equal(result.kind, "stale"); assert.deepEqual(result.hits, []);
  });

  test("contradictory records remain separate sourced results without being silently resolved", () => {
    records.push({ projectId: "project-a", recordId: "refund-dispute", revision: 9, text: "Refund window is 60 days.", category: "business", standing: "observed" });
    index.rebuild();
    const result = search("Refund window"); assert.equal(result.kind, "matched");
    const claims = result.hits.filter(hit => hit.source.kind === "record");
    assert.equal(claims.length, 2);
    assert.ok(claims.some(hit => hit.source.kind === "record" && hit.source.standing === "observed" && hit.text.includes("60")));
    assert.ok(claims.some(hit => hit.source.kind === "record" && hit.source.standing === "confirmed" && hit.text.includes("45")));
  });

  test("authoritative record access failure returns an error without partial file hits", () => {
    let unavailable = false;
    const guarded = new ProjectRetrieval({ projectId: "project-a", root, readRecords: () => {
      if (unavailable) throw new Error("Authority unavailable");
      return records;
    } });
    try {
      guarded.rebuild(); unavailable = true;
      const result = guarded.search({ projectId: "project-a", query: "refund" });
      assert.equal(result.kind, "error"); assert.deepEqual(result.hits, []);
    } finally { guarded.dispose(); }
  });

  test("disposal is idempotent and makes lookup unavailable", () => {
    index.dispose(); index.dispose();
    assert.equal(search("refund").kind, "error");
    assert.throws(() => index.rebuild(), /closed/);
  });
  test("a failed new lookup replaces old context with an explicit empty error", () => {
    const result = lookupProjectSources({ projectId: "project", root: "/piarre-definitely-missing-root", query: "refund" });
    assert.equal(result.kind, "error");
    assert.deepEqual(result.hits, []);
    assert.match(result.coverage.issues.join(" "), /earlier results cannot be reused/);
  });

});
