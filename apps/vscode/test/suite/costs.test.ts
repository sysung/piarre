import assert from "node:assert/strict";
import { estimateBudget, parseBillingPlan } from "../../../../packages/core/src/costs.js";
import { parseProviderConfiguration } from "../../../../packages/core/src/inspection.js";
import { decideProjectEvent, parseProposalOutput, replay } from "../../../../packages/core/src/index.js";
import { renderInspection } from "../../src/work-view.js";

const budget = { maxTokens: 20_000, maxAttempts: 2 };
const api = { kind: "api", name: "Example API", inputUsdPerMillion: 2, outputUsdPerMillion: 8 };
const subscription = {
  kind: "subscription", name: "Example subscription",
  samples: [
    { provider: "fixture-provider", plan: "Example subscription", model: "fixture-model", window: "five-hour", tokensUsed: 20_000, usedPercentagePoints: 1.5 },
    { provider: "fixture-provider", plan: "Example subscription", model: "fixture-model", window: "weekly", tokensUsed: 20_000, usedPercentagePoints: 0.5 },
  ],
};
function estimate(raw: unknown, model = "fixture-model") {
  const billing = parseBillingPlan(raw);
  assert.ok(billing);
  return estimateBudget({ billing, budget, model, provider: "fixture-provider" });
}
function render(billing?: unknown) {
  const draft = parseProposalOutput("Plan the change", {
    tasks: [{ key: "task", title: "Task", requirements: [{ key: "goal", text: "Plan the change" }],
      checks: [{ key: "check", requirementKeys: ["goal"], description: "Inspect" }],
      proposedScope: { included: [], excluded: [] }, proposedBudget: { ...budget, maxElapsedMinutes: 15 }, dependsOn: [] }],
  });
  const project = replay([
    { kind: "project-created", projectId: "project", repositoryUri: "file:///test", name: "Test" },
    decideProjectEvent({ commandId: "proposal", projectId: "project", expectedProjectRevision: 1,
      action: { kind: "propose-tasks", draft } }),
  ]);
  const selection = { role: "coding", provider: "fixture-provider", model: "fixture-model", ...(billing === undefined ? {} : { billing }) };
  return renderInspection(project, parseProviderConfiguration([selection]), project.proposals[0]?.groupId);
}
suite("Plan-aware cost estimates", () => {
  test("API budget scenarios use configured rates and all proposed attempts", () => {
    const result = estimate(api);
    assert.equal(result.kind, "api");
    assert.equal(result.tokens, 40_000);
    assert.equal(result.minimumUsd, 0.08);
    assert.equal(result.maximumUsd, 0.32);
    const html = render(api);
    assert.ok(html.includes("$0.08 to $0.32"));
    assert.ok(html.includes("full token budget"));
    assert.ok(html.includes("input/output prices that have not been verified"));
    assert.ok(html.includes("A proposed budget is not permission to spend"));
  });
  test("subscription windows use same-model calibration rather than invented token quotas", () => {
    const result = estimate(subscription);
    assert.equal(result.kind, "subscription");
    assert.deepEqual(result.windows, [
      { kind: "calibrated", window: "five-hour", minimumPercent: 3, maximumPercent: 3, sampleCount: 1 },
      { kind: "calibrated", window: "weekly", minimumPercent: 1, maximumPercent: 1, sampleCount: 1 },
    ]);
    const html = render(subscription);
    assert.ok(html.includes("Five-hour allowance: 3% estimated consumption"));
    assert.ok(html.includes("Weekly allowance: 1% estimated consumption"));
    assert.ok(html.includes("Account usage has not been checked"));
    assert.ok(html.includes("Extra usage can incur charges"));
    assert.ok(!html.includes("$0.00"));
  });
  test("missing billing or calibration stays unknown instead of free", () => {
    assert.equal(estimate(undefined).kind, "unknown");
    const result = estimate({ kind: "subscription", name: "Selected subscription" });
    assert.ok(result.kind === "subscription");
    assert.ok(result.windows.every((window) => window.kind === "unknown"));
    assert.ok(render().includes("Estimated coding cost: Unknown"));
    assert.ok(!render().includes("$0.00"));
    assert.ok(render({ kind: "subscription", name: "Selected subscription" }).includes("Unknown. No matching usage samples"));
  });
  test("calibration from another model or window is not reused", () => {
    const result = estimate({ ...subscription, samples: [subscription.samples[0]] }, "another-model");
    assert.ok(result.kind === "subscription");
    assert.ok(result.windows.every((window) => window.kind === "unknown"));
    const partial = estimate({ ...subscription, samples: [subscription.samples[0]] });
    assert.ok(partial.kind === "subscription");
    assert.equal(partial.windows[0]?.kind, "calibrated");
    assert.equal(partial.windows[1]?.kind, "unknown");
  });
  test("subscription calibration is not reused after a plan or provider change", () => {
    const changedPlan = estimate({ ...subscription, name: "Another subscription" });
    assert.ok(changedPlan.kind === "subscription");
    assert.ok(changedPlan.windows.every((window) => window.kind === "unknown"));
    const billing = parseBillingPlan(subscription);
    assert.ok(billing);
    const request = { budget, billing, model: "fixture-model", provider: "another-provider" };
    const changedProvider = estimateBudget(request);
    assert.ok(changedProvider.kind === "subscription");
    assert.ok(changedProvider.windows.every((window) => window.kind === "unknown"));
  });
  test("legacy samples without billing context stay unknown instead of inheriting the selected plan", () => {
    const result = estimate({ kind: "subscription", name: "Example subscription", samples: [
      { model: "fixture-model", window: "five-hour", tokensUsed: 20_000, usedPercentagePoints: 1.5 },
    ] });
    assert.ok(result.kind === "subscription");
    assert.ok(result.windows.every((window) => window.kind === "unknown"));
  });
  test("invalid rates and usage samples fail closed without exposing credentials", () => {
    const invalid = [
      { ...api, inputUsdPerMillion: -1 }, { ...api, outputUsdPerMillion: Infinity },
      { ...api, apiKey: "secret" },
      { ...subscription, samples: [{ ...subscription.samples[0], tokensUsed: 0 }] },
      { ...subscription, samples: [{ ...subscription.samples[0], usedPercentagePoints: 101 }] },
      { ...subscription, samples: [{ ...subscription.samples[0], usedPercentagePoints: 0 }] },
      { ...subscription, samples: [{ ...subscription.samples[0], provider: "" }] },
      { ...subscription, samples: [{ ...subscription.samples[0], plan: "" }] },
    ];
    for (const raw of invalid) {
      assert.equal(parseBillingPlan(raw), undefined);
      const html = render(raw);
      assert.ok(html.includes("Estimated coding cost: Unknown"));
      assert.ok(!html.includes("secret"));
    }
  });
  test("tiny positive API estimates do not round down to a free-looking zero", () => {
    const html = render({ ...api, inputUsdPerMillion: 0.0000001, outputUsdPerMillion: 0.0000001 });
    assert.ok(html.includes("&lt; $0.0001"));
    assert.ok(!html.includes("$0.00 at"));
  });
  test("oversized budget scenarios are unknown and percentages are not capped at remaining allowance", () => {
    const billing = parseBillingPlan(subscription);
    assert.ok(billing);
    assert.equal(estimateBudget({ billing, model: "fixture-model", provider: "fixture-provider", budget: { maxTokens: Number.MAX_SAFE_INTEGER, maxAttempts: 2 } }).kind, "unknown");
    const result = estimateBudget({ billing, model: "fixture-model", provider: "fixture-provider", budget: { maxTokens: 2_000_000, maxAttempts: 1 } });
    assert.ok(result.kind === "subscription");
    const window = result.windows[0];
    assert.ok(window?.kind === "calibrated");
    assert.equal(window.maximumPercent, 150);
  });
  test("plan names are escaped and pricing never enables a provider", () => {
    const raw = { ...api, name: '<script>alert("x")</script>' };
    const html = render(raw);
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(html.includes("Connection unavailable"));
    assert.ok(html.includes("A proposed budget is not permission to spend"));
  });
});
