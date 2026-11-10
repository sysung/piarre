# Verification plan

## Current boundary

This plan has not been applied. No new test, model request, runtime benchmark or human trial is claimed. OpenSpec validation checks artifact structure only. The user approved all twelve stories for planning, offline work only, and publication before human plan review.

## Test cases and expected outcomes

| Case | Expected observable outcome | Execution |
| --- | --- | --- |
| Start fresh, Skip for now and import later | The user can continue without import and later select a source, preview conflicts, select mappings and save a copied proposal; the source stays unchanged. | Not run |
| Duplicate names, repeated import, changed source and missing assets | Expose stable identity, scope, mapping/conflict and unsupported-format information; never silently convert unknown fields or overwrite sources. | Not run |
| Template, session copy, skills, principles and enforced permissions | Show these as distinct concepts. Distinguish skill availability, loading, invocation and unknown coverage; passive instructions do not enforce permissions. | Not run |
| Queued copy after template/dependency edit, active copy and unknown writer | Revalidate exact revisions, current authority and workspace-wide writer contention before launch; active copies stay pinned. Lost stop acknowledgment remains uncertain. | Not run |
| Composition, criterion evidence and aggregate budgets | Bind immutable reviewer input and criterion pass/fail/untested/needs-human-judgment to dependency/model/provider/evaluator hashes. Detect dropped constraints even when individual skills pass. | Not run |

Tests start red for the relevant missing behavior, then the minimum implementation makes them green. Deliberately wrong controls must fail the scorer or contract. Never use a missing dependency as the claimed behavioral red result.

## Commands after approval

- `node --test test/agent-equipment/import-preview.test.mjs`

The story-specific new test paths are proposed targets, not currently available commands. Existing evaluator commands run only on their recorded source base with installed dependencies. Benchmark validation commands require issue #94’s PR #95 `d12cc75`. Intent commands require PR #101 `25c8fa5` and its already available isolated container.

Run `npm run test:contract` and `npm run check` when the approved code change warrants them and the dependency tree is already installed. Do not run `npm test` or the smoke runner as an assumed offline check: `apps/vscode/test/run.mjs` can download VS Code. Native verification requires a separately verified installed-host route; a missing host is a blocker, not installation permission. Model inference commands are excluded.

## Interrogate and blast radius

After implementation, give configured Sol and Astra the same immutable diff, scope and raw results. Independently verify actionable findings, resolve accepted defects, and rerun affected checks. No such review of an implemented candidate has happened in this plan-only pass.

Hash original skills, unrelated workspace files and existing session-copy fixtures before/after import. Prove zero launches/events and source-byte preservation with real fixture filesystem operations; do not claim that an HTML mock enforces runtime ownership.

## Decision and remaining evidence

Reject a configuration simplification that drops constraints, conceals unsupported mappings or adds review effort without useful understanding. A smaller instruction set is not automatically better.

Human keyboard/scope/launch/cost prediction and comparison remain pending. Actual agent behavior is untested by the prototype. Before conversion or runtime integration, review each supported format, copy/link ownership and budget policy. Use #67’s existing human checkpoint if this experiment earns one.

Record setup, ingestion/update, active review/correction and maintenance separately from elapsed latency or tokens. Freeze numeric benefit margins before measuring and retain null for unavailable telemetry. Report small-sample uncertainty and do not infer approval, correctness or usefulness from agreement or a green unrelated suite.
