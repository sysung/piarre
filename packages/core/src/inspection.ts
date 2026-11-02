import type { ProjectSnapshot, RecordedProposalGroup } from "./index.js";

export type RecordReference = {
  readonly projectId: ProjectSnapshot["projectId"];
  readonly kind: "proposal" | "task";
  readonly recordId: string;
  readonly revision: number;
};

export type ReferenceResolution =
  | { readonly kind: "resolved"; readonly text: string; readonly source: "deterministic-draft" }
  | { readonly kind: "wrong-project" | "missing" | "stale" };

export function resolveRecordReference(
  project: ProjectSnapshot,
  reference: RecordReference,
): ReferenceResolution {
  if (reference.projectId !== project.projectId) return { kind: "wrong-project" };
  let proposal: RecordedProposalGroup | undefined;
  let text: string | undefined;
  if (reference.kind === "proposal") {
    proposal = project.proposals.find(({ groupId }) => groupId === reference.recordId);
    text = proposal?.goal;
  } else {
    const task = project.tasks.find(({ taskId }) => taskId === reference.recordId);
    proposal = project.proposals.find(({ groupId }) => groupId === task?.groupId);
    text = task?.title;
  }
  if (!proposal || text === undefined) return { kind: "missing" };
  if (reference.revision !== proposal.recordedAtRevision) return { kind: "stale" };
  return { kind: "resolved", text, source: proposal.source };
}

export const providerRoles: readonly ProviderRole[] = [
  "conversation", "coding", "speech-input", "speech-output",
];
export type ProviderRole = "conversation" | "coding" | "speech-input" | "speech-output";
export interface ProviderSelection {
  readonly role: ProviderRole;
  readonly provider: string;
  readonly model: string;
}
export type ProviderConfiguration =
  | { readonly kind: "valid"; readonly selections: readonly ProviderSelection[] }
  | { readonly kind: "invalid" };

function isRole(value: unknown): value is ProviderRole {
  return typeof value === "string" && providerRoles.some((role) => role === value);
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(value);
}

export function parseProviderConfiguration(value: unknown): ProviderConfiguration {
  if (!Array.isArray(value)) return { kind: "invalid" };
  const selections: ProviderSelection[] = [];
  const roles = new Set<ProviderRole>();
  const items: readonly unknown[] = value;
  for (const item of items) {
    if (typeof item !== "object" || item === null || Array.isArray(item) ||
        Object.keys(item).length !== 3 ||
        !Object.keys(item).every((key) => ["role", "provider", "model"].includes(key)) ||
        !("role" in item) || !("provider" in item) || !("model" in item) ||
        !isRole(item.role) || !identifier(item.provider) || !identifier(item.model) || roles.has(item.role))
      return { kind: "invalid" };
    roles.add(item.role);
    selections.push({ role: item.role, provider: item.provider, model: item.model });
  }
  return { kind: "valid", selections };
}

export interface BasisEntry {
  readonly kind: "submitted-goal" | "proposed-task";
  readonly reference: RecordReference;
  readonly text: string;
  readonly source: "deterministic-draft";
}
export interface ProjectInspection {
  readonly basis: readonly BasisEntry[];
  readonly policy: {
    readonly memory: "automatic-capture-disabled-policy-unresolved";
    readonly confirmedMemory: "explicit-approval-required-not-implemented";
    readonly spending: "per-operation-approval-required-not-implemented";
    readonly disclosure: "local-only-no-external-adapter";
    readonly execution: "unsupported";
  };
  readonly providers: readonly (
    | { readonly role: ProviderRole; readonly status: "unsupported"; readonly selection: ProviderSelection }
    | { readonly role: ProviderRole; readonly status: "not-configured" | "invalid-configuration" }
  )[];
}

export function inspectProject(
  project: ProjectSnapshot,
  configuration: ProviderConfiguration = { kind: "valid", selections: [] },
): ProjectInspection {
  const basis: BasisEntry[] = [];
  for (const proposal of project.proposals) {
    basis.push({ kind: "submitted-goal", text: proposal.goal, source: proposal.source,
      reference: { projectId: project.projectId, kind: "proposal",
        recordId: proposal.groupId, revision: proposal.recordedAtRevision } });
    for (const taskId of proposal.taskIds) {
      const reference: RecordReference = { projectId: project.projectId,
        kind: "task", recordId: taskId, revision: proposal.recordedAtRevision };
      const resolved = resolveRecordReference(project, reference);
      if (resolved.kind !== "resolved") throw new Error("Invalid project inspection: unresolved task");
      basis.push({ kind: "proposed-task", reference, text: resolved.text, source: resolved.source });
    }
  }
  return {
    basis,
    policy: {
      memory: "automatic-capture-disabled-policy-unresolved",
      confirmedMemory: "explicit-approval-required-not-implemented",
      spending: "per-operation-approval-required-not-implemented",
      disclosure: "local-only-no-external-adapter",
      execution: "unsupported",
    },
    providers: providerRoles.map((role) => {
      if (configuration.kind === "invalid") return { role, status: "invalid-configuration" };
      const selection = configuration.selections.find((item) => item.role === role);
      return selection ? { role, status: "unsupported", selection } : { role, status: "not-configured" };
    }),
  };
}
