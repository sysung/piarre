# Verification plan

## Current boundary

This plan has not been applied. No new test, model request, runtime benchmark or human trial is claimed. OpenSpec validation checks artifact structure only. The user approved all twelve stories for planning, offline work only, and publication before human plan review.

## Test cases and expected outcomes

| Case | Expected observable outcome | Execution |
| --- | --- | --- |
| Two edits then restore first content, including same-bytes control | Reopen and verify a new monotonic revision/provenance. Identical bytes do not restore old permission or passing evidence. | Not run |
| Restore selected skill only | Unrelated skills, memory, workspace files and other template copies retain identical hashes. | Not run |
| Manual edit after preview, missing/forgotten content, rename/deletion or revoked scope | Refuse stale or unavailable targets with an inspectable outcome, without recovering forgotten data from a hidden copy. | Not run |
| Symlink/path escape, missing asset and override conflict | Refuse an incomplete or out-of-scope restore; distinguish imported copy from linked original and repository from global override. | Not run |
| Duplicate receipt, changed-payload retry, lost acknowledgment and crash checkpoints | Use durable operation identity and reconcile after restart without duplicate restore or silent partial success. | Not run |
| Queued launch, active/unknown writer and pinned session | Revalidate current dependency/authority at queued launch, keep running versions pinned, and block conflicting unknown writers. Historical verification remains historical. | Not run |

Tests start red for the relevant missing behavior, then the minimum implementation makes them green. Deliberately wrong controls must fail the scorer or contract. Never use a missing dependency as the claimed behavioral red result.

## Commands after approval

- `node --test test/skill-restore/restore-prototype.test.mjs`

The story-specific new test paths are proposed targets, not currently available commands. Existing evaluator commands run only on their recorded source base with installed dependencies. Benchmark validation commands require issue #94’s PR #95 `d12cc75`. Intent commands require PR #101 `25c8fa5` and its already available isolated container.

Run `npm run test:contract` and `npm run check` when the approved code change warrants them and the dependency tree is already installed. Do not run `npm test` or the smoke runner as an assumed offline check: `apps/vscode/test/run.mjs` can download VS Code. Native verification requires a separately verified installed-host route; a missing host is a blocker, not installation permission. Model inference commands are excluded.

## Interrogate and blast radius

After implementation, give configured Sol and Astra the same immutable diff, scope and raw results. Independently verify actionable findings, resolve accepted defects, and rerun affected checks. No such review of an implemented candidate has happened in this plan-only pass.

Exercise the prototype with actual disposable files and journal restart. Compare every unrelated fixture hash and assert that restoring content changes neither permissions nor current verification records.

## Decision and remaining evidence

Reject whole-project Git reset or a patch-only history that cannot explain exact scope and provenance. Reject any loss of unrelated bytes, duplicate restore, forgotten-data resurrection or revived approval.

Real user skill changes, representative model behavior, human scope/recovery understanding, memory rollback and production retention remain pending. Any later production restore requires a reviewed scope/ownership contract and fresh execution authority.

Record setup, ingestion/update, active review/correction and maintenance separately from elapsed latency or tokens. Freeze numeric benefit margins before measuring and retain null for unavailable telemetry. Report small-sample uncertainty and do not infer approval, correctness or usefulness from agreement or a green unrelated suite.
