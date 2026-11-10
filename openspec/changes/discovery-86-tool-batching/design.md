# Design

## Context

See [proposal.md](proposal.md) for motivation. This branch is a text-only plan on `0b36edc6c2ead6b7094518d9d98747cd79c98b6e`. Existing production control references are `apps/vscode/src/execution-coordinator.ts`, `packages/core/src/execution.ts`, and `apps/vscode/src/sqlite-project-repository.ts`. The coordinator exposes `prepare`, `approveAndRun`, `stop`, and `reconcile`. Its `finalBoundary` is private and is a source reference, not an externally callable integration seam. SQLite events remain authoritative, with one writer and explicit unknown outcomes.

Issue #94's benchmark exists only in open PR #95 at `d12cc75fdcca5532e180c8371b1b766df1155b08`. Its actual paths include `scripts/iteration-benchmark.mjs`, `scripts/iteration-benchmark-host.cjs`, `test/iteration-benchmark/metrics.mjs`, `metrics.test.mjs`, and `README.md`. The source defines offline validation commands, but current production token telemetry is unavailable. No benchmark dependency is imported into this planning branch.

## Goals / Non-Goals

The first future slice establishes fixture equivalence, accounting, and control behavior. It does not build a generic executor or certify a sandbox. No arbitrary generated JavaScript runs in that slice. Vendor selection, production integration, and real performance/control claims remain separate work.

## Decisions

### Extend the existing benchmark with a fixed interpreter

Select Candidate B's proposed new `test/iteration-benchmark/tool-programs.mjs` and `tool-programs.test.mjs`, plus a small versioned fixture manifest. Graft Candidate A's explicit output/resource caps and hidden-partial-completion controls. A separate `test/programmatic-execution/` framework would duplicate #94 ownership. A vendor integration would add runtime and security assumptions before the comparison is defined. See [arena.md](arena.md).

Both modes invoke identical synthetic read tools and consume the same repository-lookup records. Sequential mode evaluates one call at a time. Program mode interprets a fixed declared DAG, with no arbitrary code generation. Include one independent-read workload, one dependent-read workload, and one adaptive fallback workload. Synthetic writes exist only to model receipts, never external effects.

Proposed fixture caps are eight inner calls, two concurrent independent reads, 16 KiB per result, 64 KiB retained output per program, and 1,000 simulated milliseconds. These are reviewable fixture defaults, not host sandbox limits or accepted live budgets. Count attempted calls, rejected/truncated output, and limit exhaustion. Preserve full authorized fixture evidence outside summaries.

### Check each call and retain uncertainty

Bind every call to task/run identity, source revision, permission version, operation identity, and evidence references. A correction between calls invalidates later affected work. An outer program approval cannot grant blanket permission. Record current activity, progress, pending decisions, and stop state. Fail if filtering loses required source support or partial completion disappears.

Use stable operation IDs and synthetic receipts for lost-acknowledgment/restart cases. Stop and cancellation are distinct from observed termination. Retain unknown state and writer reservation until reconciliation. Fallback may resume safe reads but cannot repeat uncertain effects or overwrite manual edits.

### Preserve the real sandboxed comparison as completion work

Offline passing fixtures are preparation. The issue still requires an approved sandboxed programmatic arm against unchanged per-call execution with the same tasks, tools, model, acceptance criteria, and permission policy. Before generated code, demonstrate enforced filesystem, process, network, credential, CPU/memory/time, and output restrictions on the selected runtime. Worktrees and fixed DAGs prove none of those boundaries.

Freeze independent task count, order, repetitions, cache/reset rules, model/configuration, source/build/tool versions, quality gates, and numeric practical-improvement margins before real measurement. Collect end-to-end and model/tool/runtime latency, round trips, calls, tokens, cost, failures, source support, freshness, stop latency, and maintenance burden for every attempt. Report tails only where the sample supports them. #55 owns any later adoption and technical-design change.

## Risks / Trade-offs

- Fixtures can conceal real side effects. Keep containment and actual stop demonstrations explicitly pending.
- A shorter summary can lose evidence. Task acceptance checks source support before efficiency.
- Synthetic timing can resemble a speedup. Label it fixture overhead only and keep real measurements not run.
- Unmerged PR dependencies can drift. Review the exact integration SHA before future implementation and preserve unchanged #94 results.

## Migration Plan

After human plan/test-boundary agreement and an explicit Apply request, resolve #95 integration and implement the small offline slice with red, minimum green, and refactor checks. Re-run independent Interrogate with configured Sol and Astra, execute relevant Blast Radius probes, resolve accepted findings, and reverify. A further execution authorization gates sandbox/provider/human trials. The sequential route remains available throughout; abandoning the experiment requires no production rollback.

## Review requested

Confirm fixture caps, workload boundaries, test contracts, and #95 integration. Before live work, separately accept the sandbox/provider, allowed tools, task counts, repetitions, order/cache/reset controls, improvement/noninferiority margins, human control criteria, resource limits, and budget. Current authorization is offline planning and publication only. Wait for human review before Apply. Neither publishing nor merging this plan completes #86.
