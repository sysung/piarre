import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir, cpus, platform, release } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const root = resolve(import.meta.dirname, "..");
const fixture = JSON.parse(readFileSync(join(root, "test/acceptance/retrieval-fixture.json"), "utf8"));
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const sources = fixture.paths.map((path) => {
  const text = execFileSync("git", ["show", `${fixture.revision}:${path}`], { cwd: root, encoding: "utf8" });
  return { id: path, path, text, revision: fixture.revision, hash: sha256(text), state: "static-source", confirmation: "unconfirmed", extraction: "git-blob" };
});
const chunks = sources.flatMap((source) => {
  const lines = source.text.split("\n");
  return lines.flatMap((_, index) => index % 12 ? [] : [{ ...source, id: `${source.id}#L${index + 1}`, start: index + 1,
    end: Math.min(index + 12, lines.length), text: lines.slice(index, index + 12).join("\n") }]);
});
for (const question of fixture.questions) for (const expected of question.expected) {
  assert.ok(sources.some((source) => source.path === expected.path && source.text.includes(expected.contains)), `Invalid fixture oracle ${question.id}`);
}
const scratch = mkdtempSync(join(tmpdir(), "piarre-retrieval-"));
const methods = ["exact", "fts5", "fts5-relations", "compiler"];
const runs = [];
const stopwords = new Set(["a", "an", "the", "is", "are", "of", "for", "to", "and", "does", "how", "which", "what", "in"]);
const terms = (query) => query.match(/[A-Za-z0-9_]+/g)?.filter((word) => !stopwords.has(word.toLowerCase())) ?? [];
const evidence = (chunk) => ({ sourceId: chunk.path, location: `${chunk.start}-${chunk.end}`, revision: chunk.revision,
  contentHash: chunk.hash, excerptHash: sha256(chunk.text), extraction: chunk.extraction, state: chunk.state, confirmation: chunk.confirmation, text: chunk.text });
