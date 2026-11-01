import type {
  CommandResult,
  ExecutionGrant,
  ProjectSnapshot,
} from "../../../packages/core/src/index.js";
import { ownsWriter } from "../../../packages/core/src/index.js";
import type {
  ExternalRunRef,
  WorkerAdapter,
  WorkerCapabilities,
  WorkerTask,
} from "../../../packages/core/src/worker.js";
import type { SqliteProjectRepository } from "./sqlite-project-repository.js";

export type StartTaskResult =
  | { readonly kind: "started"; readonly ref: ExternalRunRef }
  | {
      readonly kind:
        | "writer-busy"
        | "not-started"
        | "indeterminate"
        | "unsupported-capabilities";
    }
  | { readonly kind: "rejected"; readonly result: CommandResult };

export interface DeadlineScheduler {
  schedule(input: {
    readonly milliseconds: number;
    readonly expire: () => Promise<void>;
  }): () => void;
}

const systemDeadlineScheduler: DeadlineScheduler = {
  schedule: ({ milliseconds, expire }) => {
    const timer = setTimeout(() => void expire(), milliseconds);
    timer.unref();
    return () => {
      clearTimeout(timer);
    };
  },
};

export class TaskRunner {
  constructor(
    private readonly repository: SqliteProjectRepository,
    private readonly worker: WorkerAdapter,
    private readonly deadlines: DeadlineScheduler = systemDeadlineScheduler,
  ) {}

  private readonly cancelDeadline = new Map<string, () => void>();

  async startTask(input: {
    readonly taskId: string;
    readonly approvalId: string;
    readonly runId: string;
    readonly adapterId: string;
    readonly prompt: string;
    readonly reservationCommandId: string;
    readonly terminalCommandId: string;
    readonly bindCommandId: string;
  }): Promise<StartTaskResult> {
    const before = this.repository.read();
    const grant = before.grants.find(
      ({ approvalId }) => approvalId === input.approvalId,
    );
    if (!grant) return { kind: "rejected", result: { kind: "approval-stale" } };
    const capabilities = await this.worker.capabilities();
    if (!this.canEnforceGrant(capabilities, grant))
      return { kind: "unsupported-capabilities" };
    const reservation = this.repository.dispatch({
      commandId: input.reservationCommandId,
      projectId: before.projectId,
      expectedProjectRevision: before.revision,
      action: {
        kind: "reserve-run",
        runId: input.runId,
        taskId: input.taskId,
        approvalId: input.approvalId,
        adapterId: input.adapterId,
      },
    });
    if (
      reservation.kind === "writer-busy" ||
      (reservation.kind === "stale" && this.repository.read().runs.some(ownsWriter))
    )
      return { kind: "writer-busy" };
    if (reservation.kind !== "applied" && reservation.kind !== "duplicate")
      return { kind: "rejected", result: reservation };

    const start = await this.worker.start(this.workerTask(input, grant));
    if (start.kind === "not-started") {
      this.finishRun({
        snapshot: this.repository.read(),
        commandId: input.terminalCommandId,
        runId: input.runId,
        outcome: "failed",
      });
      return { kind: "not-started" };
    }
    if (start.kind === "indeterminate") {
      this.finishRun({
        snapshot: this.repository.read(),
        commandId: input.terminalCommandId,
        runId: input.runId,
        outcome: "reconciliation-required",
      });
      return { kind: "indeterminate" };
    }
    const bound = this.repository.dispatch({
      commandId: input.bindCommandId,
      projectId: before.projectId,
      expectedProjectRevision: this.repository.read().revision,
      action: {
        kind: "bind-run",
        runId: input.runId,
        externalRunId: start.ref.id,
      },
    });
    if (bound.kind !== "applied" && bound.kind !== "duplicate") {
      this.finishRun({
        snapshot: this.repository.read(),
        commandId: input.terminalCommandId,
        runId: input.runId,
        outcome: "reconciliation-required",
      });
      return { kind: "indeterminate" };
    }
    this.cancelDeadline.set(
      input.runId,
      this.deadlines.schedule({
        milliseconds: grant.budget.maxElapsedMinutes * 60_000,
        expire: () => this.expireRun(input.runId, start.ref, capabilities),
      }),
    );
    return { kind: "started", ref: start.ref };
  }

  async settle(input: {
    readonly runId: string;
    readonly ref: ExternalRunRef;
    readonly commandId: string;
  }): Promise<CommandResult> {
    const observed = await this.worker.inspect(input.ref);
    if (observed.kind === "running") return { kind: "run-not-active" };
    this.cancelDeadline.get(input.runId)?.();
    this.cancelDeadline.delete(input.runId);
    const snapshot = this.repository.read();
    return this.finishRun({
      snapshot,
      commandId: input.commandId,
      runId: input.runId,
      outcome:
        observed.kind === "unknown"
          ? "reconciliation-required"
          : observed.kind,
    });
  }

  private canEnforceGrant(
    capabilities: WorkerCapabilities,
    grant: ExecutionGrant,
  ): boolean {
    return (
      capabilities.commandMediation &&
      (capabilities.writableRoot === "requested-root" ||
        grant.writableRoot === grant.repositoryRoot)
    );
  }

  private async expireRun(
    runId: string,
    ref: ExternalRunRef,
    capabilities: WorkerCapabilities,
  ): Promise<void> {
    this.cancelDeadline.delete(runId);
    if (capabilities.interrupt) {
      try {
        await this.worker.interrupt(ref);
      } catch {
        this.finishExpiredRun(runId, "reconciliation-required");
        return;
      }
    }
    let outcome: "completed" | "failed" | "reconciliation-required";
    try {
      const observed = await this.worker.inspect(ref);
      outcome =
        observed.kind === "completed" || observed.kind === "failed"
          ? observed.kind
          : "reconciliation-required";
    } catch {
      outcome = "reconciliation-required";
    }
    this.finishExpiredRun(runId, outcome);
  }

  private finishExpiredRun(
    runId: string,
    outcome: "completed" | "failed" | "reconciliation-required",
  ): void {
    this.finishRun({
      snapshot: this.repository.read(),
      commandId: `deadline:${runId}`,
      runId,
      outcome,
    });
  }

  private workerTask(
    input: { readonly runId: string; readonly prompt: string },
    grant: ExecutionGrant,
  ): WorkerTask {
    return {
      runId: input.runId,
      prompt: input.prompt,
      repositoryRoot: grant.repositoryRoot,
      grant,
    };
  }

  private finishRun(input: {
    readonly snapshot: ProjectSnapshot;
    readonly commandId: string;
    readonly runId: string;
    readonly outcome: "completed" | "failed" | "reconciliation-required";
  }): CommandResult {
    return this.repository.dispatch({
      commandId: input.commandId,
      projectId: input.snapshot.projectId,
      expectedProjectRevision: input.snapshot.revision,
      action: {
        kind: "finish-run",
        runId: input.runId,
        outcome: input.outcome,
      },
    });
  }
}
