import {
  UnsupportedWorkerOperation,
  type ExternalRunRef,
  type ObservedRunState,
  type WorkerAdapter,
  type WorkerCapabilities,
  type WorkerObservation,
  type WorkerStartResult,
  type WorkerTask,
} from "../../../packages/core/src/worker.js";

export interface MockWorkerScript {
  readonly capabilities?: Partial<WorkerCapabilities>;
  readonly start?: (task: WorkerTask) => WorkerStartResult;
  readonly observations?: readonly WorkerObservation[];
  readonly inspected?: ObservedRunState;
}

export class MockWorker implements WorkerAdapter {
  readonly starts: WorkerTask[] = [];
  readonly steers: string[] = [];
  readonly observedRefs: ExternalRunRef[] = [];
  readonly steeredRefs: ExternalRunRef[] = [];
  readonly interruptedRefs: ExternalRunRef[] = [];
  readonly inspectedRefs: ExternalRunRef[] = [];
  interrupts = 0;
  private readonly externalRuns = new Set<string>();

  constructor(private readonly script: MockWorkerScript = {}) {}

  capabilities(): Promise<WorkerCapabilities> {
    return Promise.resolve({
      observe: true,
      steer: false,
      interrupt: false,
      commandMediation: true,
      writableRoot: "repository",
      ...this.script.capabilities,
    });
  }

  start(task: WorkerTask): Promise<WorkerStartResult> {
    this.starts.push(task);
    const result = this.script.start?.(task) ?? {
        kind: "started",
        ref: { id: `external:${task.runId}` },
      };
    if (result.kind === "started") this.externalRuns.add(result.ref.id);
    return Promise.resolve(result);
  }

  async *observe(ref: ExternalRunRef): AsyncIterable<WorkerObservation> {
    this.observedRefs.push(ref);
    await Promise.resolve();
    for (const observation of this.script.observations ?? []) yield observation;
  }

  async steer(ref: ExternalRunRef, instruction: string): Promise<void> {
    if (!(await this.capabilities()).steer)
      throw new UnsupportedWorkerOperation("steer");
    this.steers.push(instruction);
    this.steeredRefs.push(ref);
  }

  async interrupt(ref: ExternalRunRef): Promise<void> {
    if (!(await this.capabilities()).interrupt)
      throw new UnsupportedWorkerOperation("interrupt");
    this.interrupts += 1;
    this.interruptedRefs.push(ref);
  }

  inspect(ref: ExternalRunRef): Promise<ObservedRunState> {
    this.inspectedRefs.push(ref);
    if (!this.externalRuns.has(ref.id)) return Promise.resolve({ kind: "unknown" });
    return Promise.resolve(this.script.inspected ?? { kind: "running" });
  }
}
