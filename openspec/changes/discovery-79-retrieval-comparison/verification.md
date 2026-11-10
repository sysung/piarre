# Verification plan

## Current boundary

This plan has not been applied. No new test, model request, runtime benchmark or human trial is claimed. OpenSpec validation checks artifact structure only. The user approved all twelve stories for planning, offline work only, and publication before human plan review.

## Test cases and expected outcomes

| Case | Expected observable outcome | Execution |
| --- | --- | --- |
| Unchanged control and exact symbols | Both arms return the expected source spans without baseline behavior drift. | Not run |
| Paraphrase and incomplete dynamic relationship | Record a supported hit or an explicit miss/incomplete-coverage result; a missing edge does not prove no dependency. | Not run |
| Accepted old decision versus new proposal, late history and conflict | Keep provenance and acceptance separate. Newer or more-used text never grants authority. | Not run |
| Warm cache then source deletion, permission revocation or prohibition | Refuse revoked/stale evidence and invalidate its derived cache entry. | Not run |
| Dirty/renamed source, source changed during retrieval and project/environment collision | Reject or report unavailable evidence with correct scope, never silently substitute another project or revision. | Not run |
| Overflow, high fan-out, slow provider and stop | Honor request work/output limits, preserve partial constraint coverage, and distinguish cancellation request from observed completion. | Not run |

Tests start red for the relevant missing behavior, then the minimum implementation makes them green. Deliberately wrong controls must fail the scorer or contract. Never use a missing dependency as the claimed behavioral red result.

## Commands after approval

- `node --test test/retrieval-comparison.test.mjs`
- `node scripts/evaluate-project-retrieval.mjs /absolute/new-results.json`

The story-specific new test paths are proposed targets, not currently available commands. Existing evaluator commands run only on their recorded source base with installed dependencies. Benchmark validation commands require issue #94’s PR #95 `d12cc75`. Intent commands require PR #101 `25c8fa5` and its already available isolated container.

Run `npm run test:contract` and `npm run check` when the approved code change warrants them and the dependency tree is already installed. Do not run `npm test` or the smoke runner as an assumed offline check: `apps/vscode/test/run.mjs` can download VS Code. Native verification requires a separately verified installed-host route; a missing host is a blocker, not installation permission. Model inference commands are excluded.

## Interrogate and blast radius

After implementation, give configured Sol and Astra the same immutable diff, scope and raw results. Independently verify actionable findings, resolve accepted defects, and rerun affected checks. No such review of an implemented candidate has happened in this plan-only pass.

Run the unchanged evaluator control and real currentness rejection path after changing the challenger. Confirm the baseline result envelope and source identity are unchanged; no inference or permission mutation is introduced.

## Decision and remaining evidence

Reject the challenger on any authority, deletion, isolation or currentness regression. Retain the baseline if additional supported answers and lower correction effort do not earn the extra setup/update/review burden. Recall alone cannot pick a winner.

After offline readiness, give each implemented human-tested arm its own `codex/79-retrieval-<solution>` branch, worktree, state, PR and immutable bundle, including the baseline. Verify start/stop/reset and independent checks before inviting the existing single comparison checkpoint. Actual same-model generated-answer evidence, applicability ratings and final human selection remain pending.

Record setup, ingestion/update, active review/correction and maintenance separately from elapsed latency or tokens. Freeze numeric benefit margins before measuring and retain null for unavailable telemetry. Report small-sample uncertainty and do not infer approval, correctness or usefulness from agreement or a green unrelated suite.
