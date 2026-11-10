# Verification plan

## Execution status and gates

Planning only. No proposed test, model, runtime, sandbox, or human trial has run. `openspec validate discovery-86-tool-batching --strict` checks artifact structure only. Human plan/test-boundary agreement and explicit Apply precede offline implementation. Actual sandbox/provider/control trials require separate authorization and frozen criteria/budgets from [design.md](design.md).

## Contract cases

All tests below are proposed, not present in this branch.

| Case | Expected observable result |
| --- | --- |
| Independent reads in both modes | Equal accepted outcomes and evidence; every call visible |
| Dependent reads | Dependency order retained; same source support |
| Adaptive result | Pause/fallback with evidence and pending decision, no guessed interpretation |
| Denied call or revision correction mid-program | Later affected call blocked despite outer approval |
| Filtering loses required evidence | Task rejected regardless of shorter output |
| Calls/concurrency/output/simulated-resource cap | Recorded limit failure or explicit truncation, no hidden work |
| Tool failure/malformed output/timeout | Failed/partial outcome retained, no success-only exclusion |
| Stop/lost acknowledgment/restart | Unknown effect retained; replacement blocked pending reconciliation |
| Duplicate synthetic receipt | One effect, inspectable duplicate, no false rollback |
| Successful fixed DAG | Contract evidence only; actual containment and performance unproven |

Falsification controls deliberately remove evidence, hide partial work, use entry-only authority, and retry uncertain effects. Each must fail acceptance. A batched workload requiring interpretation is an expected unsuitable case, not an exclusion after seeing results.

## Future commands and prerequisites

After reviewed #95 integration, existing source at `d12cc75fdcca5532e180c8371b1b766df1155b08` documents these commands:

```sh
node --test test/iteration-benchmark/metrics.test.mjs
node scripts/iteration-benchmark.mjs validate
node scripts/iteration-benchmark.mjs validate-stress
```

The new command becomes available only after implementation:

```sh
node --test test/iteration-benchmark/tool-programs.test.mjs
```

Use already installed pinned dependencies and disposable fixture outputs. Missing source/dependencies block execution; do not install or fetch. Do not substitute `npm test` or VS Code smoke tests for offline checks. Existing `apps/vscode/test/run.mjs` calls `runTests` and `downloadAndUnzipVSCode`; an executable on PATH does not establish no-download behavior. Native-host checks require a separately verified installed-host route in an available isolated environment. No native runner is executed here.

## Independent review and completion evidence

Future configured Sol+Astra Interrogate reviews implementation and evidence, then accepted fixes are reverified. Blast Radius executes actual unchanged retrieval/evidence, #94 metric, event-authority, one-writer, baseline-fallback, and unknown-stop probes.

Before real comparison, freeze sample count, repetitions/order/cache/reset, model/tool versions, task success/source support, improvement/noninferiority margins, human visibility/control criteria, resource/stop limits, and spend. Preserve all-attempt raw results, medians/tails where supported, maintenance burden, and blocked/not-run cells. Fixed timing proves neither sandbox nor provider speed. #86 completion requires the separately gated sandbox/control evidence and recommendation, with reviewed lasting technical-design conclusions.
