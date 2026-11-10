# Verification plan

## Current boundary

This plan has not been applied. No new test, model request, runtime benchmark or human trial is claimed. OpenSpec validation checks artifact structure only. The user approved all twelve stories for planning, offline work only, and publication before human plan review.

## Test cases and expected outcomes

| Case | Expected observable outcome | Execution |
| --- | --- | --- |
| Unchanged exact+FTS5 control versus bounded relationships | Same frozen source and evidence budget; compare required-source recall, precision/applicability and expansion regressions per case. | Not run |
| Paraphrased rationale and multi-file dependency | Cite verified supporting blobs/spans or record a miss; extra retrieved text alone is not a supported answer. | Not run |
| Natural dynamic dependency, synthetic injected edge and unavailable trace | Label static, observed and injected evidence separately. Never present a static edge as observed execution or missing edge as proof of no dependency. | Not run |
| Changed/conflicting decision, rename/deletion, revocation and wrong project | Reject stale/unauthorized evidence or report incomplete coverage, including after warm lookup. | Not run |
| Unanswerable question and deliberately wrong scorer/key mutation | Abstain or report missing evidence. The scorer must fail the known-wrong control and retain per-case failures. | Not run |
| Holdout exposed by tuning | Promote the failed case to a named regression and replace the affected holdout family before confirmation; deterministic repetitions are not independent questions. | Not run |

Tests start red for the relevant missing behavior, then the minimum implementation makes them green. Deliberately wrong controls must fail the scorer or contract. Never use a missing dependency as the claimed behavioral red result.

## Commands after approval

- `node scripts/evaluate-project-retrieval.mjs /absolute/new-results.json`
- `node --test test/retrieval-comparison.test.mjs`
- `node scripts/iteration-benchmark.mjs validate`
- `node scripts/iteration-benchmark.mjs validate-stress`

The story-specific new test paths are proposed targets, not currently available commands. Existing evaluator commands run only on their recorded source base with installed dependencies. Benchmark validation commands require issue #94’s PR #95 `d12cc75`. Intent commands require PR #101 `25c8fa5` and its already available isolated container.

Run `npm run test:contract` and `npm run check` when the approved code change warrants them and the dependency tree is already installed. Do not run `npm test` or the smoke runner as an assumed offline check: `apps/vscode/test/run.mjs` can download VS Code. Native verification requires a separately verified installed-host route; a missing host is a blocker, not installation permission. Model inference commands are excluded.

## Interrogate and blast radius

After implementation, give configured Sol and Astra the same immutable diff, scope and raw results. Independently verify actionable findings, resolve accepted defects, and rerun affected checks. No such review of an implemented candidate has happened in this plan-only pass.

Run the old fixture unchanged and source-currentness tests against both arms. Prove that adding the challenger does not rewrite baseline configuration, expose private answer keys or promote static relationships to observed facts.

## Decision and remaining evidence

Retain exact+FTS5 if relationship expansion fails to improve fully supported questions at the fixed limit or introduces false dependencies/currentness regressions. Embeddings, reranking and graphs require a demonstrated remaining miss and separate scope.

Issue #88/PR #89’s frozen local route and actual paired same-model inference remain required for completion after the pause is explicitly revisited. Freeze artifact/runtime/hardware/prompt settings, all attempts and independent source-support judgments. Offline retrieval/mocks cannot replace that evidence. #79 still owns runnable human arms and user selection.

Record setup, ingestion/update, active review/correction and maintenance separately from elapsed latency or tokens. Freeze numeric benefit margins before measuring and retain null for unavailable telemetry. Report small-sample uncertainty and do not infer approval, correctness or usefulness from agreement or a green unrelated suite.
