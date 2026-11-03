import type { ExecutionRun } from "./execution.js";
export type RecoveryTarget = "source" | "candidate";
export type RecoverySelection =
  | { readonly kind: "journal"; readonly target: RecoveryTarget; readonly operationId: string }
  | { readonly kind: "snapshot"; readonly target: RecoveryTarget; readonly versionId: string };
export interface SavedVersion {
  readonly versionId: string;
  readonly target: RecoveryTarget;
  readonly purpose: "baseline" | "before-integration" | "preserved-before-restore" | "preserved-before-recovery" | "retained-entry";
  readonly checkpointId: string;
  readonly operationId: string;
  readonly manifestHash: string;
  readonly captureHash: string;
  readonly createdAt: number | null;
}
export interface RecoveryRequest {
  readonly previewId: string;
  readonly projectRevision: number;
  readonly selection: RecoverySelection;
  readonly bindingHash: string;
  readonly parentIdentityHash: string;
  readonly expectedManifestHash: string;
  readonly targetManifestHash: string;
  readonly intendedPaths: readonly string[];
  readonly reviewedAt: number;
  readonly ownerId: string;
  readonly ownerPid: number;
}
export interface RecoveryRecord extends RecoveryRequest {
  readonly operationId: string;
  readonly supersedes: string | null;
  readonly state: { readonly kind: "writing" } | { readonly kind: "unknown"; readonly reason: string } | { readonly kind: "completed"; readonly observedAt: number } | { readonly kind: "superseded"; readonly successorId: string };
}
export type RecoveryAction =
  | { readonly kind: "register-retained-version"; readonly runId: string; readonly target: RecoveryTarget; readonly originOperationId: string; readonly relativePath: string; readonly manifestHash: string; readonly observedAt: number }
  | { readonly kind: "begin-recovery"; readonly runId: string; readonly request: RecoveryRequest }
  | { readonly kind: "finish-recovery"; readonly runId: string; readonly operationId: string; readonly manifestHash: string; readonly observedAt: number }
  | { readonly kind: "mark-recovery-unknown"; readonly runId: string; readonly operationId: string; readonly reason: string };
export function activeRecovery(run: ExecutionRun): RecoveryRecord | undefined { return run.recoveries.filter(record => record.state.kind === "writing" || record.state.kind === "unknown").at(-1); }
export function supersededOperation(run: ExecutionRun, operationId: string): boolean { return run.recoveries.some(record => record.supersedes === operationId); }

export function unresolvedRecoveryOperation(run: ExecutionRun): { readonly operationId: string; readonly target: RecoveryTarget } | undefined {
  const recovery = activeRecovery(run);
  if (recovery) return { operationId: recovery.operationId, target: recovery.selection.target };
  if (run.workspace.kind === "writing" || run.workspace.kind === "unknown") return { operationId: run.workspace.operationId, target: run.workspace.request.kind === "restore" ? run.workspace.request.target : "source" };
  if (run.state.kind === "unknown") return { operationId: `patch:${run.runId}`, target: "candidate" };
  return undefined;
}
