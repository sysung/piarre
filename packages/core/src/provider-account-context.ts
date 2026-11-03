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
  readonly modelProfiles?: readonly { readonly model: string; readonly defaultEffort: string; readonly supportedEfforts: readonly string[] }[];
  readonly authType?: "chatgpt" | "apiKey" | "unknown";
  readonly facts?: { readonly accountHash: string | null; readonly planType: string | null; readonly bucketId: string | null; readonly ordinaryUsageAllowed: boolean | null };
};
export type CodexThreadMetadata = { readonly model: string | null; readonly modelProvider: string | null; readonly reasoningEffort?: string | null; readonly serviceTier?: string | null };

