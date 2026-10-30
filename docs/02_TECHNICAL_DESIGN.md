# Technical design for Piarre v0.2

## System shape

```text
VS Code extension
  Work, Review, Decisions, Activity, voice controls
        |
        v
ProjectController
  proposal boundary, policy, state transitions, scheduling,
  reconciliation, evidence freshness
        |
        +--> event store and project projection
        +--> workspace adapter
        +--> capability-driven worker adapters
        +--> voice and interpreter adapters
```

The persistent project is the product spine. Voice and typed input use one command boundary. Models propose structured actions. Deterministic code owns authorization, revisions, dependency readiness, budgets, and evidence freshness.

## Core data shape

```ts
type TaskState =
  | { kind: "proposed"; planVersion: number }
  | { kind: "ready"; planVersion: number }
  | { kind: "running"; planVersion: number; runId: string }
  | { kind: "blocked"; reason: string }
  | { kind: "needs-approval"; requestId: string }
  | { kind: "needs-verification"; runId: string }
  | { kind: "needs-review"; evidenceId: string; workspaceRevision: string }
  | { kind: "accepted"; evidenceId: string; workspaceRevision: string }
  | { kind: "cancelled"; reconciliationId: string };

interface ProjectCommand {
  commandId: string;
  projectId: string;
  expectedProjectRevision: number;
  actor: "user" | "runtime" | "worker";
  action: ProjectAction;
}

interface Evidence {
  id: string;
  taskId: string;
  planVersion: number;
  workspaceRevision: string;
  kind: "diff" | "command" | "preview" | "artifact";
  outcome: "passed" | "failed" | "observed";
  capturedAt: string;
}
```

The event log is authoritative. A project snapshot is a projection. Every mutation carries the project revision it observed. Acceptance also binds the plan and workspace revisions.

## Public interfaces

```ts
interface ProjectController {
  openProject(input: OpenProject): Promise<ProjectSnapshot>;
  propose(input: CommandInput): Promise<Proposal>;
  review(input: ProposalDecision): Promise<ProjectSnapshot>;
  start(input: StartTask): Promise<Run>;
  dispatch(input: ProjectCommand): Promise<ProjectSnapshot>;
  prepareReview(input: ReviewTask): Promise<TaskReview>;
  accept(input: AcceptTask): Promise<ProjectSnapshot>;
}

interface WorkerAdapter {
  capabilities(): Promise<WorkerCapabilities>;
  start(input: WorkerTask): Promise<ExternalRunRef>;
  observe(ref: ExternalRunRef): AsyncIterable<WorkerObservation>;
  steer(ref: ExternalRunRef, instruction: WorkerInstruction): Promise<void>;
  interrupt(ref: ExternalRunRef): Promise<void>;
  inspect(ref: ExternalRunRef): Promise<ObservedRunState>;
}

interface VoiceAdapter {
  start(mode: "continuous" | "push-to-talk"): Promise<VoiceSession>;
  events(session: VoiceSession): AsyncIterable<VoiceEvent>;
  stopSpeaking(session: VoiceSession): Promise<void>;
  end(session: VoiceSession): Promise<void>;
}
```

External wire types are parsed at adapter boundaries. Core code branches on observed capabilities, not provider names. Unsupported controls stay hidden.

## Module map

```text
extension/
  activate.ts
  work-view.ts
  editor-adapter.ts

core/
  project-controller.ts
  project.ts
  policy.ts
  evidence.ts
  reconciliation.ts

ports/
  worker.ts
  interpreter.ts
  voice.ts
  store.ts

adapters/
  sqlite-store.ts
  codex-worker.ts
  mock-worker.ts
  openai-compatible-interpreter.ts
  local-interpreter.ts
  webview-voice.ts
```

Only the runtime appends project events. Workers propose or report observations. They never mutate task state directly.

## Safety invariants

- An untrusted model cannot grant authority, change task state, or accept evidence.
- No workspace write occurs without an approved plan, scope, and current revision.
- A worker claim is not verification evidence.
- A stop request is not a stopped run until worker and disk state are inspected.
- Stop speaking, Stop task, and Stop all are separate domain actions.
- P0 allows one writer. P1 separates write roots before adding concurrency.
- Evidence becomes stale when its plan or relevant workspace revision changes.
- Replayed commands and scheduler passes converge without duplicate effects.

## Persistence and recovery

SQLite stores events and rebuildable projections. Persist an event before acknowledging durable state. After restart, mark previously active runs unknown, inspect worker and workspace state, then append reconciliation results. Never repeat an external action solely because its acknowledgement was lost.

## Voice and local models

Voice capture starts only after an explicit user action and keeps microphone state visible. Mock voice verifies lifecycle and routing, not recognition quality. Hosted and local interpreters emit the same untrusted proposal schema. OpenAI-compatible transport is adapter-specific evidence, not a universal voice contract.

## Delivery architecture

The implementation sequence is defined by `docs/03_IMPLEMENTATION_BACKLOG.md`. B15 gates the supervised-writer release. Every P1 story transitively depends on B15. Read-only concurrency precedes isolated coding workers. Integration into the primary workspace always creates a review and fresh verification step.
