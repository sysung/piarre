# Verification plan

## Execution status and gates

No proposed tests, upstream refresh, installation, model download, runtime start, inference, device measurement, or human trial has run. `openspec validate discovery-103-colibri-feasibility --strict` checks artifact structure only. Human plan/test-boundary agreement and explicit Apply gate offline report fixtures. A backend trial requires a separate reviewed execution decision. The report can recommend retaining the current route or deferring a trial while recording runtime evidence as not run.

## Contract cases

Recorded eligibility rows under proposed `test/iteration-benchmark/local-routes/colibri/` and additions to `metrics.test.mjs` are future work.

| Case | Expected observable result |
| --- | --- |
| Missing source/artifact/license/backend/template | Eligibility unresolved, no support guess |
| GGUF/file size only | No runtime-fit or compatibility pass |
| Dense resident weights supplied as total RAM | Mislabel rejected; buffers/KV/cache/runtime still unknown |
| Missing phase or overlapping intervals | Unknown retained, no double-counted total |
| Cache layer/state omitted | No warm-cache or retention claim |
| Public endpoint/model mismatch/ignored setting | Ineligible against current local contract |
| Malformed/truncated JSON or unsupported citation | Reply contract fails |
| Client abort/timeout fixture | Server activity unconfirmed, no rollback/retention/privacy inference |
| 100 tokens at 0.05–0.1 token/s | About 1,000–2,000 seconds, 17–33 minutes excluding overhead, labeled arithmetic |
| Tiny-model HTTP success | Transport control only, large-model suitability unproven |
| Unmatched weights/template/backend | Deployment comparison with confounders, not runtime-only claim |

Negative controls deliberately convert resident memory to total RAM, suppress unknown phases, double-count overlap, infer termination from abort, and promote tiny-model transport to large-model readiness. Report/scorer checks must reject each. Recorded fixtures prove accounting/parser behavior only.

## Future commands and safeguards

Existing in PR #95 at `d12cc75fdcca5532e180c8371b1b766df1155b08`, available only after reviewed integration:

```sh
node --test test/iteration-benchmark/metrics.test.mjs
node scripts/iteration-benchmark.mjs validate
```

The metric command covers new cases only after implementation. No Colibri command/client exists or is proposed for this offline slice. Use installed pinned dependencies. Missing dependencies, source snapshots, runtime, or artifact block work without install/fetch permission. Existing `apps/vscode/test/run.mjs` invokes `runTests` and `downloadAndUnzipVSCode`; `npm test`/smoke are not inherently offline. A later native-host route needs a separately verified installed-host/no-download path and available isolation.

## Evidence and review

Future independent configured Sol+Astra Interrogate and actual Blast Radius probes check unchanged Docker Qwen identity/endpoint/bounds, #94 metric compatibility, event authority, unknown-stop retention, no implicit calls/fallback, and unchanged user skill/memory hashes. Resolve findings and reverify.

Keep supplied issue-source metadata pinned to `0a5504a1dc64f86fcd0fe7db298b0448c730e7e6`; a new source/rights review is not claimed. For any later trial, freeze exact artifact/runtime/settings, target free RAM/disk/I/O, context/output limits, starts/fits/correct/latency criteria, retention/privacy/stop probes, sample/order/cache/reset, resource ceilings, and budget. Measure whole requests plus quality, failures, startup, memory/storage, and cancellation separately. Default retain/defer remains valid when compatibility or responsiveness is unsupported. Any adopted lesson or limited-backend recommendation must cite its actual evidence class and cost.
