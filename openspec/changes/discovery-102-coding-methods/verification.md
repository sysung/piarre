# Verification plan

## Execution status and gates

Planning only. No coding tasks, agents, benchmarks, model calls, scorer tests, or human trials have run. `openspec validate discovery-102-coding-methods --strict` checks plan structure. Human plan/test-boundary agreement and explicit Apply gate offline fixtures. #100/#91 sequencing and separate scope/route/isolation/resource/budget approval gate any campaign. Current proposed campaign spend is zero.

## Contract cases

New `coding-costs.test.mjs` and protocol fixtures are proposed, not present here.

| Case | Expected observable result |
| --- | --- |
| A/B/C/direct matched evidence | Only declared treatment varies; direct control gets identical handoff bytes |
| Slot manifest | Twelve slots/two families, no claim of authored frozen tasks |
| Failed attempt then accepted retry | Both costs and retry/review effort counted |
| All failures | Zero accepted tasks; cost per accepted task undefined |
| Duplicate cumulative usage | Deduplicated by request/attempt identity |
| Missing reasoning/cache/local telemetry | Unknown values, no invented zero |
| API versus subscription versus local | Distinct route/price/receipt/valuation fields, no allowance-savings inference |
| Coordinator/reviewer/reconciliation work | All costs/burden included; setup/scorer separate and in total |
| Deliberately wrong patch | Hidden scorer or independent review rejects plausible visible-test success |
| Missing/abandoned/unsupported run | Retained in all-attempt coverage and exclusions |
| Leaked key/shared state/stale authority | Cell blocked, critical violation vetoes adoption |
| Stop acknowledgment missing | Reservation/uncertainty retained before replacement |
| Mock directory isolation passes | Actual sandbox enforcement remains unverified |

Falsify apparent savings with intentionally omitted failed attempts, repeated cumulative rows, zero-success division, hidden regressions, and solution leakage. Validate scorer sensitivity before actual tasks. Fixture scores do not establish coding ability, real billing, or human usefulness.

## Future commands and prerequisites

After resolving #95 integration, its source at `d12cc75fdcca5532e180c8371b1b766df1155b08` provides:

```sh
node --test test/iteration-benchmark/metrics.test.mjs
node scripts/iteration-benchmark.mjs validate
```

New after implementation:

```sh
node --test test/iteration-benchmark/coding-costs.test.mjs
```

Use installed pinned dependencies and offline recorded inputs. Missing prerequisites block execution; no installs, model downloads, runtime starts, or provider fallbacks follow. Existing `apps/vscode/test/run.mjs` uses `runTests` and `downloadAndUnzipVSCode`, so neither `npm test` nor smoke tests are inherently offline. Any native route must be separately verified against an installed pinned host in available isolation. The current phase does not execute it.

## Completion evidence

Future independent configured Sol+Astra Interrogate and actual Blast Radius probes cover unchanged #94 result/coverage behavior, retrieval support, event authority, unknown-stop retention, absence of implicit calls, and cross-arm state/answer isolation. Resolve accepted findings and reverify.

Before agents run, independently author/freeze tasks and holdouts, acceptance/security/hidden tests and blinded review where feasible, repetitions/order/cache/reset, model/configuration/output/search budgets, noninferiority/savings margins, stop/resource limits, and spend. Validate actual executor filesystem/process/network/credential boundaries with hidden material outside readable mounts. Preserve actual patches, all attempts, usage/billing/timing/resource records, human burden, and task/category uncertainty. Core A/B/C plus matched evidence and agreed separate methodology cells remain pending. Historical #97 results and deterministic replays cannot finish #102.
