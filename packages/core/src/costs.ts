import type { ProposedBudget } from "./index.js";

export type UsageWindow = "five-hour" | "weekly";
export interface UsageSample {
  readonly model: string;
  readonly window: UsageWindow;
  readonly tokensUsed: number;
  readonly usedPercentagePoints: number;
}
export type BillingPlan =
  | { readonly kind: "unknown" }
  | { readonly kind: "api"; readonly name: string; readonly inputUsdPerMillion: number; readonly outputUsdPerMillion: number }
  | { readonly kind: "subscription"; readonly name: string; readonly samples: readonly UsageSample[] };

function object(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: object, allowed: readonly string[]): boolean {
  return Object.keys(value).length === allowed.length && Object.keys(value).every((key) => allowed.includes(key));
}
function name(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 100;
}
function rate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function parseBillingPlan(value: unknown): BillingPlan | undefined {
  if (value === undefined) return { kind: "unknown" };
  if (!object(value) || !("kind" in value)) return undefined;
  if (value.kind === "unknown" && keys(value, ["kind"])) return { kind: "unknown" };
  if (!("name" in value) || !name(value.name)) return undefined;
  if (value.kind === "api" && keys(value, ["kind", "name", "inputUsdPerMillion", "outputUsdPerMillion"]) &&
      "inputUsdPerMillion" in value && "outputUsdPerMillion" in value &&
      rate(value.inputUsdPerMillion) && rate(value.outputUsdPerMillion))
    return { kind: "api", name: value.name, inputUsdPerMillion: value.inputUsdPerMillion, outputUsdPerMillion: value.outputUsdPerMillion };
  if (value.kind !== "subscription") return undefined;
  if (keys(value, ["kind", "name"])) return { kind: "subscription", name: value.name, samples: [] };
  if (!keys(value, ["kind", "name", "samples"]) || !("samples" in value) || !Array.isArray(value.samples)) return undefined;
  const samples: UsageSample[] = [];
  const rawSamples: readonly unknown[] = value.samples;
  for (const sample of rawSamples) {
    if (!object(sample) || !keys(sample, ["model", "window", "tokensUsed", "usedPercentagePoints"]) ||
        !("model" in sample) || !("window" in sample) || !("tokensUsed" in sample) || !("usedPercentagePoints" in sample) ||
        !name(sample.model) || (sample.window !== "five-hour" && sample.window !== "weekly") ||
        typeof sample.tokensUsed !== "number" || !Number.isSafeInteger(sample.tokensUsed) || sample.tokensUsed <= 0 ||
        !rate(sample.usedPercentagePoints) || sample.usedPercentagePoints <= 0 || sample.usedPercentagePoints > 100) return undefined;
    samples.push({ model: sample.model, window: sample.window, tokensUsed: sample.tokensUsed, usedPercentagePoints: sample.usedPercentagePoints });
  }
  return { kind: "subscription", name: value.name, samples };
}

export type WindowEstimate =
  | { readonly kind: "unknown"; readonly window: UsageWindow }
  | { readonly kind: "calibrated"; readonly window: UsageWindow; readonly minimumPercent: number; readonly maximumPercent: number; readonly sampleCount: number };
export type BudgetEstimate =
  | { readonly kind: "unknown"; readonly reason: string }
  | { readonly kind: "api"; readonly plan: string; readonly tokens: number; readonly minimumUsd: number; readonly maximumUsd: number }
  | { readonly kind: "subscription"; readonly plan: string; readonly tokens: number; readonly windows: readonly WindowEstimate[] };

export function estimateBudget(input: {
  readonly budget: Pick<ProposedBudget, "maxTokens" | "maxAttempts">;
  readonly billing: BillingPlan;
  readonly model: string;
}): BudgetEstimate {
  const tokens = input.budget.maxTokens * input.budget.maxAttempts;
  if (!Number.isSafeInteger(tokens) || tokens <= 0) return { kind: "unknown", reason: "Token budget is too large to estimate safely." };
  const billing = input.billing;
  if (billing.kind === "unknown") return { kind: "unknown", reason: "Billing mode and plan details are not configured." };
  if (billing.kind === "api") {
    const minimumUsd = tokens / 1_000_000 * Math.min(billing.inputUsdPerMillion, billing.outputUsdPerMillion);
    const maximumUsd = tokens / 1_000_000 * Math.max(billing.inputUsdPerMillion, billing.outputUsdPerMillion);
    if (!Number.isFinite(maximumUsd)) return { kind: "unknown", reason: "Configured rates are too large to estimate safely." };
    return { kind: "api", plan: billing.name, tokens, minimumUsd, maximumUsd };
  }
  const windows: UsageWindow[] = ["five-hour", "weekly"];
  return { kind: "subscription", plan: billing.name, tokens, windows: windows.map((window) => {
    const percentages = billing.samples.filter((sample) => sample.window === window && sample.model === input.model)
      .map((sample) => tokens / sample.tokensUsed * sample.usedPercentagePoints);
    if (percentages.length === 0 || percentages.some((percentage) => !Number.isFinite(percentage))) return { kind: "unknown", window };
    return { kind: "calibrated", window, minimumPercent: percentages.reduce((minimum, value) => Math.min(minimum, value), Infinity), maximumPercent: percentages.reduce((maximum, value) => Math.max(maximum, value), 0), sampleCount: percentages.length };
  }) };
}
