import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
const hash = text => createHash("sha256").update(text).digest("hex");
const corpus = JSON.parse(readFileSync("corpus.json"));
const cases = JSON.parse(readFileSync("keys.json"));
const annotations = readFileSync("annotations.jsonl", "utf8").trim().split("\n").map(JSON.parse);
assert.equal(annotations.length, corpus.length);
for (const source of corpus) {
 const annotation = annotations.find(item => item.id === source.id);
 assert.equal(annotation.input.passage, source.text);
 assert.equal(annotation.revision, source.revision);
}
const stopwords = new Set("a an the is are was were be been do does did can could should would will may how why what which who whom where when to of for in on with from at by and or as it its this that our we somebody someone get happen happens since have has enough only any there their than then immediately".split(" "));
const terms = query => [...new Set((query.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter(term => !stopwords.has(term)))];
const results = [];
for (const arm of ["raw-and", "raw-or", "context-or"]) {
 const database = new DatabaseSync(":memory:");
 database.exec("CREATE VIRTUAL TABLE lookup USING fts5(id UNINDEXED, project UNINDEXED, text, tokenize='porter unicode61')");
 const insert = database.prepare("INSERT INTO lookup VALUES(?,?,?)");
 for (const source of corpus) {
  const annotation = annotations.find(item => item.id === source.id);
  const text = source.text + (arm === "context-or" ? "\n" + annotation.output.description + "\n" + annotation.output.keywords.join(" ") : "");
  insert.run(source.id, source.project, text);
 }
 for (const item of cases) {
  const query = terms(item.question).map(term => '"' + term + '"').join(arm === "raw-and" ? " AND " : " OR ");
  const hits = query ? database.prepare("SELECT id FROM lookup WHERE lookup MATCH ? AND project=? ORDER BY bm25(lookup),id LIMIT 3").all(query, item.project) : [];
  assert(hits.every(hit => corpus.find(source => source.id === hit.id).project === item.project));
  results.push({ id: item.id, arm, expected: item.sources, selected: hits.map(hit => hit.id), recalled: item.sources.filter(id => hits.some(hit => hit.id === id)).length,
   sourceHashes: hits.map(hit => ({ id: hit.id, hash: hash(corpus.find(source => source.id === hit.id).text) })) });
 }
 database.close();
}
const report = { fixtureSha256: hash(JSON.stringify({ corpus, cases })), annotationsSha256: hash(JSON.stringify(annotations)),
 summary: ["raw-and","raw-or","context-or"].map(arm => {
  const rows = results.filter(row => row.arm === arm);
  return { arm, expected: rows.reduce((sum,row) => sum + row.expected.length,0), recalled: rows.reduce((sum,row) => sum + row.recalled,0),
    answerableQueries: rows.filter(row => row.expected.length).length, unanswerableWithCandidates: rows.filter(row => !row.expected.length && row.selected.length).length };
 }), results };
writeFileSync("retrieval.json", JSON.stringify(report,null,2), { flag: "wx" });
console.log(JSON.stringify(report.summary));
