import type { BillingPlan } from "./costs.js";
import type { CodexExecutionContext } from "./provider-account-context.js";

export const FORECAST_POLICY = "execution-scenario-v1";
export const OBSERVATION_MAX_AGE_MS = 5 * 60_000;
export const SAMPLE_MAX_AGE_MS = 7 * 24 * 60 * 60_000;
export type ContextBand = "up-to-16KiB" | "up-to-64KiB" | "larger";
export type EffortProfile = { readonly kind: "named"; readonly effort: string } | { readonly kind: "default"; readonly configurationHash: string };
export interface RateProvenance {
  readonly provider: string;
  readonly model: string;
  readonly serviceTier: "default";
  readonly configuredAt: number | null;
  readonly expiresAt: number | null;
}
export interface CalibrationSample {
  readonly kind: "reviewed-v1";
  readonly sampleId: string;
  readonly provider: string;
  readonly accountHash: string;
  readonly plan: string;
  readonly model: string;
  readonly profile: EffortProfile;
  readonly serviceTier: "default";
  readonly contextMethod: "serialized-prompt-utf8-v1";
  readonly contextBand: ContextBand;
  readonly bucketId: string;
  readonly durationMins: number;
  readonly before: { readonly observedAt: number; readonly resetsAt: number; readonly usedPercent: number };
  readonly after: { readonly observedAt: number; readonly resetsAt: number; readonly usedPercent: number };
  readonly tokensUsed: number;
  readonly attribution: "reviewed-isolated";
  readonly provenance: string;
}
export type ForecastEstimate = { readonly kind: "unknown"; readonly reason: string }
  | { readonly kind: "api"; readonly minimumUsd: number; readonly maximumUsd: number; readonly rateStatus: "dated-configured" | "unverified-configured" }
  | { readonly kind: "subscription"; readonly windows: readonly ForecastWindow[] };
export type ForecastWindow = { readonly bucketId: string | null; readonly source: "primary" | "secondary"; readonly durationMins: number | null; readonly resetsAt: number | null } & (
  { readonly kind: "unknown"; readonly reason: string } | { readonly kind: "scenario"; readonly minimumPoints: number; readonly maximumPoints: number; readonly sampleIds: readonly string[] });
