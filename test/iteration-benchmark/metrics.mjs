import assert from "node:assert/strict";

const key = row => JSON.stringify([row.id, row.arm, row.repetition, row.condition, row.index ?? 0]);
export function coverage(jobs, results) {
  const expected = jobs.flatMap(job => Array.from({
    length: job.condition === "retained" ? job.scenario.turns?.length ?? 1 : 1,
  }, (_, index) => key({ ...job, id: job.scenario.id, index })));
  assert.equal(new Set(expected).size, expected.length, "Duplicate scheduled result");
  const allowed = new Set(expected);
  const seen = new Set();
  for (const row of results) {
    assert(allowed.has(key(row)), "Unscheduled result");
    assert(!seen.has(key(row)), "Duplicate result");
    seen.add(key(row));
  }
  return { scheduled: expected.length, observed: seen.size, missing: expected.filter(id => !seen.has(id)) };
}

export function dimensions(results, scenarios) {
  const lookup = new Map(scenarios.map(scenario => [scenario.id, scenario]));
  return results.filter(row => lookup.get(row.id)?.kind === "generated").map(row => {
    const scenario = lookup.get(row.id);
    const turn = row.condition === "retained" ? scenario.turns[row.index ?? 0] : scenario.turns.at(-1);
    const topics = (row.activeSources ?? []).map(source => source.topic);
    const required = turn.expectation.cite;
    const answered = row.status === "answered";
    return {
      id: row.id, arm: row.arm, repetition: row.repetition, condition: row.condition, index: row.index,
      category: scenario.category ?? null, status: row.status,
      // Evidence coverage measures supplied excerpts, not semantic relevance or answer support.
      requiredEvidenceCount: required.length,
      suppliedRequiredEvidenceCount: required.filter(topic => topics.includes(topic)).length,
      requiredEvidenceRecall: required.length ? required.filter(topic => topics.includes(topic)).length / required.length : null,
      answerChecksPassed: answered ? row.issues.length === 0 : null,
      expectedBehavior: turn.expectation.kind,
      clarificationQuestionCount: answered ? (row.reply.text.match(/\?/g) ?? []).length : null,
      unsupportedClaims: null, // Requires independent claim-by-claim review.
      falseCompletionDetected: row.issues.includes("false completion"),
      elapsedMs: Number.isFinite(row.elapsedMs) ? row.elapsedMs : null,
      inputTokens: null, outputTokens: null, // Production adapter does not expose usage.
      telemetryStatus: "token usage unavailable; unsupported claims require independent review",
    };
  });
}
