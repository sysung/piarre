# Verification plan

## Execution status and gates

No proposed fixture tests, timed reviewers, semantic models, or experiment runs have executed. `openspec validate discovery-92-consistency-checks --strict` validates planning structure only. Human plan/test-boundary agreement and explicit Apply gate offline work. Final adjudication/thresholds and any human/model trial require a separate reviewed protocol.

## Contract cases

Proposed `consistency.test.mjs` is not present yet. Twelve independently adjudicated cases span the two behaviors in [design.md](design.md).

| Case | Expected finding or control |
| --- | --- |
| Fully consistent | No demonstrated conflict; evidence coverage remains explicit |
| Harmless paraphrase | No false contradiction |
| Equivalent refactor | No behavioral defect from syntax alone |
| Code defect | Implementation owns proposed correction against accepted intent |
| Wrong assertion | Test expectation error, no change merely to obtain a pass |
| Stale documentation | Derived explanation owner identified |
| Missing coverage | Coverage gap, never proof of consistency or contradiction |
| Intentional unaccepted change | Pending acceptance/propagation, not silent intent rewrite |
| Ambiguous intent | Cannot determine and explicit human decision proposal |
| Correlated code/test/doc error | Conflict with accepted intent despite artifact agreement |
| Stale revision | Finding stale until rechecked |
| Missing evidence link | Incomplete impact coverage, no exhaustive claim |

Additional scorer controls replay unchanged findings without another review demand, preserve history, invalidate relevant changes, and keep unrelated changes from silently dismissing findings. Deliberately mislabel/omit findings and false consistency claims; class-level false positives/negatives must expose them. Hash the initial expected interpretation before implementation reveal and reject overwriting it.

## Depth and burden checks

Compare A tests+ordinary review, B deterministic link/revision checks, and C consequential-only deeper review. Triggers are permissions, consequential contracts, data loss, recovery, and externally visible behavior. Proposed caps are 5 active minutes per low-risk case and 15 per consequential case. Offline replay uses zero model calls. Any later model condition proposes zero low-risk calls and one consequential call capped at 4,096 input/1,024 output tokens. These defaults are not approved run budgets. Exhaustion is incomplete review.

Measure incremental actionable findings beyond A and total reading, triage, investigation, correction, repetition, maintenance, setup, elapsed time, and token/model cost by depth. Freeze independent counts, order/reset rules, benefit/false-alarm/false-consistency margins, and attention limits before measurement. More findings alone cannot justify continuation; cheap checks may be the entire useful scope.

## Future commands and safeguards

Existing only in PR #95 at `d12cc75fdcca5532e180c8371b1b766df1155b08`:

```sh
node --test test/iteration-benchmark/metrics.test.mjs
node scripts/iteration-benchmark.mjs validate
```

Proposed after implementation:

```sh
node --test test/iteration-benchmark/consistency.test.mjs
```

Use installed pinned dependencies with no provider or native-host route. Missing prerequisites block checks, not authorize installs/downloads. `npm test` and VS Code smoke commands are not inherently offline: `apps/vscode/test/run.mjs` invokes `runTests` and `downloadAndUnzipVSCode`. Any later native regression requires a verified installed-host path and available isolation, with implicit download disabled by a verified route.

Future configured Sol+Astra Interrogate and actual Blast Radius probes check accepted-intent/event authority, unchanged baseline/ordinary review, #94 coverage, no implicit model calls, revision applicability, and repeat suppression. Resolve findings and reverify. Actual independent interpretations and timed human comparison through #67/#59 remain required pending evidence; deterministic record validation does not establish useful semantic detection.