export type ExecutionForecast = { readonly kind: "legacy-unknown" } | {
  readonly kind: "configured-v1";
  readonly forecastId: string;
  readonly policyVersion: typeof FORECAST_POLICY;
  readonly createdAt: number;
  readonly validUntil: number;
  readonly configurationHash: string;
  readonly provider: string;
  readonly model: string;
  readonly authType: "apiKey" | "chatgpt" | "unknown";
  readonly route: "api" | "subscription" | "unknown";
  readonly accountHash: string | null;
  readonly planType: string | null;
  readonly profile: EffortProfile;
  readonly serviceTierForTurn: "default";
  readonly contextMethod: "serialized-prompt-utf8-v1";
  readonly contextBand: ContextBand;
  readonly promptBytes: number;
  readonly softTokenTarget: number;
  readonly attempts: 1;
  readonly observedAt: number;
  readonly estimate: ForecastEstimate;
  readonly rejectedSamples: readonly { readonly sampleId: string; readonly reason: string }[];
  readonly assumptions: readonly string[];
};
export type SpendingConsent = { readonly kind: "legacy-unconfirmed" } | {
  readonly kind: "native-uncertain-one-attempt";
  readonly forecastId: string;
  readonly configurationHash: string;
  readonly planId: string;
  readonly planRevision: number;
  readonly runId: string;
  readonly route: "api" | "subscription" | "unknown";
  readonly consentedAt: number;
};
export function contextBand(bytes: number): ContextBand { return bytes <= 16_384 ? "up-to-16KiB" : bytes <= 65_536 ? "up-to-64KiB" : "larger"; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function fields(value: unknown, names: readonly string[]): Record<string, unknown> {
  if (!record(value) || Object.keys(value).length !== names.length || Object.keys(value).some(key => !names.includes(key))) throw new Error("Invalid forecast contract"); return value;
}
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 512) throw new Error("Invalid forecast text"); return value; }
function number(value: unknown, min = 0): number { if (typeof value !== "number" || !Number.isFinite(value) || value < min) throw new Error("Invalid forecast number"); return value; }
function integer(value: unknown, min = 0): number { const result = number(value, min); if (!Number.isSafeInteger(result)) throw new Error("Invalid forecast integer"); return result; }
function hash(value: unknown): string { const result = text(value); if (!/^[a-f0-9]{64}$/.test(result)) throw new Error("Invalid forecast binding"); return result; }
function nullable<T>(value: unknown, parse: (value: unknown) => T): T | null { return value === null ? null : parse(value); }
function literal<T extends string>(value: unknown, choices: readonly T[]): T { const result = choices.find(choice => choice === value); if (result === undefined) throw new Error("Invalid forecast variant"); return result; }
function list<T>(value: unknown, parse: (value: unknown) => T): readonly T[] { if (!Array.isArray(value) || value.length > 100) throw new Error("Invalid forecast list"); return value.map((item: unknown) => parse(item)); }
function profile(value: unknown): EffortProfile {
  if (!record(value)) throw new Error("Invalid effort profile");
  if (value.kind === "named") { const row = fields(value, ["kind", "effort"]); return { kind: "named", effort: literal(row.effort, ["none", "minimal", "low", "medium", "high", "xhigh"]) }; }
  const row = fields(value, ["kind", "configurationHash"]); if (row.kind !== "default") throw new Error("Invalid effort profile"); return { kind: "default", configurationHash: hash(row.configurationHash) };
}
export function parseRateProvenance(value: unknown): RateProvenance {
  const row = fields(value, ["provider", "model", "serviceTier", "configuredAt", "expiresAt"]);
  const result = { provider: text(row.provider), model: text(row.model), serviceTier: literal(row.serviceTier, ["default"]), configuredAt: nullable(row.configuredAt, integer), expiresAt: nullable(row.expiresAt, integer) };
  if (result.expiresAt !== null && result.configuredAt !== null && result.expiresAt <= result.configuredAt) throw new Error("Invalid rate expiry"); return result;
}
function sampleObservation(value: unknown): CalibrationSample["before"] {
  const row = fields(value, ["observedAt", "resetsAt", "usedPercent"]); const usedPercent = number(row.usedPercent); if (usedPercent > 100) throw new Error("Invalid sample percentage");
  return { observedAt: integer(row.observedAt), resetsAt: integer(row.resetsAt), usedPercent };
}
export function parseCalibrationSample(value: unknown): CalibrationSample {
  const row = fields(value, ["kind", "sampleId", "provider", "accountHash", "plan", "model", "profile", "serviceTier", "contextMethod", "contextBand", "bucketId", "durationMins", "before", "after", "tokensUsed", "attribution", "provenance"]);
  return { kind: literal(row.kind, ["reviewed-v1"]), sampleId: text(row.sampleId), provider: text(row.provider), accountHash: hash(row.accountHash), plan: text(row.plan), model: text(row.model), profile: profile(row.profile), serviceTier: literal(row.serviceTier, ["default"]), contextMethod: literal(row.contextMethod, ["serialized-prompt-utf8-v1"]), contextBand: literal(row.contextBand, ["up-to-16KiB", "up-to-64KiB", "larger"]), bucketId: text(row.bucketId), durationMins: integer(row.durationMins, 1), before: sampleObservation(row.before), after: sampleObservation(row.after), tokensUsed: integer(row.tokensUsed, 1), attribution: literal(row.attribution, ["reviewed-isolated"]), provenance: text(row.provenance) };
}
function parseEstimate(value: unknown): ForecastEstimate {
  if (!record(value)) throw new Error("Invalid forecast estimate");
  if (value.kind === "unknown") { const row = fields(value, ["kind", "reason"]); return { kind: "unknown", reason: text(row.reason) }; }
  if (value.kind === "api") { const row = fields(value, ["kind", "minimumUsd", "maximumUsd", "rateStatus"]); const minimumUsd = number(row.minimumUsd); const maximumUsd = number(row.maximumUsd, minimumUsd); return { kind: "api", minimumUsd, maximumUsd, rateStatus: literal(row.rateStatus, ["dated-configured", "unverified-configured"]) }; }
  const row = fields(value, ["kind", "windows"]); if (row.kind !== "subscription") throw new Error("Invalid forecast estimate");
  return { kind: "subscription", windows: list(row.windows, item => {
    if (!record(item)) throw new Error("Invalid forecast window");
    const window = fields(item, item.kind === "unknown" ? ["bucketId", "source", "durationMins", "resetsAt", "kind", "reason"] : ["bucketId", "source", "durationMins", "resetsAt", "kind", "minimumPoints", "maximumPoints", "sampleIds"]);
    const base = { bucketId: nullable(window.bucketId, text), source: literal(window.source, ["primary", "secondary"]), durationMins: nullable(window.durationMins, value => integer(value, 1)), resetsAt: nullable(window.resetsAt, integer) };
    if (window.kind === "unknown") return { ...base, kind: "unknown", reason: text(window.reason) };
    if (window.kind !== "scenario") throw new Error("Invalid forecast window");
    const minimumPoints = number(window.minimumPoints, Number.MIN_VALUE); const sampleIds = list(window.sampleIds, text); if (!sampleIds.length || new Set(sampleIds).size !== sampleIds.length) throw new Error("Invalid sample references");
    return { ...base, kind: "scenario", minimumPoints, maximumPoints: number(window.maximumPoints, minimumPoints), sampleIds };
  }) };
}
export function parseExecutionForecast(value: unknown): ExecutionForecast {
  if (!record(value)) throw new Error("Invalid execution forecast");
  if (value.kind === "legacy-unknown") { fields(value, ["kind"]); return { kind: "legacy-unknown" }; }
  const row = fields(value, ["kind", "forecastId", "policyVersion", "createdAt", "validUntil", "configurationHash", "provider", "model", "authType", "route", "accountHash", "planType", "profile", "serviceTierForTurn", "contextMethod", "contextBand", "promptBytes", "softTokenTarget", "attempts", "observedAt", "estimate", "rejectedSamples", "assumptions"]);
  if (row.kind !== "configured-v1" || row.attempts !== 1) throw new Error("Invalid execution scenario");
  const createdAt = integer(row.createdAt); const promptBytes = integer(row.promptBytes);
  const result: ExecutionForecast = { kind: "configured-v1", forecastId: text(row.forecastId), policyVersion: literal(row.policyVersion, [FORECAST_POLICY]), createdAt, validUntil: integer(row.validUntil, createdAt + 1), configurationHash: hash(row.configurationHash), provider: text(row.provider), model: text(row.model), authType: literal(row.authType, ["apiKey", "chatgpt", "unknown"]), route: literal(row.route, ["api", "subscription", "unknown"]), accountHash: nullable(row.accountHash, hash), planType: nullable(row.planType, text), profile: profile(row.profile), serviceTierForTurn: literal(row.serviceTierForTurn, ["default"]), contextMethod: literal(row.contextMethod, ["serialized-prompt-utf8-v1"]), contextBand: literal(row.contextBand, ["up-to-16KiB", "up-to-64KiB", "larger"]), promptBytes, softTokenTarget: integer(row.softTokenTarget, 1), attempts: 1, observedAt: integer(row.observedAt), estimate: parseEstimate(row.estimate), rejectedSamples: list(row.rejectedSamples, item => { const rejection = fields(item, ["sampleId", "reason"]); return { sampleId: text(rejection.sampleId), reason: text(rejection.reason) }; }), assumptions: list(row.assumptions, text) };
  if (result.contextBand !== contextBand(promptBytes) || (result.route === "api" && result.authType !== "apiKey") || (result.route === "subscription" && result.authType !== "chatgpt") || result.observedAt > createdAt || result.validUntil > createdAt + OBSERVATION_MAX_AGE_MS) throw new Error("Inconsistent execution forecast");
  if ((result.estimate.kind === "api" && result.route !== "api") || (result.estimate.kind === "subscription" && result.route !== "subscription")) throw new Error("Mismatched forecast route"); return result;
}
export function parseSpendingConsent(value: unknown): SpendingConsent {
  if (record(value) && value.kind === "legacy-unconfirmed") { fields(value, ["kind"]); return { kind: "legacy-unconfirmed" }; }
  const row = fields(value, ["kind", "forecastId", "configurationHash", "planId", "planRevision", "runId", "route", "consentedAt"]);
  return { kind: literal(row.kind, ["native-uncertain-one-attempt"]), forecastId: text(row.forecastId), configurationHash: hash(row.configurationHash), planId: text(row.planId), planRevision: integer(row.planRevision, 1), runId: text(row.runId), route: literal(row.route, ["api", "subscription", "unknown"]), consentedAt: integer(row.consentedAt) };
}
export function consentMatches(consent: SpendingConsent | undefined, plan: { readonly planId: string; readonly recordedAtRevision: number; readonly forecast?: ExecutionForecast }, runId: string, now: number): boolean {
  const forecast = plan.forecast;
  return !!forecast && forecast.kind === "configured-v1" && consent?.kind === "native-uncertain-one-attempt" && consent.forecastId === forecast.forecastId && consent.configurationHash === forecast.configurationHash && consent.planId === plan.planId && consent.planRevision === plan.recordedAtRevision && consent.runId === runId && consent.route === forecast.route && consent.consentedAt >= forecast.createdAt && consent.consentedAt <= now && now < forecast.validUntil;
}
export function createExecutionForecast(input: { readonly forecastId: string; readonly now: number; readonly configurationHash: string; readonly provider: string; readonly model: string; readonly authType: "apiKey" | "chatgpt" | "unknown"; readonly billing: BillingPlan; readonly context: CodexExecutionContext; readonly promptBytes: number; readonly softTokenTarget: number; readonly profile: EffortProfile; readonly concurrentUsage: boolean }): ExecutionForecast {
  const { now, context, billing } = input;
  const observedAt = Date.parse(context.observedAt);
  const route = input.authType === "apiKey" ? "api" : input.authType === "chatgpt" ? "subscription" : "unknown";
  const rejectedSamples: { sampleId: string; reason: string }[] = [];
  const assumptions = ["One attempt at a soft token target; actual tokens, charges and remote completion may exceed this scenario. No monetary cap is enforced.", "Standard service tier explicitly requested with serviceTierForTurn=default; no pricing multiplier inferred.", "Observation freshness (5 minutes), sample age (7 days) and 0.5–2 token-ratio limits are Piarre policy, not provider guarantees."];
  let estimate: ForecastEstimate = { kind: "unknown", reason: "Configured billing does not match the observed authentication route." };
  const accountHash = context.facts?.accountHash ?? null;
  const planType = context.facts?.planType ?? null;
  let validUntil = now + OBSERVATION_MAX_AGE_MS;
  if (context.usage.kind === "observed") for (const window of context.usage.windows) if (window.resetsAt !== null && window.resetsAt * 1000 > now) validUntil = Math.min(validUntil, window.resetsAt * 1000);
  const fresh = Number.isFinite(observedAt) && observedAt <= now && now - observedAt <= OBSERVATION_MAX_AGE_MS;
  if (!fresh) estimate = { kind: "unknown", reason: "Account observation is stale or unavailable." };
  else if (route === "api" && billing.kind === "api") {
    const provenance = billing.provenance;
    if (provenance && (provenance.provider !== input.provider || provenance.model !== input.model || (provenance.configuredAt !== null && provenance.configuredAt > now))) estimate = { kind: "unknown", reason: "Configured rate provenance does not match this provider/model/profile." };
    else if (provenance?.expiresAt !== null && provenance?.expiresAt !== undefined && provenance.expiresAt <= now) estimate = { kind: "unknown", reason: "Configured rates have expired." };
    else {
      if (provenance?.expiresAt) validUntil = Math.min(validUntil, provenance.expiresAt);
      const minimumUsd = input.softTokenTarget / 1_000_000 * Math.min(billing.inputUsdPerMillion, billing.outputUsdPerMillion);
      const maximumUsd = input.softTokenTarget / 1_000_000 * Math.max(billing.inputUsdPerMillion, billing.outputUsdPerMillion);
      estimate = Number.isFinite(maximumUsd) && !(Math.min(billing.inputUsdPerMillion, billing.outputUsdPerMillion) > 0 && minimumUsd === 0) && !(Math.max(billing.inputUsdPerMillion, billing.outputUsdPerMillion) > 0 && maximumUsd === 0) ? { kind: "api", minimumUsd, maximumUsd, rateStatus: provenance?.configuredAt ? "dated-configured" : "unverified-configured" } : { kind: "unknown", reason: "Configured rates overflow or underflow safe arithmetic." };
      assumptions.push("Dollar amounts use user-configured input/output rates, not current provider-verified pricing. Configured zero rates do not establish free usage.");
    }
  } else if (route === "subscription" && billing.kind === "subscription") {
    estimate = { kind: "subscription", windows: context.usage.kind === "unknown" ? [] : context.usage.windows.map(window => {
      const bucketId = context.facts?.bucketId ?? null;
      const base = { bucketId, source: window.source, durationMins: window.windowDurationMins, resetsAt: window.resetsAt };
      const samples: { id: string; points: number }[] = [];
      for (const [index, sample] of billing.samples.entries()) {
        let reason = "";
        if (sample.kind !== "reviewed-v1") { rejectedSamples.push({ sampleId: `legacy:${String(index)}`, reason: "Historical sample lacks reviewed execution bindings." }); continue; }
        const ratio = input.softTokenTarget / sample.tokensUsed;
        if (input.concurrentUsage) reason = "Unconfirmed or concurrent account activity prevents attribution.";
        else if (!accountHash || sample.accountHash !== accountHash) reason = "Account identity is unavailable or changed.";
        else if (!planType || sample.plan !== planType || billing.name !== planType || sample.provider !== input.provider || sample.model !== input.model) reason = "Provider, plan or model differs.";
        else if (input.profile.kind === "default") reason = "Effective default effort cannot be verified; default-profile calibration requires a separately documented same-configuration binding.";
        else if (!context.modelProfiles?.some(profile => profile.model === input.model && profile.supportedEfforts.includes(input.profile.kind === "named" ? input.profile.effort : ""))) reason = "Requested effort is not supported by current model metadata.";
        else if (JSON.stringify(sample.profile) !== JSON.stringify(input.profile) || sample.contextBand !== contextBand(input.promptBytes)) reason = "Effort/default configuration or serialized context band differs.";
        else if (!bucketId || sample.bucketId !== bucketId || window.windowDurationMins === null || sample.durationMins !== window.windowDurationMins || window.resetsAt === null || window.resetsAt * 1000 <= now) reason = "Current bucket duration, identity or reset is unavailable or changed.";
        else if (sample.before.observedAt >= sample.after.observedAt || sample.after.observedAt > now || now - sample.after.observedAt > SAMPLE_MAX_AGE_MS || sample.before.resetsAt !== sample.after.resetsAt || sample.after.resetsAt * 1000 <= sample.after.observedAt) reason = "Sample is stale, unordered, future-dated or crosses a reset.";
        else if (sample.after.usedPercent <= sample.before.usedPercent) reason = "Sample consumption delta is not positive.";
        else if (ratio < 0.5 || ratio > 2) reason = "Token target/sample ratio is outside the disclosed 0.5–2 range.";
        if (reason) rejectedSamples.push({ sampleId: sample.sampleId, reason }); else samples.push({ id: sample.sampleId, points: ratio * (sample.after.usedPercent - sample.before.usedPercent) });
      }
      return samples.length ? { ...base, kind: "scenario", minimumPoints: Math.min(...samples.map(sample => sample.points)), maximumPoints: Math.max(...samples.map(sample => sample.points)), sampleIds: samples.map(sample => sample.id) } : { ...base, kind: "unknown", reason: "No eligible isolated calibration sample for this window/profile." };
    }) };
    assumptions.push("Projected percentage points are a limited linear scenario, not a confidence interval or remaining model tokens. Account observations are separate and may include other activity. Reviewed sample provenance and applicability are user-attested, not provider verification.");
  }
  return parseExecutionForecast({ kind: "configured-v1", forecastId: input.forecastId, policyVersion: FORECAST_POLICY, createdAt: now, validUntil, configurationHash: input.configurationHash, provider: input.provider, model: input.model, authType: input.authType, route, accountHash, planType, profile: input.profile, serviceTierForTurn: "default", contextMethod: "serialized-prompt-utf8-v1", contextBand: contextBand(input.promptBytes), promptBytes: input.promptBytes, softTokenTarget: input.softTokenTarget, attempts: 1, observedAt: Number.isFinite(observedAt) && observedAt <= now ? observedAt : now, estimate, rejectedSamples, assumptions });
}
const amount = (value: number): string => value > 0 && value < 0.0001 ? "< $0.0001" : `$${String(value)}`;
export function executionForecastText(forecast: ExecutionForecast | undefined): string {
  if (!forecast || forecast.kind === "legacy-unknown") return "Historical plan: execution forecast and spending consent unavailable. Prepare a new plan before starting.";
  const estimate = forecast.estimate;
  const scenario = estimate.kind === "unknown" ? `Cost scenario unknown: ${estimate.reason}` : estimate.kind === "api" ? `Configured API scenario: ${amount(estimate.minimumUsd)} to ${amount(estimate.maximumUsd)} (${estimate.rateStatus}).` : estimate.windows.map(window => `${window.source} bucket ${window.bucketId ?? "unknown"}; duration ${String(window.durationMins ?? "unknown")} minutes: ${window.kind === "unknown" ? `projected consumption unknown: ${window.reason}` : `${String(window.minimumPoints)} to ${String(window.maximumPoints)} percentage points; ${String(window.sampleIds.length)} reviewed sample(s), limited linear scenario`}`).join("; ") || "Subscription task consumption unknown: account windows unavailable.";
  return `Forecast ${forecast.forecastId}; ${forecast.route} route; requested ${forecast.provider}/${forecast.model}, standard tier, ${forecast.profile.kind === "named" ? forecast.profile.effort : "configuration-bound default"} effort. One attempt, ${String(forecast.softTokenTarget)} soft tokens; ${String(forecast.promptBytes)} serialized prompt bytes (${forecast.contextBand}). ${scenario} Created ${new Date(forecast.createdAt).toISOString()}; valid until ${new Date(forecast.validUntil).toISOString()}. ${forecast.assumptions.join(" ")} ${forecast.rejectedSamples.length ? `Excluded calibrations: ${forecast.rejectedSamples.map(sample => `${sample.sampleId}: ${sample.reason}`).join("; ")}` : ""}`;
}
