/** Public app-server metadata only. Never retain raw account/config/error payloads. */
export type CodexDefaultModel = { readonly kind: "resolved-default"; readonly model: string } | { readonly kind: "unknown" };
export type CodexUsageWindow = {
  readonly source: "primary" | "secondary";
  readonly usedPercent: number;
  readonly windowDurationMins: number | null;
  readonly resetsAt: number | null;
};
export type CodexObservedUsage =
  | { readonly kind: "observed"; readonly source: "account/rateLimits/read"; readonly windows: readonly CodexUsageWindow[] }
  | { readonly kind: "unknown" };
export type CodexExecutionContext = {
  readonly observedAt: string;
  readonly model: CodexDefaultModel;
  readonly usage: CodexObservedUsage;
  readonly taskForecast: { readonly kind: "unknown" };
};
export type CodexThreadMetadata = { readonly model: string | null; readonly modelProvider: string | null };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function publicModelIdentifier(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(value) ? value : null;
}

/** Mirrors ModelListResponse's public selection fields; descriptions/config are discarded. */
export function parseDefaultModel(pages: readonly unknown[], complete: boolean): CodexDefaultModel {
  if (!complete) return { kind: "unknown" };
  const defaults: string[] = [];
  for (const page of pages) {
    if (!record(page) || !Array.isArray(page.data) || page.data.length > 100) return { kind: "unknown" };
    for (const row of page.data) {
      if (!record(row) || typeof row.isDefault !== "boolean") return { kind: "unknown" };
      if (row.isDefault) {
        const model = publicModelIdentifier(row.model);
        if (!model) return { kind: "unknown" };
        defaults.push(model);
      }
    }
  }
  return defaults.length === 1 && defaults[0] !== undefined ? { kind: "resolved-default", model: defaults[0] } : { kind: "unknown" };
}

function nullableInteger(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : undefined;
}

/** Historical single-bucket view only; never merge model-specific buckets into it. */
export function parseObservedUsage(value: unknown): CodexObservedUsage {
  if (!record(value) || !record(value.rateLimits)) return { kind: "unknown" };
  const windows: CodexUsageWindow[] = [];
  for (const source of ["primary", "secondary"] as const) {
    const window = value.rateLimits[source];
    if (window === undefined || window === null) continue;
    if (!record(window)) return { kind: "unknown" };
    const usedPercent = nullableInteger(window.usedPercent, 0, 100);
    const windowDurationMins = nullableInteger(window.windowDurationMins, 1);
    // Unix seconds; values must remain representable as a JavaScript date.
    const resetsAt = nullableInteger(window.resetsAt, 0, 8_640_000_000_000);
    if (usedPercent === null || usedPercent === undefined || windowDurationMins === undefined || resetsAt === undefined) return { kind: "unknown" };
    windows.push({ source, usedPercent, windowDurationMins, resetsAt });
  }
  return windows.length ? { kind: "observed", source: "account/rateLimits/read", windows } : { kind: "unknown" };
}

export function parseThreadMetadata(value: unknown): CodexThreadMetadata {
  return record(value) ? { model: publicModelIdentifier(value.model), modelProvider: publicModelIdentifier(value.modelProvider) } : { model: null, modelProvider: null };
}
