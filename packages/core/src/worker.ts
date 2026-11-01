import type { ExecutionGrant } from "./index.js";

export interface WorkerCapabilities {
  readonly observe: true;
  readonly steer: boolean;
  readonly interrupt: boolean;
  readonly commandMediation: boolean;
  readonly writableRoot: "repository" | "requested-root";
}

export interface WorkerTask {
  readonly runId: string;
  readonly prompt: string;
  readonly repositoryRoot: string;
  readonly grant: ExecutionGrant;
}

export interface ExternalRunRef {
  readonly id: string;
}

export type WorkerStartResult =
  | { readonly kind: "not-started"; readonly reason: string }
  | { readonly kind: "started"; readonly ref: ExternalRunRef }
  | { readonly kind: "indeterminate"; readonly reason: string };

export type WorkerObservation =
  | { readonly kind: "message"; readonly text: string }
  | { readonly kind: "completed" }
  | { readonly kind: "failed"; readonly reason: string };

export type ObservedRunState =
  | { readonly kind: "running" }
  | { readonly kind: "completed" }
  | { readonly kind: "failed"; readonly reason: string }
  | { readonly kind: "unknown" };

export class UnsupportedWorkerOperation extends Error {
  constructor(operation: "steer" | "interrupt") {
    super(`Worker does not support ${operation}`);
    this.name = "UnsupportedWorkerOperation";
  }
}

export interface WorkerAdapter {
  capabilities(): Promise<WorkerCapabilities>;
  start(task: WorkerTask): Promise<WorkerStartResult>;
  observe(ref: ExternalRunRef): AsyncIterable<WorkerObservation>;
  steer(ref: ExternalRunRef, instruction: string): Promise<void>;
  interrupt(ref: ExternalRunRef): Promise<void>;
  inspect(ref: ExternalRunRef): Promise<ObservedRunState>;
}
