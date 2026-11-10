# Design

## Context

See [proposal.md](proposal.md) for motivation. This is an independent text-only plan on `0b36edc6c2ead6b7094518d9d98747cd79c98b6e`. Issue #94's runner exists only in open PR #95 at `d12cc75fdcca5532e180c8371b1b766df1155b08`: `scripts/iteration-benchmark.mjs`, `scripts/iteration-benchmark-host.cjs`, `test/iteration-benchmark/metrics.mjs`, `metrics.test.mjs`, and `README.md`. Its `coverage`/`dimensions` results retain missing rows and unknown token telemetry. Extend that owner after review; do not replace its local-model comparison or #88 prerequisites.

Open PR #97 at `ba752455e33f6fef87085c27c86e16c1edc5d1a9` contains historical `test/context-selection/` evidence, not coding results. Open PR #89 at `42fa20f42d6274dfddef43bc4a965c798cd90186` contains the bounded Qwen route. #100/#91's document pilot remains the priority, and model optimization remains paused. No implementation branch is imported here.

## Goals / Non-Goals

Prepare auditable manifests and accounting contracts. Do not launch coding agents, author a tuned benchmark corpus, or report savings from fixtures. Avoid a new benchmark platform and a bundled optimization comparison that cannot identify causal effects.

## Decisions

### Add a protocol/accounting slice to #94

Select Candidate B's proposed new `test/iteration-benchmark/coding-protocol.json`, `coding-costs.mjs`, and `coding-costs.test.mjs`. Reuse the runner's manifest freezing and existing metric conventions. Graft Candidate A's explicit reviewer/coordinator overhead and provider-versus-subscription fields. No current file has these proposed coding contracts. See [arena.md](arena.md).

The proposed twelve eligibility slots span two sanitized repository families, six slots each. Across the suite include bug fixes, small features, refactors, test work, and cross-file changes at multiple difficulties. Slots describe eligibility, not real tasks, hidden tests, or authored/frozen holdouts. Independent authors freeze fresh tasks and a development/holdout split by repository/task family only when scheduled. Keep known #94/#97 tasks as development evidence.

### Separate context selection from local preparation

| Condition | Treatment | Controlled inputs |
| --- | --- | --- |
| A | Fair normally configured direct Codex, native search/tools, same available project docs | Same executor/model/effort, brief, state, permissions, tools, evidence access, output budget, acceptance rubric |
| B | A plus deterministic bounded sourced handoff | Retrieval and revision-bound handoff are the declared treatment |
| C | B plus bounded local Qwen preparation | Exact artifact/digest, quantization, runtime, hardware, settings, and preparation budget are recorded |
| Direct matched evidence | A receives the identical excerpts/handoff outside Piarre | Distinguishes selection from orchestration |

A retains normal valid configuration and access to information. Handoffs identify exact supplied bytes and source revisions; model interpretation is separate from source text. Local Qwen cannot invent authority or determine acceptance. Unsupported local capability blocks C without hosted fallback.

After the core comparison, review each secondary factor separately: output/context filtering and independent summarization; selective skills preserving mandatory instructions; model/effort routing including failures and escalation; #90 caching with cold/unknown/warm/expired/changed-context labels; parallel agents including all coordination/conflict work; #86 programmatic calls and any genuinely offline provider batch route. Each cell pins prompts, search/output caps, retry/stop rules, budget, owner, and confounders. Use factorial trials only for declared plausible interactions, then confirm promising combinations on fresh holdout tasks.

### Keep all attempts and real acceptance

An accepted task requires behavior/hidden tests, required build/type/lint/regression and security checks, and independent patch review. Mutate scorer inputs with deliberately wrong patches. Blinding is used where feasible; a model judge is never sole truth. Record partial acceptance, review-discovered defects, failures, unsupported, abandoned, and not-run cells separately.

Primary cost is total all-attempt cost divided by independently accepted tasks, undefined at zero successes. Include retrieval/index updates, local startup/inference, router/summarizer, coordinator/workers/reviewers, retries, tooling, and reconciliation. Show setup/scorer cost separately and in the campaign total, with explicit amortization. Deduplicate cumulative usage by request/attempt identity. Missing token/reasoning/cache/resource fields stay unknown.

Record provider, exact model/version, authenticated API/subscription/local route, price date, billed receipts versus estimates, route-specific fees, and subscription allowance separately. API discounts do not establish subscription savings. Local compute has wall-time/resources and declared valuation assumptions, not invented zero-cost dollars. Count actual reading/review/correction/setup and maintenance through #67/#100's existing human workflow. Automated proxies remain labeled.

### Require enforced isolation and reviewed execution limits

Future runs start from the same immutable source/task snapshots with distinct configuration/profile, SQLite/index, temp/output/port state, and fresh sessions. Keep hidden tests/reference patches/secrets outside agent-readable mounts. One writer per assigned worktree is necessary but Git worktrees share metadata and host access. Actual execution requires demonstrated filesystem/process/network/credential isolation. Test prompt injection, cross-project leakage, stale evidence, denied calls, partial failure, stop, and unconfirmed termination before replacement.

Propose at least three repetitions per stochastic cell for later review, counterbalanced order, explicit cache/reset states, and all-attempt task-clustered comparisons. Repeated deterministic fixtures establish repeatability only. Freeze final independent counts, repetitions, numeric savings/noninferiority margins, stop rules, resource limits, executor route, and maximum spend before measurement. Current campaign spend remains zero. Any critical authority/isolation violation vetoes adoption regardless of average results.

## Risks / Trade-offs

- Missing production telemetry prevents dollar claims. Report unknown values and route-specific evidence requirements.
- Holdouts can leak through shared state. Validate resets and mounts on the actual executor, not just mocks.
- A lower bill can hide worse patches or human work. Apply frozen quality/security/review-effort gates before efficiency claims.
- A small selected suite cannot prove broad superiority. Preserve per-task/category regressions and uncertainty.

## Migration Plan

After human plan/test-boundary agreement and explicit Apply, resolve #95 integration and implement only offline protocol/accounting fixtures with red, minimum green, and refactor checks. Run independent configured Sol+Astra Interrogate and actual Blast Radius probes, then fix and reverify. A separate decision after #100/#91 must revisit the pause and authorize task authoring/executor/campaign scope. Keep the direct baseline and existing benchmark reports intact.

## Review requested

Confirm twelve-slot scope, schema fields, acceptance rubric, matched-evidence control, and factor ownership. Before any agent/inference/human trial, separately approve real tasks/holdout split, supported executor and isolation, model/settings, task/repetition/order/cache/reset rules, practical margins, human-effort protocol, resource limits, and budget. Publish this plan and wait for human review before Apply. Actual A/B/C, agreed factor cells, fresh holdouts, and all-attempt reports remain pending completion work.
