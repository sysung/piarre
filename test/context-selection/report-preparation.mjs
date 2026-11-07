import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const cases = JSON.parse(readFileSync("keys.json"));
const corpus = JSON.parse(readFileSync("corpus.json"));
const text = readFileSync("attempts.jsonl", "utf8");
const rows = text.trim().split("\n").map(line => JSON.parse(line));
const arms = ["direct-refine", "evidence-first"];
const results = [];

for (const item of cases) {
  for (const arm of arms) {
    const responses = rows.filter(row => row.type === "response" && row.id === item.id && row.arm === arm);
    const preparation = responses.filter(row => row.stage === "prepare");
    const answer = responses.filter(row => row.stage === "answer");
    assert(preparation.length <= 1 && answer.length <= 1, "Duplicate response");
    const invalid = rows.some(row => row.type === "validation" && row.id === item.id && row.arm === arm && !row.valid);
    if (invalid || answer.length === 0) {
      results.push({ id: item.id, arm, status: invalid ? "invalid evidence" : "missing",
        pass: false, elapsedMs: responses.reduce((sum, row) => sum + row.elapsedMs, 0) });
      continue;
    }
    assert.equal(preparation.length, 1);
    const originalSources = corpus.filter(source => source.project === item.project).map(({ id, text }) => ({ id, text }));
    assert.deepEqual(preparation[0].input.sources, originalSources);
    if (arm === "evidence-first") {
      const checked = preparation[0].output.evidence.every(entry => entry.quote.trim() &&
        originalSources.some(source => source.id === entry.sourceId && source.text.includes(entry.quote)));
      assert(checked, "An answer used an invalid evidence quotation");
    }
    assert.deepEqual(answer[0].input.sources, originalSources);
    assert.equal(answer[0].input.question, item.question);
    assert(responses.every(row => Buffer.byteLength(JSON.stringify(row.input)) <= 6000), "Production prompt byte budget exceeded");
    const output = answer[0].output;
    const content = item.must.every(pattern => new RegExp(pattern, "i").test(output.summary));
    const citations = item.sources.every(id => output.sourceIds.includes(id)) &&
      output.sourceIds.every(id => originalSources.some(source => source.id === id));
    results.push({ id: item.id, arm, status: "answered", pass: content && citations, content, citations,
      elapsedMs: responses.reduce((sum, row) => sum + row.elapsedMs, 0),
      observedTokens: responses.reduce((sum, row) => sum + (row.usage?.total_tokens ?? 0), 0) });
  }
}

const summary = arms.map(arm => {
  const selected = results.filter(row => row.arm === arm);
  return { arm, scheduled: cases.length, answered: selected.filter(row => row.status === "answered").length,
    automaticPasses: selected.filter(row => row.pass).length, totalMs: selected.reduce((sum, row) => sum + row.elapsedMs, 0),
    observedTokens: selected.reduce((sum, row) => sum + (row.observedTokens ?? 0), 0) };
});
const report = {
  schemaVersion: 1,
  verdict: "Independent content adjudication required",
  complete: rows.at(-1)?.type === "end" && results.every(row => row.status !== "missing"),
  logSha256: createHash("sha256").update(text).digest("hex"),
  summary,
  results,
  limits: ["Exposed synthetic development cases", "Regex scores need independent content adjudication", "Single run per case and arm"],
};
writeFileSync("preparation-report.json", JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ complete: report.complete, summary }));
