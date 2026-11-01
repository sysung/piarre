# B03 worker contract rationale

## Problem

B03 must run one approved coding task without letting a worker choose its own authority. The design must preserve the event-authoritative project model, reserve one repository writer before an external effect, and isolate Codex protocol changes behind one adapter.

## Usage

The developer creates a reviewable task, runs **Piarre: Approve and Run Task**, and reviews the effective grant. Piarre records the approval and writer reservation before it starts Codex. The Work view shows the run as running, failed, awaiting reconciliation, or needing verification.

The grant currently permits repository-wide patch writes and the exact command `git status --short`. Attempts and elapsed time are hard limits. The token count is an observed soft budget because Codex CLI 0.164.0 does not expose a trustworthy hard token limit.

## Shape

The pure core owns approvals, runs, legal transitions, derived task status, and writer ownership. `SqliteProjectRepository` parses stored events and commits each event with its command receipt in one `BEGIN IMMEDIATE` transaction. `TaskRunner` combines durable transitions with worker side effects. `WorkerAdapter` hides provider lifecycle and capability differences. `CodexAppServerWorker` owns JSONL parsing, item correlation, approval responses, canonical path checks, and process cleanup.

Runs are the authoritative execution state. A reserved, running, or reconciliation-required run owns the writer. Only proven completion or failure releases it. Missing acknowledgements and unknown terminal state keep the writer reserved for B07 reconciliation.

## Synthesis decision

Arena selected the app-server adapter over `codex exec --json` because app-server exposes steer, interrupt, inspect, and command and file-change approval callbacks. The final shape also adopted explicit effective-scope display, near-match denial probes, and a controller that owns both durable transitions and external effects.

Interrogate found that callbacks alone did not prove complete command mediation. A live Codex 0.164.0 probe therefore became a blocking gate. The probe observed approval callbacks for a safe read and a write, accepted exact commands, declined a near match and an outside-root write, and verified the resulting files.

## Tradeoffs accepted

- We pin mediation evidence to Codex CLI 0.164.0 in exchange for truthful capability reporting.
- We allow repository-wide patch writes in exchange for a scope the current app-server sandbox can enforce.
- We keep reconciliation-required runs blocked in exchange for avoiding a second writer after an ambiguous failure.
- We expose the token budget as soft in exchange for not claiming an unavailable hard limit.

## Alternatives considered

`codex exec --json` lost because it does not expose the approval callbacks needed to enforce the durable grant. Prompt-only command rules lost because model instructions are not an authority boundary. Releasing the writer on process loss lost because the external worker may still be active.

## Risks

The app-server protocol is experimental. The adapter validates unknown input, keeps wire types private, and requires current mediation evidence. B07 must later reconcile runs that survive a process or editor failure.

## Next implementation step

B04 can consume completed runs and create revision-bound verification evidence without changing the worker contract.