let report;
try {
  for (const source of sources) {
    const path = join(scratch, source.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source.text);
  }
  for (let repetition = 0; repetition < 5; repetition++) {
    const order = repetition % 2 ? [...methods].reverse() : methods;
    for (const method of order) {
      const start = performance.now();
      const cpuStart = process.cpuUsage();
      const db = method.startsWith("fts5") ? new DatabaseSync(":memory:") : undefined;
      db?.exec("CREATE VIRTUAL TABLE lookup USING fts5(id UNINDEXED, text, tokenize='unicode61')");
      const insert = db?.prepare("INSERT INTO lookup(id,text) VALUES (?,?)");
      if (method.startsWith("fts5")) {
        db.exec("BEGIN");
        for (const chunk of chunks) insert.run(chunk.id, chunk.text);
        db.exec("COMMIT");
      }
      const program = method === "compiler" || method === "fts5-relations"
        ? ts.createProgram(sources.filter((source) => source.path.endsWith(".ts")).map((source) => join(scratch, source.path)),
          { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, noLib: true }) : undefined;
      const checker = method === "compiler" ? program.getTypeChecker() : undefined;
      const edges = [];
      const symbols = [];
      const coverageGaps = [];
      if (program) for (const source of sources.filter((item) => item.path.endsWith(".ts"))) {
        const ast = program.getSourceFile(join(scratch, source.path));
        const visit = (node) => {
          if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            const target = ts.resolveModuleName(node.moduleSpecifier.text, ast.fileName, program.getCompilerOptions(), ts.sys).resolvedModule;
            const targetPath = target && relative(scratch, target.resolvedFileName).replaceAll("\\", "/");
            if (!sources.some((item) => item.path === targetPath)) coverageGaps.push({ sourceId: source.path, specifier: node.moduleSpecifier.text, status: "unresolved-or-outside-corpus" });
            if (sources.some((item) => item.path === targetPath)) edges.push({ from: source.path, to: targetPath,
              sourceId: source.path, location: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
              revision: source.revision, contentHash: source.hash, extraction: "typescript-resolved-module", state: "static-source", confirmation: "unconfirmed" });
          }
          if (method === "compiler" && ts.isIdentifier(node)) {
            let symbol = checker.getSymbolAtLocation(node);
            if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
            for (const declaration of symbol?.declarations ?? []) {
              const targetPath = relative(scratch, declaration.getSourceFile().fileName).replaceAll("\\", "/");
              if (!sources.some((item) => item.path === targetPath)) continue;
              symbols.push({ revision: source.revision, contentHash: source.hash, extraction: "typescript-type-checker", state: "static-source", confirmation: "unconfirmed", name: node.text, source: source.path, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
                target: targetPath, declarationLine: declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.getStart(declaration.getSourceFile())).line + 1 });
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(ast);
      }
      const indexMs = performance.now() - start;
      const indexCpuMicros = process.cpuUsage(cpuStart);
      const results = [];
      for (const question of fixture.questions) {
        const queryStart = performance.now();
        let found = [];
        if (method === "exact") found = chunks.filter((chunk) => chunk.text.includes(question.query));
        else if (method === "compiler" && question.symbol) {
          const matches = symbols.filter((symbol) => symbol.name === question.symbol);
          const locations = matches.flatMap((symbol) => [{ path: symbol.target, line: symbol.declarationLine }, { path: symbol.source, line: symbol.line }]);
          found = locations.flatMap((location) => chunks.filter((chunk) => chunk.path === location.path && chunk.start <= location.line && chunk.end >= location.line));
        } else if (db) {
          const query = terms(question.query).map((word) => `"${word}"`).join(" AND ");
          if (query) found = db.prepare("SELECT id FROM lookup WHERE lookup MATCH ? ORDER BY bm25(lookup), id LIMIT 5").all(query)
            .map((row) => chunks.find((chunk) => chunk.id === row.id));
        }
        let usedEdges = [];
        if (method === "fts5-relations" && question.kind === "impact") {
          const targets = new Set(found.map((chunk) => chunk.path));
          usedEdges = edges.filter((edge) => targets.has(edge.to));
          const related = usedEdges.flatMap((edge) => chunks.filter((chunk) => chunk.path === edge.from && chunk.start <= edge.location && chunk.end >= edge.location));
          found = [...related, ...found];
        }
        found = [...new Map(found.map((chunk) => [chunk.id, chunk])).values()].slice(0, 5);
        const supported = question.expected.filter((expected) => found.some((chunk) => chunk.path === expected.path && chunk.text.includes(expected.contains))).length;
        results.push({ id: question.id, queryMs: performance.now() - queryStart, expected: question.expected.length,
          supported, unsupportedCandidates: question.expected.length === 0 && found.length > 0,
          evidence: found.map(evidence), relationships: usedEdges, resolvedReferences: question.symbol ? symbols.filter((symbol) => symbol.name === question.symbol) : [] });
      }
      runs.push({ method, repetition, indexMs, indexCpuMicros, sqliteBytes: db ? Number(db.prepare("PRAGMA page_count").get().page_count) * Number(db.prepare("PRAGMA page_size").get().page_size) : 0,
        edgeCount: edges.length, symbolOccurrences: symbols.length, coverageGaps, results });
      db?.close();
    }
  }
  const original = sources.find((source) => source.path === fixture.freshness.path);
  const snapshots = {
    "uncommitted-edit": sources.map((source) => source === original ? { ...source, text: source.text.replaceAll(fixture.freshness.old, fixture.freshness.replacement) } : source),
    rename: sources.map((source) => source === original ? { ...source, path: fixture.freshness.renameTo } : source),
    deletion: sources.filter((source) => source !== original),
    correction: sources.map((source) => source.path === "docs/01_PRODUCT_PRD.md" ? { ...source,
      text: source.text.replace(fixture.freshness.oldDecision, fixture.freshness.newDecision) } : source),
    conflict: sources.map((source) => source === original ? { ...source, text: `<<<<<<< HEAD\n${source.text}\n=======\ncontradictory proposal\n>>>>>>> proposal\n` } : source),
    "unsupported-language": [...sources, { path: "runtime/plugin.py", text: "getattr(import_module(name), function_name)()\n", revision: "uncommitted" }],
  };
  const freshness = Object.entries(snapshots).map(([scenario, current]) => {
    const changes = sources.filter((indexed) => !current.some((live) => live.path === indexed.path && sha256(live.text) === indexed.hash))
      .map((indexed) => ({ sourceId: indexed.path, status: current.some((live) => live.path === indexed.path) ? "changed" : "missing", oldHash: indexed.hash }));
    const additions = current.filter((live) => !sources.some((indexed) => indexed.path === live.path)).map((live) => live.path);
    const conflicts = current.filter((live) => /^<<<<<<< /m.test(live.text)).map((live) => live.path);
    const unsupported = current.filter((live) => !/\.(ts|md|json|yml)$/.test(live.path)).map((live) => live.path);
    const accepted = current.filter((live) => !conflicts.includes(live.path) && !unsupported.includes(live.path));
    const indexedEvidence = chunks.filter((chunk) => chunk.path === original.path);
    const reusable = indexedEvidence.filter((chunk) => current.some((live) => live.path === chunk.path && sha256(live.text) === chunk.hash));
    if (["uncommitted-edit", "rename", "deletion", "conflict"].includes(scenario)) assert.equal(reusable.length, 0, `${scenario} must reject old evidence`);
    const refreshedDb = new DatabaseSync(":memory:");
    refreshedDb.exec("CREATE VIRTUAL TABLE lookup USING fts5(path UNINDEXED, text)");
    for (const live of accepted) refreshedDb.prepare("INSERT INTO lookup VALUES (?, ?)").run(live.path, live.text);
    const lookup = (query) => refreshedDb.prepare("SELECT path FROM lookup WHERE lookup MATCH ?").all(`"${query}"`).map((row) => row.path);
    const oldSymbolMatches = lookup(fixture.freshness.old);
    const newSymbolMatches = lookup(fixture.freshness.replacement);
    if (scenario === "uncommitted-edit") {
      assert.ok(!oldSymbolMatches.includes(original.path));
      assert.ok(newSymbolMatches.includes(original.path));
    }
    if (scenario === "rename") assert.ok(oldSymbolMatches.includes(fixture.freshness.renameTo));
    if (scenario === "deletion" || scenario === "conflict") assert.ok(!oldSymbolMatches.includes(original.path));
    const refreshed = accepted.map((live) => ({ sourceId: live.path, revision: "synthetic-overlay", hash: sha256(live.text) }));
    assert.ok(changes.length + additions.length > 0, `${scenario} must change indexed coverage`);
    assert.ok(refreshed.every((record) => accepted.some((live) => live.path === record.sourceId && sha256(live.text) === record.hash)));
    if (scenario === "correction") assert.ok(accepted.find((live) => live.path === "docs/01_PRODUCT_PRD.md").text.includes(fixture.freshness.newDecision));
    if (scenario === "deletion" || scenario === "rename") assert.ok(!refreshed.some((record) => record.sourceId === original.path));
    refreshedDb.close();
    return { scenario, changes, additions, conflicts, unsupported, refreshed, oldSymbolMatches, newSymbolMatches, reusableOldEvidence: reusable.length, staleEvidenceBlocked: changes.length > 0,
      interpretation: scenario === "unsupported-language" ? "Coverage incomplete. Dynamic dependencies remain unknown." : "Source hashes detect drift before evidence reuse. Rebuild replaces the snapshot." };
  });
  let observedCalls = 0;
  runInNewContext(fixture.dynamicDependency.source, { dependencies: { billing: { parseBillingPlan: () => { observedCalls++; } } } });
  const dynamicAst = ts.createSourceFile("synthetic-dynamic.ts", fixture.dynamicDependency.source, ts.ScriptTarget.Latest, true);
  const staticImports = dynamicAst.statements.filter((node) => ts.isImportDeclaration(node) || ts.isExportDeclaration(node)).length;
  assert.equal(observedCalls, 1);
  assert.equal(staticImports, 0);
  const dynamicDependency = { source: fixture.dynamicDependency.source, sourceHash: sha256(fixture.dynamicDependency.source),
    sourceId: "fixture:dynamicDependency", revision: sha256(readFileSync(join(root, "test/acceptance/retrieval-fixture.json"), "utf8")),
    target: fixture.dynamicDependency.target, observedCalls, staticImports, missedDependencies: 1,
    extraction: "synthetic-runtime-probe-and-typescript-ast", state: "observed-fixture-only", confirmation: "unconfirmed" };
  const summary = methods.map((method) => {
    const samples = runs.filter((run) => run.method === method);
    const first = samples[0];
    const answerable = first.results.filter((result) => result.expected);
    const total = answerable.reduce((sum, result) => sum + result.expected, 0);
    const supported = answerable.reduce((sum, result) => sum + result.supported, 0);
    const stats = (values) => ({ median: [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)], minimum: Math.min(...values), maximum: Math.max(...values) });
    for (const sample of samples) assert.deepEqual(sample.results.map(({ id, supported, unsupportedCandidates, evidence: found }) => ({ id, supported, unsupportedCandidates, evidence: found })),
      first.results.map(({ id, supported, unsupportedCandidates, evidence: found }) => ({ id, supported, unsupportedCandidates, evidence: found })));
    return { method, supportedEvidenceAt5: supported, expectedEvidence: total, completeQuestionsAt5: answerable.filter((result) => result.supported === result.expected).length,
      answerableQuestions: answerable.length, unsupportedCandidateQuestions: first.results.filter((result) => result.unsupportedCandidates).length,
      unanswerableQuestions: first.results.filter((result) => !result.expected).length,
      missedDirectDependencies: first.results.find((result) => result.id === "cross-dependency").expected - first.results.find((result) => result.id === "cross-dependency").supported,
      indexMs: stats(samples.map((run) => run.indexMs)), queryBatchMs: stats(samples.map((run) => run.results.reduce((sum, result) => sum + result.queryMs, 0))),
      sqliteBytes: first.sqliteBytes, edgeCount: first.edgeCount, symbolOccurrences: first.symbolOccurrences, coverageGaps: first.coverageGaps };
  });
  const versionDb = new DatabaseSync(":memory:");
  const sqliteVersion = versionDb.prepare("SELECT sqlite_version() AS version").get().version;
  versionDb.close();
  report = { version: 1, sourceRevision: fixture.revision, candidateRevision: git("rev-parse", "HEAD"), fixtureHash: sha256(readFileSync(join(root, "test/acceptance/retrieval-fixture.json"), "utf8")),
    scriptHash: sha256(readFileSync(new URL(import.meta.url), "utf8")), environment: { node: process.version, typescript: ts.version,
      sqlite: sqliteVersion,
      platform: platform(), os: release(), cpu: cpus()[0].model, cores: cpus().length },
    method: "Pinned git blobs, fixed 12-line chunks, top 5, literal exact substring or FTS5 BM25 conjunctive keywords. Compiler uses TypeScript symbols. Relationship traversal is one reverse resolved-module hop for impact questions only. No model or network.",
    limitations: ["Keyword queries are hand-authored. Paraphrase failure is intentionally retained.", "Support means expected source and literal evidence retrieved. It is not generated-answer accuracy or exhaustive corpus recall.",
      "No answer generation. Unsupported candidate count is not a measured hallucination rate.", "Compiler-only lookup abstains on nonsymbol questions. Aggregate recall therefore includes out-of-scope documentation queries.",
      "Static compiler references cannot establish runtime behavior, business rationale, or complete dynamic dependencies.", "No confirmed or model-inferred links created. Fixture expectations are reviewer-authored judgments.",
      "Freshness overlays simulate edits and rebuild real FTS5. No file watcher or production invalidation integration exists.", "Semantic contradictions across valid files are not detected automatically. Hash drift alone does not resolve them.", "Timing is diagnostic micro cost, not end-to-end product latency or a tuned performance comparison."],
    corpus: { sources: sources.length, bytes: sources.reduce((sum, source) => sum + Buffer.byteLength(source.text), 0), chunks: chunks.length,
      questions: fixture.questions.length, repetitionsPerMethod: 5, sourceManifest: sources.map(({ id, path, hash, revision, state, extraction }) => ({ id, path, hash, revision, state, extraction })) },
    summary, freshness, dynamicDependency, runs };
  const output = process.argv[2];
  if (output) writeFileSync(resolve(output), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ corpus: { ...report.corpus, sourceManifest: undefined }, summary, freshness: freshness.map(({ scenario, changes, additions, conflicts, unsupported }) => ({ scenario, changes: changes.length, additions, conflicts, unsupported })) }, null, 2));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
