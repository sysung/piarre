import { createExecutionForecast, type SpendingConsent } from "../../../../packages/core/src/execution-forecast.js";
import type { ExecutionPlan } from "../../../../packages/core/src/execution.js";
export function forecastFixture() {
  return createExecutionForecast({ forecastId: "fixture-forecast", now: 1000, configurationHash: "a".repeat(64), provider: "codex", model: "fixture-model", authType: "unknown", billing: { kind: "unknown" }, context: { observedAt: new Date(1000).toISOString(), model: { kind: "unknown" }, usage: { kind: "unknown" } }, promptBytes: 1, softTokenTarget: 4000, profile: { kind: "default", configurationHash: "a".repeat(64) }, concurrentUsage: false });
}
export function consentFixture(plan: ExecutionPlan, runId: string): SpendingConsent {
  const forecast = plan.forecast; if (forecast.kind !== "configured-v1") throw new Error("Fixture forecast missing");
  return { kind: "native-uncertain-one-attempt", forecastId: forecast.forecastId, configurationHash: forecast.configurationHash, planId: plan.planId, planRevision: plan.recordedAtRevision, runId, route: forecast.route, consentedAt: 1000 };
}
