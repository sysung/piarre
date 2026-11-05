import { relationshipDecision, relationshipKnowledgeCurrent, relationshipText } from "./knowledge-relationships.js";
import { currentKnowledge } from "./knowledge.js";
import { parseBillingPlan, type BillingPlan } from "./costs.js";
import type { ProjectSnapshot, RecordedProposalGroup } from "./index.js";

export type RecordReference = {
  readonly projectId: ProjectSnapshot["projectId"];
  readonly kind: "proposal" | "task" | "knowledge" | "assignment" | "relationship";
  readonly recordId: string;
  readonly revision: number;
};

export type ReferenceResolution =
  | { readonly kind: "resolved"; readonly text: string; readonly source: "deterministic-draft" | "user-statement" | "recorded-assignment" }
  | { readonly kind: "wrong-project" | "missing" | "stale" };

export function resolveRecordReference(
  project: ProjectSnapshot,
  reference: RecordReference,
): ReferenceResolution {
  if (reference.projectId !== project.projectId) return { kind: "wrong-project" };
  if (reference.kind === "relationship") {
    const relationship = project.knowledgeRelationships.proposals.find(item => item.relationshipId === reference.recordId);
    if (!relationship) return { kind: "missing" };
    const decision = relationshipDecision(project, relationship.relationshipId);
    if (relationship.recordedAtRevision !== reference.revision || decision?.kind !== "adopted" || !relationshipKnowledgeCurrent(project, relationship)) return { kind: "stale" };
    return { kind: "resolved", text: relationshipText(project, relationship), source: "user-statement" };
  }
  if (reference.kind === "knowledge") {
    const entry = currentKnowledge(project).find(item => item.knowledgeId === reference.recordId);
    if (!entry) return { kind: "missing" };
    if (entry.recordedAtRevision !== reference.revision) return { kind: "stale" };
    return { kind: "resolved", text: entry.content.text, source: "user-statement" };
  }
  if (reference.kind === "assignment") {
    const group = project.coordination.groups.find(item => item.assignments.some(worker => worker.assignmentId === reference.recordId));
    const worker = group?.assignments.find(item => item.assignmentId === reference.recordId);
    if (!group || !worker) return { kind: "missing" };
    if (reference.revision !== group.preparedAtRevision) return { kind: "stale" };
    return { kind: "resolved", source: "recorded-assignment",
      text: `Recorded ${worker.role} assignment
Purpose: ${worker.purpose}
Scope: ${worker.scope}
Requested model: ${worker.requestedModel}
Read-only reference. No authority to invoke or steer this assignment.` };
  }
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
  readonly billing: BillingPlan;
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
        (Object.keys(item).length !== 3 && Object.keys(item).length !== 4) ||
        !Object.keys(item).every((key) => ["role", "provider", "model", "billing"].includes(key)) ||
        !("role" in item) || !("provider" in item) || !("model" in item) ||
        !isRole(item.role) || !identifier(item.provider) || !identifier(item.model) || roles.has(item.role))
      return { kind: "invalid" };
    const billing = parseBillingPlan("billing" in item ? item.billing : undefined);
    if (!billing) return { kind: "invalid" };
    roles.add(item.role);
    selections.push({ role: item.role, provider: item.provider, model: item.model, billing });
  }
  return { kind: "valid", selections };
}

export interface RecommendationEntry {
  readonly kind: "submitted-goal" | "proposed-task" | "knowledge";
  readonly reference: RecordReference;
  readonly text: string;
  readonly source: "deterministic-draft" | "user-statement" | "recorded-assignment";
}
export interface ProjectInspection {
  readonly recommendation: readonly RecommendationEntry[];
  readonly policy: {
    readonly memory: "manual-observations-only";
    readonly confirmedMemory: "explicit-memory-review-required";
    readonly spending: "per-operation-approval-required-not-implemented";
    readonly disclosure: "explicit-conversation-disclosure";
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
  const recommendation: RecommendationEntry[] = [];
  for (const proposal of project.proposals) {
    recommendation.push({ kind: "submitted-goal", text: proposal.goal, source: proposal.source,
      reference: { projectId: project.projectId, kind: "proposal",
        recordId: proposal.groupId, revision: proposal.recordedAtRevision } });
    for (const taskId of proposal.taskIds) {
      const reference: RecordReference = { projectId: project.projectId,
        kind: "task", recordId: taskId, revision: proposal.recordedAtRevision };
      const resolved = resolveRecordReference(project, reference);
      if (resolved.kind !== "resolved") throw new Error("Invalid project inspection: unresolved task");
      recommendation.push({ kind: "proposed-task", reference, text: resolved.text, source: resolved.source });
    }
  }
  for (const entry of currentKnowledge(project)) {
    recommendation.push({ kind: "knowledge", text: entry.content.text, source: "user-statement",
      reference: { projectId: project.projectId, kind: "knowledge", recordId: entry.knowledgeId, revision: entry.recordedAtRevision } });
  }
  return {
    recommendation,
    policy: {
      memory: "manual-observations-only",
      confirmedMemory: "explicit-memory-review-required",
      spending: "per-operation-approval-required-not-implemented",
      disclosure: "explicit-conversation-disclosure",
      execution: "unsupported",
    },
    providers: providerRoles.map((role) => {
      if (configuration.kind === "invalid") return { role, status: "invalid-configuration" };
      const selection = configuration.selections.find((item) => item.role === role);
      return selection ? { role, status: "unsupported", selection } : { role, status: "not-configured" };
    }),
  };
}
