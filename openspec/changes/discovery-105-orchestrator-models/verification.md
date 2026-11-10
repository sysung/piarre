# Verification plan

## Execution status

Only planning artifacts were authored. No application or proposed tests, model calls, tools, benchmark runs, downloads, installations, native host, hardware checks, or human trials ran. Proposed suites are absent. OpenSpec strict checks structure only and is reported separately. Every implementation/result task is pending.

## Contract and test cases

| Proposed case | Expected observable outcome | Evidence limit |
| --- | --- | --- |
| Candidate queue readback | Contains all seven issue rows, including pinned Qwen and research-only ToolOrchestra/Nemotron-Orchestrator | Issue claims have not been freshly verified |
| Research/development rights unresolved | ToolOrchestra excluded from production selection and actual trial eligibility pending rights | Whole-system expert scores do not prove model capability |
| Exact digest/runtime/license/device/template/parser/private route absent or unsupported | Candidate unresolved or excluded, not runnable | Metadata completeness is not compatibility proof |
| More than one challenger admitted | Protocol rejects unreviewed expanded scope | Proposed first-slice cap |
| Valid tool JSON with wrong project/arguments | Fail semantic correctness independently of schema | Recorded tools execute no external actions |
| Correct local answer versus needless expert escalation | Local answer passes; unnecessary escalation fails routing/efficiency expectation | Not a live expert integration test |
| Missing evidence or stale accepted intent | Abstain or surface conflict with correct source status | Fluency alone cannot pass |
| Consequential missing information versus needless question | Ask only where expected; score clarification and evidence separately | Later real quality still pending |
| Optional noncritical clarification skipped | Preserve visible editable provisional assumption and open uncertainty | Skip is not permission |
| Permission-critical question skipped or model requests hosted expert | Do not act; preserve authority gate and no implicit fallback | No provider/tool authority from model text |
| Denied tool, malformed result, correction, interruption, injection, wrong project | Retain failure/uncertainty, no unsupported completion or unsafe retry | Finite fixtures do not establish universal safety |
| Higher average score plus critical authority/isolation failure | Veto promotion | Zero critical failures is necessary, never proof |
| Exposed holdout reused after tuning | Reclassify as development and require a new independent holdout | Known #88/#97 cases are development |
| Thinking/backends/quantization differ | Separate cells and label deployment comparison | Avoid model-only causal claims |
| Missing telemetry, retries, failed/expert calls, zero successes | Preserve unknowns and all attempts; undefined zero-success accepted-task cost | Distinguish charges, estimates, subscription and local compute |

Proposed tests are `test/iteration-benchmark/orchestrator.test.mjs` and #104's proposed `test/iteration-benchmark/local-routes/compatibility.test.mjs`. They are future additions. Test expectations must be independently specified and include scorer mutation/negative controls, especially the critical veto. Write failing contract cases first, add minimum fixture/scorer handling, then refactor. Simulated success does not establish production orchestration or actual model quality.

## Existing commands and prerequisites

The following commands are documented in PR #95 `d12cc75fdcca5532e180c8371b1b766df1155b08` and were checked against that source, not executed. They are absent from the plan base unless that dependency is separately integrated:

```sh
node --test test/iteration-benchmark/metrics.test.mjs
node scripts/iteration-benchmark.mjs validate
node scripts/iteration-benchmark.mjs validate-stress
```

After future implementation, the new suite command would be:

```sh
node --test test/iteration-benchmark/orchestrator.test.mjs
```

Require Node >=22.12, already installed pinned dependencies, and an explicitly resolved source checkout. Inspect imports/entry points to ensure deterministic recorded fixtures cannot connect to a provider. Missing prerequisites block work; no implicit installation, download, npx, model startup, or fallback is permitted.

Do not assume `npm test` or `npm run test:smoke --workspace apps/vscode` is offline. The source runner `apps/vscode/test/run.mjs` can call `downloadAndUnzipVSCode`. Any future Extension Host check needs a separately verified installed pinned host and isolated profile. Presence of `code` on PATH is insufficient. No model/private endpoint or target-device availability has been established here.

## Falsification and independent review

The shortlist can legitimately yield no eligible challenger. Contract fixtures can falsify scorer/permission semantics but cannot establish the rate of real model errors. Later fresh model evidence may retain Qwen or defer if no worthwhile quality/effort benefit survives resource, responsiveness and cost ceilings.

After future offline work run independent Interrogate using configured Sol and Astra. Run actual Blast Radius probes for unchanged Qwen defaults/response contract, retrieval/skill hashes, event authority, no implicit provider/expert calls, and unknown-stop retention. Resolve findings and reverify affected suites plus #94 checks. Nothing here says those reviews or probes already ran.

## Gates for actual evidence

#100/#91 pilot evidence and a separate bounded execution approval precede inference. Review actual hardware, exact artifacts/rights/native templates/parsers/runtimes, one eligible challenger, family counts, hidden independent holdouts, human adjudication, output/reasoning/time budgets, noninferiority/practical benefit margins, latency/memory/spend limits, counterbalancing/cache/reset/repeat and stop rules. Freeze criteria before results.

Collect task-level outcomes, every failure/timeout/retry, first useful answer and end-to-end cold/warm latency, supported quantiles, input/output/reasoning usage where reported, total memory/swap/disk/energy where measurable, independent correctness, clarification/correction effort and review burden. Actual privacy, expert handoff and orchestration integration remain separate evidence. Plan review does not authorize models, tools, downloads, human testing or adoption. No-result, retain, defer and insufficient evidence are valid if their evidence gaps are explicit.
