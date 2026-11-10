# Verification plan

## Execution status

Plan text only. No application tests, benchmark validation, model/runtime trials, downloads, installs, native host, hardware inspection, or human comparison ran. Proposed test files below do not exist yet. OpenSpec strict validation checks artifact structure only; its result is recorded in the author handoff. Every task remains unchecked.

## Contract and test cases

| Proposed case | Expected observable outcome | Evidence limit |
| --- | --- | --- |
| Published 3.9GB weights or vendor retention enters the claim matrix | Label external vendor claim, source/date/revision status, not total RAM or Piarre quality | Source bookkeeping only |
| Article's 8GB GPU anecdote or M4 decode rate enters a target-device report | Actual M3 Pro/36GiB fit remains unknown until verified | No hardware forecast |
| Missing digest, low-bit kernel, runtime version, rights, template/tokenizer/parser, private route, context/KV or device field | Unresolved eligibility blocks trial; missing is not a guessed default | Complete fields still do not establish compatibility |
| GGUF exists but Docker Q1_0_g128 support is unknown | No compatibility assertion or fallback backend | Falsifies file-format-as-support premise |
| FP16 substitution, vision or draft component, mutable artifact | Reject the text-only comparison cell | Artifact control only |
| Pinned Qwen control with complete supported metadata | Accept bookkeeping control while retaining actual availability status | No baseline-model quality claim |
| Recorded malformed JSON/citations, model mismatch, truncation, source injection, hidden thinking | Fail the response-contract fixture and retain failed output | Does not measure real model tendency |
| Recorded timeout/unconfirmed cancellation | Keep unknown stop and block replacement until explicit reconciliation | Delivery abort is not backend stop proof |
| Candidate changes model plus retrieval/prompt or thinking without a new cell | Reject attribution; distinguish factors and deployment/runtime differences | Comparison validity |
| Better mean quality with one authority/isolation failure | Veto promotion; finite zero failures never proves universal safety | Negative control for scorer |
| Missing token/resource use or zero accepted tasks | Unknown remains null; cost per accepted task undefined at zero successes | No invented zero cost |
| Passing recorded fixtures without actual inference/human review | Report deterministic contract evidence only; model quality/effort/resources stay not run | Completion cannot come from mocks |

The proposed validator suite is `test/iteration-benchmark/local-routes/compatibility.test.mjs`, with recorded response cases shared through #94. The manifest, claim matrix, protocol, and test file are new future paths named in `design.md`, not present executable coverage. Add failing cases before the minimum validator/fixture implementation, then refactor. Preserve the baseline and use independent scorer expectations.

## Existing commands and prerequisites

These are source-verified commands, listed for later authorized offline work and not run now. They exist at PR #95 `d12cc75fdcca5532e180c8371b1b766df1155b08`, not the plan-only base:

```sh
node --test test/iteration-benchmark/metrics.test.mjs
node scripts/iteration-benchmark.mjs validate
node scripts/iteration-benchmark.mjs validate-stress
```

After the proposed suite exists, its new command would be:

```sh
node --test test/iteration-benchmark/local-routes/compatibility.test.mjs
```

Use a separately agreed checkout with Node >=22.12 and its already installed pinned dependencies. Inspect command imports and entry points before running. If prerequisites are absent, record blocked; do not fetch, install, use npx, or start a model. The supplied environment has not established usable Docker/model/hardware availability.

`npm test` and `npm run test:smoke --workspace apps/vscode` are not certified offline: inspected `apps/vscode/test/run.mjs` includes `runTests` and `downloadAndUnzipVSCode`. An executable on PATH does not prove no download. Any host check needs a separately verified already-installed pinned VS Code path and isolated profile; no native host or live model command belongs in this preparation.

## Falsification and independent review

The proposal fails trial eligibility if no supported private text route exists, required kernel work exceeds reviewed maintenance scope, rights remain unresolved, or exact artifact/hardware cannot be established. Later matched results can retain Qwen or defer on quality, correction effort, latency, resource or maintenance regressions.

After future offline implementation, run independent Interrogate with configured Sol and Astra, then actual Blast Radius probes on preserved Qwen defaults, retrieval/skill hashes, event authority, private endpoint handling, no implicit providers, and unknown-stop retention. Resolve accepted findings and rerun affected checks. These reviews/probes have not occurred.

## Gates for real evidence

After #100/#91 priority review, separately approve actual target hardware, artifact/rights/runtime/private route, independent fresh holdout count, blinded adjudication, matched evidence and thinking mode, practical quality/effort margins, latency/memory/swap/spend limits, cold/warm/order/cache/reset/repeat/stop rules, and any human participation. Freeze numeric criteria before outputs. Report raw task outcomes, every failure, runtime maintenance, total cost, independent corrections, and uncertainty. Actual privacy/retention must be inspected on the real approved runtime; fixture metadata cannot prove it. Adoption remains separate. All of this evidence is pending, not waived by plan review.
