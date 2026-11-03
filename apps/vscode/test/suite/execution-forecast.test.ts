import assert from "node:assert/strict";
import { createExecutionForecast, parseExecutionForecast, parseCalibrationSample, executionForecastText, type CalibrationSample } from "../../../../packages/core/src/execution-forecast.js";
import { parseBillingPlan } from "../../../../packages/core/src/costs.js";
import type { CodexExecutionContext } from "../../../../packages/core/src/provider-account-context.js";

const now = Date.parse("2026-11-02T12:00:00Z");
const configurationHash = "a".repeat(64);
const accountHash = "b".repeat(64);
const context: CodexExecutionContext = { observedAt: new Date(now).toISOString(), model: { kind: "resolved-default", model: "model" }, modelProfiles: [{ model: "model", defaultEffort: "medium", supportedEfforts: ["medium"] }], usage: { kind: "observed", source: "account/rateLimits/read", windows: [{ source: "primary", usedPercent: 23, windowDurationMins: 90, resetsAt: (now + 60_000) / 1000 }] }, facts: { accountHash, planType: "plus", bucketId: "codex", ordinaryUsageAllowed: true } };
const sample: CalibrationSample = { kind: "reviewed-v1", sampleId: "isolated-1", provider: "codex", accountHash, plan: "plus", model: "model", profile: { kind: "named", effort: "medium" }, serviceTier: "default", contextMethod: "serialized-prompt-utf8-v1", contextBand: "up-to-16KiB", bucketId: "codex", durationMins: 90, before: { observedAt: now - 120_000, resetsAt: (now + 60_000) / 1000, usedPercent: 10 }, after: { observedAt: now - 60_000, resetsAt: (now + 60_000) / 1000, usedPercent: 12 }, tokensUsed: 8000, attribution: "reviewed-isolated", provenance: "Reviewed isolated fixture measurement; not live account evidence" };
function forecast(overrides: Partial<Parameters<typeof createExecutionForecast>[0]> = {}) {
  const result = createExecutionForecast({ forecastId: "forecast", now, configurationHash, provider: "codex", model: "model", authType: "chatgpt", billing: { kind: "subscription", name: "plus", samples: [sample] }, context, promptBytes: 4000, softTokenTarget: 16000, profile: { kind: "named", effort: "medium" }, concurrentUsage: false, ...overrides });
  assert.equal(result.kind, "configured-v1"); return result;
}
function points(result: ReturnType<typeof forecast>) { assert.equal(result.estimate.kind, "subscription"); return result.estimate.windows[0]; }
suite("Immutable execution forecasts", () => {
  test("positive reviewed subscription scenario separates actual account use from projected points", () => {
    const result = forecast(); assert.deepEqual(points(result), { bucketId: "codex", source: "primary", durationMins: 90, resetsAt: (now + 60_000) / 1000, kind: "scenario", minimumPoints: 4, maximumPoints: 4, sampleIds: ["isolated-1"] });
    assert.equal(context.usage.kind, "observed"); assert.equal(context.usage.windows[0]?.usedPercent, 23);
    assert.match(executionForecastText(result), /limited linear scenario/); assert.doesNotMatch(executionForecastText(result), /remaining tokens|free usage\.$/);
    assert.deepEqual(parseExecutionForecast(JSON.parse(JSON.stringify(result))), result);
  });
  for (const [tokens, expected] of [[4000, "scenario"], [16000, "scenario"], [3999, "unknown"], [16001, "unknown"]] as const) test(`linear scenario token ratio boundary ${String(tokens)}`, () => {
    assert.equal(typeof tokens, "number"); assert.equal(points(forecast({ softTokenTarget: tokens }))?.kind, expected);
  });
  for (const [label, changes] of [
    ["account", { accountHash: "c".repeat(64) }], ["model", { model: "other" }], ["plan", { plan: "pro" }], ["duration", { durationMins: 300 }], ["bucket", { bucketId: "other" }], ["context", { contextBand: "larger" }],
    ["effort", { profile: { kind: "named", effort: "high" } }],
    ["reset", { after: { ...sample.after, resetsAt: sample.after.resetsAt + 1 } }], ["zero delta", { after: { ...sample.after, usedPercent: 10 } }],
    ["negative delta", { after: { ...sample.after, usedPercent: 9 } }], ["future", { after: { ...sample.after, observedAt: now + 1 } }],
    ["unordered", { after: { ...sample.after, observedAt: sample.before.observedAt } }], ["stale", { before: { ...sample.before, observedAt: now - 8 * 86400000 - 1 }, after: { ...sample.after, observedAt: now - 8 * 86400000 } }],
  ] as const) test(`rejects calibration with ${label} mismatch`, () => {
    const changed = parseCalibrationSample({ ...sample, ...changes });
    const result = forecast({ billing: { kind: "subscription", name: "plus", samples: [changed] } });
    assert.equal(points(result)?.kind, "unknown"); assert.equal(result.rejectedSamples.length, 1);
  });
  test("unknown identity, concurrency and historical samples remain usable only with unknown scenarios", () => {
    assert.equal(points(forecast({ context: { ...context, facts: { ...context.facts, accountHash: null, planType: "plus", bucketId: "codex", ordinaryUsageAllowed: true } } }))?.kind, "unknown");
    assert.equal(points(forecast({ concurrentUsage: true }))?.kind, "unknown");
    const billing = parseBillingPlan({ kind: "subscription", name: "plus", samples: [{ provider: "codex", plan: "plus", model: "model", window: "five-hour", tokensUsed: 8000, usedPercentagePoints: 2 }] }); assert.ok(billing);
    assert.equal(points(forecast({ billing }))?.kind, "unknown");
    assert.equal(forecast({ context: { ...context, observedAt: new Date(now - 300001).toISOString() } }).estimate.kind, "unknown");
  });
  test("a different current reset permits a valid historical sample but a current expired reset does not", () => {
    const changed = { ...sample, before: { ...sample.before, resetsAt: (now - 30000) / 1000 }, after: { ...sample.after, resetsAt: (now - 30000) / 1000 } };
    assert.equal(points(forecast({ billing: { kind: "subscription", name: "plus", samples: [changed] } }))?.kind, "scenario");
    assert.equal(points(forecast({ context: { ...context, usage: { kind: "observed", source: "account/rateLimits/read", windows: [{ source: "primary", usedPercent: 99, windowDurationMins: 90, resetsAt: now / 1000 }] } } }))?.kind, "unknown");
  });
  test("API rates use one attempt and preserve tiny positive configured values", () => {
    const result = forecast({ authType: "apiKey", billing: { kind: "api", name: "rates", inputUsdPerMillion: 2, outputUsdPerMillion: 8 } });
    assert.deepEqual(result.estimate, { kind: "api", minimumUsd: 0.032, maximumUsd: 0.128, rateStatus: "unverified-configured" }); assert.equal(result.attempts, 1);
    const tiny = forecast({ authType: "apiKey", billing: { kind: "api", name: "tiny", inputUsdPerMillion: 1e-7, outputUsdPerMillion: 1e-7 } }); assert.match(executionForecastText(tiny), /< \$0.0001/);
    assert.match(executionForecastText(result), /No monetary cap/);
    assert.equal(forecast({ authType: "apiKey", billing: { kind: "api", name: "underflow", inputUsdPerMillion: Number.MIN_VALUE, outputUsdPerMillion: Number.MIN_VALUE } }).estimate.kind, "unknown");
  });
  test("API provenance expiry, provider/model mismatch, overflow and actual route mismatch stay unknown", () => {
    const provenance = { provider: "codex", model: "model", serviceTier: "default", configuredAt: now - 1000, expiresAt: now + 1000 } as const;
    const billing = { kind: "api", name: "dated", inputUsdPerMillion: 2, outputUsdPerMillion: 8, provenance } as const;
    assert.equal(forecast({ authType: "apiKey", billing }).validUntil, now + 1000);
    for (const change of [{ expiresAt: now }, { provider: "other" }, { model: "other" }, { configuredAt: now + 1 }]) assert.equal(forecast({ authType: "apiKey", billing: { ...billing, provenance: { ...provenance, ...change } } }).estimate.kind, "unknown");
    assert.equal(forecast({ billing }).estimate.kind, "unknown");
    assert.equal(forecast({ authType: "apiKey", softTokenTarget: Number.MAX_SAFE_INTEGER, billing: { ...billing, inputUsdPerMillion: Number.MAX_VALUE, outputUsdPerMillion: Number.MAX_VALUE } }).estimate.kind, "unknown");
  });
  test("strict configuration and persisted forecast parsers reject unknown fields and unsupported profiles", () => {
    assert.deepEqual(parseCalibrationSample(sample), sample);
    assert.equal(parseBillingPlan({ kind: "subscription", name: "plus", samples: [sample] })?.kind, "subscription");
    for (const change of [{ serviceTier: "fast" }, { attribution: "concurrent" }, { rawAccountId: "private" }, { contextMethod: "invented" }, { profile: { kind: "named", effort: "invented" } }]) assert.throws(() => parseCalibrationSample({ ...sample, ...change }));
    for (const change of [{ serviceTierForTurn: "fast" }, { attempts: 2 }, { accountHash: "raw-private" }, { rawAccountId: "private" }, { softTokenTarget: Infinity }, { contextBand: "larger" }, { route: "api" }, { estimate: { kind: "api", minimumUsd: 1, maximumUsd: 2, rateStatus: "dated-configured" } }]) assert.throws(() => parseExecutionForecast({ ...forecast(), ...change }));
  });
});
