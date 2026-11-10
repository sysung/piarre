# Verification plan

## Current boundary

This plan has not been applied. No new test, model request, runtime benchmark or human trial is claimed. OpenSpec validation checks artifact structure only. The user approved all twelve stories for planning, offline work only, and publication before human plan review.

## Test cases and expected outcomes

| Case | Expected observable outcome | Execution |
| --- | --- | --- |
| Original wording, negation, quantities, scope and unknowns | Human and agent views reference the same accepted identity/revision without strengthening the statement or hiding uncertainty. | Not run |
| Dirty direct edit, old branch, rename/deletion and divergent accepted edits | Keep pending, accepted, disputed and unavailable states separate. Copied labels and saves do not confer adoption. | Not run |
| Changed bytes during review, interrupted adoption, duplicate retry and reopen | Accept only the exact reviewed version with one durable receipt, or refuse/reconcile explicitly. | Not run |
| Tampered or missing accepted snapshot | Block a supposedly current handoff rather than substitute newer working bytes. | Not run |
| Material correction, metadata-only import and missing impact links | Stale explicitly bound work correctly, preserve unrelated records and historical provenance, and disclose incomplete coverage instead of claiming full impact. | Not run |

Tests start red for the relevant missing behavior, then the minimum implementation makes them green. Deliberately wrong controls must fail the scorer or contract. Never use a missing dependency as the claimed behavioral red result.

## Commands after approval

- `npm run check`
- `npm run test:contract`
- `node scripts/verify-intent-prototype.mjs piarre-sandbox-piarre-1 /absolute/new-output-directory`

The story-specific new test paths are proposed targets, not currently available commands. Existing evaluator commands run only on their recorded source base with installed dependencies. Benchmark validation commands require issue #94’s PR #95 `d12cc75`. Intent commands require PR #101 `25c8fa5` and its already available isolated container.

Run `npm run test:contract` and `npm run check` when the approved code change warrants them and the dependency tree is already installed. Do not run `npm test` or the smoke runner as an assumed offline check: `apps/vscode/test/run.mjs` can download VS Code. Native verification requires a separately verified installed-host route; a missing host is a blocker, not installation permission. Model inference commands are excluded.

## Interrogate and blast radius

After implementation, give configured Sol and Astra the same immutable diff, scope and raw results. Independently verify actionable findings, resolve accepted defects, and rerun affected checks. No such review of an implemented candidate has happened in this plan-only pass.

Run actual adopted-document replay and handoff through an available isolated native host only after approval. Inspect persisted events for adoption-only effects, compare unrelated history and preserve the original legacy knowledge/export cases.

## Decision and remaining evidence

Reject a candidate that loses a consequential constraint, invents adoption or adds maintenance without observed effort benefit. Narrow to a handoff helper if that is the useful part; retain Markdown or an existing tool if easier.

Actual Markdown comfort, matched OpenSpec/prototype activities and genuine resumed work remain pending. Stop expansion if ordinary Markdown is comfortable. Only continue against a specific gap, recording all setup, linking, review, reading, maintenance and correction effort through #100/#91. Any authority/storage contract change requires explicit review.

Record setup, ingestion/update, active review/correction and maintenance separately from elapsed latency or tokens. Freeze numeric benefit margins before measuring and retain null for unavailable telemetry. Report small-sample uncertainty and do not infer approval, correctness or usefulness from agreement or a green unrelated suite.
