# Piarre technical design

Status: Target architecture. This document defines lasting contracts; GitHub issues record implementation progress.

## Ownership and data

The VS Code extension presents conversation and project inspection. An editor-neutral core owns the project model. Adapters connect storage, workspaces, conversational providers, coding workers, and optional voice.

The ProjectController validates proposals and owns authorization, task transitions, dependency readiness, scheduling, budgets, reconciliation, and evidence freshness. Only the runtime appends domain events. Workers report observations or propose actions.

SQLite events are authoritative for tasks, runs, approvals, and execution evidence. Snapshots are rebuildable projections. Persist events before acknowledging durable changes. Commands carry an identifier and expected project revision. Replay and retries must not duplicate external effects.

The domain includes Project, Goal, Requirement, Plan, Task, Worker, Run, Approval, Budget, Decision, Evidence, Workflow, and Session. Knowledge, Basis records, linked threads, council assignments, reflection proposals, checkpoints, provisional drafts, and test bundles extend this model. Define small typed contracts before separate UI and persistence paths diverge.

Human-readable knowledge and decision files are possible, but their authority, import, revision, and conflict rules must be explicit. Do not create competing authoritative copies. Missing or invalid files must remain distinguishable from empty knowledge.

## UI and interaction

Conversation and inspection reference the same durable objects. Proposed, applied, running, unknown, failed, stale, and accepted states must be distinguishable without reading logs. Deferred tasks remain discoverable. Priority and agenda disposition are separate from execution state.

Prototype layout and question formats before choosing them. Preserve keyboard access, visible transcripts, screen-reader state, and non-color status cues. Detailed artifacts open on demand without repeatedly changing focus.

Keep conversation and deterministic stop controls responsive while workers run. Emit concise progress from observed state changes, deduplicate unchanged status, and defer nonessential speech while the user is still talking. Explanation depth is a visible, correctable preference.

Voice input and speech output use separate adapters. Both voice and typed interpretation enter the same untrusted-proposal boundary. Separate mute microphone, stop speaking, stop task, and stop all. Hide unsupported suspension controls rather than labeling interruption as pause.

Turn-taking must support hesitation, correction, and explicit completion. Push to talk, adjustable endpoint timing, and transcript correction are candidate controls. Typed tests cannot prove speech quality or intent detection.

## Memory and recommendations

Knowledge records need identity, content, sources, confirmation state, revisions, supersession, and affected-work links. Observed, inferred, confirmed, disputed, invalid, and stale states must not collapse into a single remembered fact.

Retrieve a bounded set of relevant records for each request. Distinguish retrieval failure from no matching record. Basis links exact supporting sources and revisions and exposes unconfirmed premises. Test whether sources support the answer, not merely whether links render.

Approved corrections invalidate affected plans and evidence while preserving unrelated work. Contradictory confirmed sources need a visible resolution proposal. Reflection and repeated interactions cannot silently grant authority or confirm requirements.

## Execution and approval

Task state differs from run state. A finished run can leave a task needing verification or review. Preserve Proposed, Ready, Running, Blocked, Needs approval, Needs verification, Needs review, Accepted, and Cancelled states with explicit transitions.

Approvals bind concrete scope, relevant plan and workspace revisions, duration, and spending or disclosure authority. Material changes invalidate affected approvals. Repository content, transcripts, tool output, and worker messages cannot change policy.

Worker adapters expose observed capabilities for start, status, steering, interruption, and inspection. Parse wire data at adapter boundaries. One writer owns the workspace. Parallel writers require separate write roots and reviewed integration.

Separate observed usage, provider estimates, and application estimates. Reject spending without applicable authority. Stop new scheduling at enforceable limits while preserving honest active-run state. Never promise a hard cap unsupported by the provider.

## Preparation, threads, and council

Provisional preparation belongs to a project, thread, input revision, context revision, cancellation state, and resource allowance. It accepts submitted input or explicitly enabled streams. It cannot confirm knowledge, apply plans, start writers, or cause unapproved spending or disclosure.

Changed intent cancels or supersedes old preparation. Late results are rejected. Adopting a draft requires validation against final intent. Cancellation cannot undo prior external effects, so prevent those effects rather than promise rollback.

Linked threads preserve parent relationships, scoped context, and return points. Findings merge through explicit proposals. Conversation concurrency does not grant write concurrency.

Council assignments need bounded purpose, context, permissions, provider, resource limits, and available controls. Synthesis retains disagreements and source quality. Agent failure or cancellation must remain visible. Explanations and available traces must not be presented as hidden model reasoning.

## Recovery and checkpoints

A stop request remains pending until worker and disk state are inspected. Stop all also prevents new scheduling. Cancellation preserves partial changes and does not imply rollback.

After restart or provider failure, mark uncertain activity unknown and reconcile before replacement execution. Lost acknowledgments must not repeat external actions. Detect manual edits and block conflicting acceptance instead of overwriting them.

Checkpoints record included scope, revision, and exclusions. Restore previews differences, reconciles active writers, checks newer edits and untracked files, and obtains approval before destructive replacement. Preserve current work recoverably before a supported restore.

A restore is a new auditable operation. It invalidates affected evidence and reconciles task/run state. Repository restoration does not automatically rewrite confirmed memory, revive approvals, reverse external services, or refund charges. Test partial failure and restart during restoration.

## Providers, resources, and privacy

Keep conversational inference, speech recognition, speech synthesis, retrieval, and coding workers independently configurable. Escalation to a stronger model obeys cost and data-sharing policy. Unsupported integrations stay unavailable.

Measure model weights, context cache, speech processing, retrieval, and runtime overhead separately. Evaluate quality before reducing model size. Record hardware, models, context size, versions, failures, and sample counts. Research results do not substitute for product measurements.

Capture microphone input only in an explicit session. Raw audio and screen capture require opt-in. Keep capture, storage, export, and remote analysis separate. Redact secrets from logs and artifacts. Verify local deletion and explain that provider retention is separate.

Test bundles link timestamps, transcripts, user actions, model and prompt versions, tool activity, approvals, memory/task revisions, repository changes, checks, and optional recordings. They belong with the tested run, not in permanent design documentation.

Stable and development builds need distinct identity, storage, and execution roots. Candidate failure must not corrupt daily state. Versioned packages and CI evidence support explicit promotion and rollback.

## Verification requirements

Use domain tests for policy, revisions, replay, and idempotency; adapter contracts for actual provider behavior; and Extension Host journeys for visible state, persistence, and disk results. Mocks do not prove live speech or worker semantics.

Required failure coverage includes ambiguous targets, denied authority, changed requirements, stale completion, manual edits, build failure, provider disconnect, lost acknowledgment, stop, restart, export/redaction/deletion, contradictory memory, late preparation, thread conflicts, council failure, and checkpoint restoration.

Evidence binds to the relevant plan and workspace revision. Relevant changes make it stale. A completion claim cannot accept its own result. Report scenarios as passed, failed, blocked, unsupported, or not tested.

Measure useful-response latency and control responsiveness during active work, not only acknowledgment speed. Compare task outcomes and review accuracy alongside reading and interruption burden. One session does not establish a performance or fatigue-reduction claim.

Internal changes require appropriate automated checks. Reproduce practical regression defects before fixing them. A release needs current end-to-end evidence and consolidated human review. Detailed test procedures, run results, and release-specific gates belong in issues and artifacts.
