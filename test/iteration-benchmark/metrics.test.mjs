import assert from "node:assert/strict";
import { test } from "node:test";
import { coverage, dimensions } from "./metrics.mjs";
import { stressCases } from "./stress-cases.mjs";

const scenario = stressCases[0];
const job = { scenario, arm: "B0", repetition: 1, condition: "retained" };
const result = { id: scenario.id, arm: "B0", repetition: 1, condition: "retained", index: 0,
  status: "answered", reply: { text: "Who owns release?" }, issues: ["required content missing"],
  activeSources: [{ topic: "Owner" }, { topic: "Security" }], elapsedMs: 0 };
test("missing, duplicate and unsolicited results cannot masquerade as completion", () => {
  assert.equal(coverage([job], []).missing.length, 1);
  assert.equal(coverage([job], [result]).missing.length, 0);
  assert.throws(() => coverage([job], [result, result]), /Duplicate result/);
  assert.throws(() => coverage([job], [{ ...result, id: "other" }]), /Unscheduled/);
});
test("retrieval coverage, answer behavior and unavailable telemetry remain separate", () => {
  const [row] = dimensions([result], [scenario]);
  assert.equal(row.requiredEvidenceRecall, 2 / 3);
  assert.equal(row.answerChecksPassed, false);
  assert.equal(row.clarificationQuestionCount, 1);
  assert.equal(row.elapsedMs, 0);
  assert.equal(row.inputTokens, null);
  assert.equal(row.unsupportedClaims, null);
  const [blocked] = dimensions([{ ...result, status: "blocked", reply: undefined }], [scenario]);
  assert.equal(blocked.answerChecksPassed, null);
  assert.equal(blocked.clarificationQuestionCount, null);
});
test("stress fixtures keep unique families and valid source expectations", () => {
  assert.equal(stressCases.length, 10);
  assert.equal(new Set(stressCases.map(item => item.id)).size, 10);
  for (const item of stressCases.filter(item => item.kind === "generated")) {
    const topics = new Set();
    for (const turn of item.turns) {
      for (const fact of turn.facts) topics.add(fact.topic);
      assert(turn.expectation.cite.every(topic => topics.has(topic)));
      assert(turn.selectedTopics?.every(topic => topics.has(topic)) ?? true);
      for (const pattern of [...turn.expectation.must, ...turn.expectation.forbid]) new RegExp(pattern);
    }
  }
  assert.equal(stressCases.find(item => item.category === "insufficient-selected-evidence").turns[0].selectedTopics.length, 2);
});
