# Migration verification results

Implementation under test: [`a301b008650569c410799391af9304b9ac8e4cc4`](https://github.com/sysung/piarre/commit/a301b008650569c410799391af9304b9ac8e4cc4), based on `8a8b7ab38d9cb0d272389ef89a089e5cee9b7832`. Code, documentation and acceptance references share this revision. This record is added afterward to avoid a self-referential commit hash. [PR #122](https://github.com/sysung/piarre/pull/122) records publication and subsequent checks.

Environment: macOS arm64, Node 22.23.4, OpenSpec 1.16.1. Commands ran in the isolated implementation checkout and a fresh clone. No documentation Store registration or external-repository credentials were needed.

| Check | Outcome | Evidence |
| --- | --- | --- |
| V01 | Passed | Portable archive verifier confirmed 26 snapshot hashes, all 255 nonblank legacy-document lines, exact 21 catalog rows, and unchanged requirements/owners/verification text. |
| V02 | Passed | Local context/list/doctor resolved Piarre from root and child directory with empty temporary OpenSpec settings. The fresh clone contains local specs/changes and no Store pointer or lock. |
| V03 | Passed | Resolver tests cover clean revision, missing root/source, inaccessible source, dirty strict acceptance, unavailable/changed revision, committed-content reads and unverified preview. |
| V04 | Passed | All 21 migrated source references resolve. Tests reject missing/unrelated/duplicate/fenced headings, traversal and symlink escape. The inventory compares semantic text separately. |
| V05 | Passed | Original inventory files are byte-identical. Eleven product-source entries resolve to two verified PRD hashes; all ten retrieval sources remain readable. Missing-object diagnostics are tested; CI fetches full history. |
| V06 | Passed | Disposable archive fixtures with obsolete deltas leave main-spec bytes unchanged and retain abandoned outcome and unchecked tasks. Legacy source snapshots remain readable. |
| V07 | Passed | Fixture changes archive in reverse order but list by stable creation IDs. Duplicate creation fails without overwriting. Simulated lifecycle order is explicitly labeled; it is not product adoption. |
| V08 | Passed for published events | Issue #121, PR #122 and the implementation commit resolve to Piarre. Merge/archive remain pending. This result names the revision tested and does not claim a later edit was already tested. |
| V09 | Passed | Local Markdown path/anchor audit passed: 20 guide links and 145 OpenSpec links, excluding immutable source snapshots. Original README instructions from Install onward are retained. Reflection guidance and P13/P14 are retained; the maintained filename is USER_DESIGN_PRINCIPLE.md. |
| V10 | Passed, procedural review | Guides and principles assign requirements to OpenSpec and issue conflicts to user resolution. A sample issue proposing automatic confirmation conflicts with the reviewed-correction contract: surface both sources and await the user's resolution before dependent execution. The capture trigger remains open. This is a workflow/document review, not a claim of automated conflict enforcement. |
| V11 | Passed | Tasks and workflow link the canonical plan. Actual preview returns nonzero, zero executed checks and 21 unverified criteria. The runner regression prevents passing evidence when source accessibility changes during collection. |
| V12 | Passed, migration scope | Fresh-clone npm ci, all 31 contract tests, lint, typecheck, build and package succeeded. Strict validation passed all ten active/spec items. Rollback restored the exact baseline tree and all 21 old source references while retaining migration history in Git. |

## Reproduce

From Piarre, run `npm ci`, `npm run test:contract` and `npm run check`. Run `openspec validate --all --strict`. The package tool emits the existing missing-license warning; packaging succeeds.

Run the portable provenance check:

```sh
python3 openspec/changes/archive/2026-11-13-legacy-documentation/capture-baseline.py --code . --documentation-root .
```

Run the isolated CLI fixtures with `python3 openspec/changes/2026-11-13-055759-consolidate-project-documentation/verification/check-openspec.py`. Set OPENSPEC_BIN if the installed CLI is not on PATH. The script prints commands and outcomes and removes only its temporary fixtures.

[Rollback evidence](rollback.json) records the isolated revert result. It restored a tree identical to the baseline; the original migration manifest remains retrievable from its commit. No real branch was rolled back.

## TDD and limits

The local-root regression first failed because the prior resolver demanded a documentation lock. The source-stability regression first falsely passed when a source became inaccessible during checks; revalidating source accessibility now blocks acceptance. These scenarios pass in the contract suite. Simulated subprocess logs in the runner fixture test report logic, not product runtime correctness.

Strict candidate acceptance on the clean implementation clone intentionally returned nonzero: the existing 17 pending criteria remain pending, with productReady false. No full Host acceptance or human product evaluation was claimed locally. PR CI separately runs the repository's broader checks. The migration does not turn historical or structural evidence into current feature verification.

Project 8 attachment remains unavailable with the current token's missing read:project scope. The issue and PR are linked directly. The superseded private documentation repository and credentials remain unused and untouched.
