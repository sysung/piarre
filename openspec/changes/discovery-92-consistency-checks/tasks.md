# Tasks

Every checkbox is future work. Current plan validation does not establish experiment results.

## 1. Agree the test boundary

- [ ] 1.1 Obtain human plan/test-boundary agreement and an explicit Apply request. Verify the decision covers two behaviors, twelve cases, risk triggers, repeat suppression, and proposed time/token caps without authorizing model/human trials.
- [ ] 1.2 Resolve #91/PR #101 and #94/PR #95 identity/integration dependencies. Verify exact revisions and artifact authority in the fixture manifest before implementing the offline slice.

## 2. Build recorded consistency fixtures with tests first

- [ ] 2.1 Add red tests for all twelve seeded/control classes and immutable pre-implementation expectations in proposed `consistency.test.mjs`. Implement minimum record/classification validation, then refactor green. Verify correlated-error and missing-coverage controls and document provenance/independence limits.
- [ ] 2.2 Add red tests for owning-artifact proposals, uncertainty, relevant-revision staleness, unrelated changes, and unchanged-repeat suppression. Implement minimum finding/history behavior and refactor green. Verify no automatic artifact edits or acceptance and no duplicate review demand.
- [ ] 2.3 Add red scorer controls for mislabeled/omitted findings, false consistency, low/deep trigger routing, cap exhaustion, and depth-specific effort totals. Implement minimum scoring and refactor green. Verify class-level false positives/negatives, incremental deltas, unknown coverage, and documented offline reproduction.

## 3. Independently review and reverify

- [ ] 3.1 Run independent Interrogate using configured Sol and Astra. Verify source-linked findings and dispositions, resolve accepted findings, and re-run affected tests.
- [ ] 3.2 Execute Blast Radius probes for #91 accepted-intent/event authority, unchanged #94 result coverage, unchanged ordinary review, absence of implicit model calls, revision applicability, and suppression history. Verify real outputs and reverify accepted fixes.

## 4. Complete the gated comparison

- [ ] 4.1 Freeze independently adjudicated cases/expected findings, sample/order/reset rules, final risk-depth budgets, actionable-benefit/false-alarm/false-consistency margins, attention limits, and continue/narrow/defer rules. Verify a reviewed protocol and separate authorization before human or model runs.
- [ ] 4.2 Run tests-plus-review, cheap checks, and consequential-only deeper review on matched cases. Verify preserved initial interpretations and actual class-level misses/false alarms/coverage, depth-specific incremental findings, and total attention/cost records through #67/#59.
- [ ] 4.3 Report continue/narrow/defer with reproducible fixtures, failures, unknowns, small-sample limitations, and the smallest useful scope. Verify every #92 acceptance criterion has actual evidence or remains explicitly pending, without creating a mandatory gate.

## Workflow follow-up

- Archive only after required results, review, accepted-fix re-verification, and human completion review. Plan publication alone does not authorize archive.
