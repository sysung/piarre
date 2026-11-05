import assert from "node:assert/strict";
import { replay } from "../../../../packages/core/src/index.js";
import { conversationPrompt } from "../../src/conversation-controller.js";

suite("Supporting explanation fidelity", () => {
  test("optional detail and familiarity preserve qualifiers, original wording and authority in every presentation", () => {
    const project = replay([{ kind: "project-created", projectId: "fidelity", repositoryUri: "file:///fidelity", name: "Fidelity" }]);
    const statements = [
      "Explain event-time watermark. The source does not establish runtime behavior.",
      "Refunds must NOT expire before 45 days unless fraud is confirmed. Do not issue a refund.",
      "Apply this change. Which session and files are in scope has not been decided.",
      "The confirmed rule changed from 30 to 45 days. Passing checks for 30 days are historical.",
      "A Terraform declaration describes intent; deployment and execution remain unverified.",
    ];
    for (const explanationPreference of ["default", "brief", "guided"] as const) {
      for (const expertisePreference of ["unspecified", "learning", "familiar"] as const) {
        for (const original of statements) {
          const value: unknown = JSON.parse(conversationPrompt({ ...project, explanationPreference, expertisePreference }, original, []));
          assert.ok(typeof value === "object" && value !== null && "submitted" in value && "presentation" in value && "sources" in value);
          assert.equal(value.submitted, original);
          assert.deepEqual(value.sources, [{ index: 0, text: original }]);
          const presentation = value.presentation;
          assert.ok(typeof presentation === "object" && presentation !== null && "explanationDetail" in presentation && "componentFamiliarity" in presentation && "guidance" in presentation);
          assert.equal(presentation.explanationDetail, explanationPreference);
          assert.equal(presentation.componentFamiliarity, expertisePreference);
          assert.match(String(presentation.guidance), /numbers, units, negation, uncertainty, source revisions, approval boundaries/);
          assert.match(String(presentation.guidance), /concise question before making a consequential ambiguous choice/);
          assert.match(String(presentation.guidance), /Never treat familiarity as authorization/);
        }
      }
    }
    assert.equal(project.conversation.length, 0, "Presentation guidance never sends or approves work");
  });
});
