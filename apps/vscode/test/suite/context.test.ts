import assert from "node:assert/strict";
import { parseSubmittedStatement, parseInterpretationOutput, parseKnowledgeCorrection, type KnowledgeSource } from "../../../../packages/core/src/index.js";
import type { RecordReference } from "../../../../packages/core/src/inspection.js";

suite("C01 conversation and knowledge boundaries", () => {
  const submitted = parseSubmittedStatement({ requestId: "turn-1", projectId: "project-1", contextRevision: 7,
    originalStatement: "  Refunds must not expire before 45 days.\n" });
  const reference: RecordReference = { projectId: "project-1", kind: "proposal", recordId: "proposal-1", revision: 3 };

  test("submitted context preserves original wording and rejects fabricated authority", () => {
    assert.equal(submitted.originalStatement, "  Refunds must not expire before 45 days.\n");
    assert.equal(submitted.contextRevision, 7);
    for (const extra of [{ approved: true }, { confirmed: true }, { contextRevision: 0 }, { originalStatement: " " }]) {
      assert.throws(() => parseSubmittedStatement({ ...submitted, ...extra }), /Invalid context proposal/);
    }
  });

  test("interpretations cite only supplied sources and remain inferred", () => {
    const result = parseInterpretationOutput({ submitted, availableSources: [reference],
      value: { summary: "Keep the refund window at least 45 days.", sourceIndexes: [0, 1] } });
    assert.equal(result.kind, "inferred");
    assert.deepEqual(result.submitted, submitted);
    assert.deepEqual(result.summary.sources, [{ kind: "submitted-statement", submitted }, { kind: "project-record", reference }]);
    for (const sourceIndexes of [[], [-1], [2], [0.5], ["0"]]) {
      assert.throws(() => parseInterpretationOutput({ submitted, availableSources: [reference],
        value: { summary: "A claim", sourceIndexes } }), /Invalid context proposal/);
    }
    for (const extra of [{ approved: true }, { confirmed: true }, { sources: [reference] }, { projectId: "invented" }]) {
      assert.throws(() => parseInterpretationOutput({ submitted, availableSources: [],
        value: { summary: "A claim", sourceIndexes: [0], ...extra } }), /Invalid context proposal/);
    }
    assert.throws(() => parseInterpretationOutput({ submitted, availableSources: [{ ...reference, projectId: "another" }],
      value: { summary: "A claim", sourceIndexes: [1] } }), /Invalid context proposal/);
  });

  test("correction candidates retain the host-selected target and cannot confirm it", () => {
    const target = { projectId: "project-1", knowledgeId: "refund-policy", recordedAtRevision: 4 };
    const availableSources = [{ kind: "submitted-statement", submitted } satisfies KnowledgeSource];
    const value = { text: "Refund window is 45 days", sourceIndexes: [0] };
    const result = parseKnowledgeCorrection({ target, availableSources, value });
    assert.deepEqual(result.target, target);
    assert.deepEqual(result.proposedContent.sources, availableSources);
    for (const extra of [{ target: { ...target, knowledgeId: "other" } }, { confirmed: true }, { standing: { kind: "confirmed" } }]) {
      assert.throws(() => parseKnowledgeCorrection({ target, availableSources, value: { ...value, ...extra } }), /Invalid context proposal/);
    }
    assert.throws(() => parseKnowledgeCorrection({ target: { ...target, projectId: "another" }, availableSources, value }), /Invalid context proposal/);
  });
});

