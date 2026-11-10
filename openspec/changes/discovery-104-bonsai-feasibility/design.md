# Design

## Context

See `proposal.md` for motivation. This is an eligibility/protocol design with security and performance uncertainty, so a design document is necessary.

The plan base is frozen `origin/master` at `0b36edc6c2ead6b7094518d9d98747cd79c98b6e`. Source dependencies below are open PR snapshots, not merged or released capabilities. The plan branch does not import those implementations. Later work must resolve the exact integration separately.

| Source | Inspected revision and existing paths | Consequence |
| --- | --- | --- |
| PR #89 / issue #88 | `42fa20f42d6274dfddef43bc4a965c798cd90186`, `apps/vscode/src/docker-model-runner-conversation-client.ts`, `apps/vscode/test/suite/local-discussion-transport.test.ts` | Pinned Qwen route and bounded response contract exist only on this PR. |
| PR #95 / issue #94 | `d12cc75fdcca5532e180c8371b1b766df1155b08`, `scripts/iteration-benchmark.mjs`, `test/iteration-benchmark/README.md`, `metrics.test.mjs`, `stress-cases.mjs` | Existing benchmark owner. Exposed synthetic checks do not establish model or production-controller quality. |
| PR #97 / issue #93 | `ba752455e33f6fef87085c27c86e16c1edc5d1a9`, `test/context-selection/README.md`, `semantic/holdout-results/` | Historical lexical/dense results are development evidence. Do not reuse their questions as fresh holdouts. |

The inspected PR #89 default is `docker.io/ai/qwen3.5:4b-q6_K`, digest `ea484046efba5fc126b1b331c2d590a20cb7d3abdfc65366a7f8b547350cd629`. Its private Docker-internal or literal-loopback HTTP `/engines/v1` route caps the full prompt at 6,000 UTF-8 bytes, output at 1,024 tokens, timeout at 60 seconds, and one in-flight request. Tool calls and unsupported reasoning fail; interrupted delivery leaves backend stop unconfirmed. These are source facts, not present-machine availability checks.

Issue #104 cites [GGUF](https://huggingface.co/prism-ml/Bonsai-27B-gguf), [MLX](https://huggingface.co/prism-ml/Bonsai-27B-mlx-1bit), [vendor runtime](https://github.com/PrismML-Eng/Bonsai-demo), and the [XDA article](https://www.xda-developers.com/stopped-chasing-bigger-local-models-27b-model-on-8gb-gpu-does-more/). Its Nov 10 inspection date is issue metadata. This plan did not browse or independently refresh those sources. Exact upstream revisions, rights, and runtime support remain unresolved.

## Goals / Non-Goals

The first later offline slice records eligibility and falsifiable comparison cells. It excludes optional vision and speculative-draft components, model installation, new kernels, adapter relaxation, and production integration. Binary compression and #103's disk-streamed MoE remain separate investigations.

## Decisions

### Share the eligibility validator with #105

Use Candidate B's small shared route-fixture design, with Candidate A's finite-test authority gate and optional-component exclusions. Proposed future files, absent from this plan base, are `test/iteration-benchmark/local-routes/compatibility.test.mjs`, `local-routes/bonsai/compatibility.json`, `local-routes/bonsai/CLAIMS.md`, and `local-routes/bonsai/PROTOCOL.md`. #104 owns Bonsai-specific fields and the shared validator; #105 imports references, not another run. Keep the change small and review a shared dependency rather than copying a generic runtime platform.

The Bonsai row records Q1_0_g128 artifact digest/revision, supported low-bit kernel and runtime version, license/redistribution terms, template/tokenizer, parser, private endpoint, context/KV limits, thinking setting, optional-component exclusions, and actual device. Unknown values are explicit unresolved states. A pinned Qwen control exercises the same format. Complete fields establish only bookkeeping completeness. Runtime compatibility additionally requires supported source evidence and, later, authorized observed behavior. No GGUF/file-size inference can satisfy that gate.

### Keep a separate claim matrix

For each claim record source URL/revision, claim type, source date, inspected-versus-reproduced status, applicability, and remaining test. Seed it from the issue, labeling its 3.9GB weights, 5.2/5.6GB peaks, M4 Pro rate, 89.5% benchmark retention, and article's 8GB anecdote as external claims. Do not forecast M3 Pro/36GiB fit from them. Weight memory excludes runtime, KV cache, context, optional components, concurrent IDE/build load, swap, and maintenance cost.

### Freeze one model comparison before adding factors

Proposed primary cells use text-only Qwen and Bonsai, identical evidence/retrieval/prompt/permissions, and thinking off. Thinking on needs a separately bounded total reasoning/output/time cell. Any retrieval factorial is separately preregistered, never bundled into a model improvement. Different runtimes are deployment comparisons. New independent heldouts cover source lookup, rationale, stale/conflicting intent, missing evidence, clarification/skip, JSON/citations, injection, and short/long contexts. Keep answer keys outside dispatched manifests and preserve every attempt.

Resource/quality reporting uses #94/#102: cold load, prefill/first usable answer, decode and completion latency, output length, p50/p95 where sample supports them, peak total memory/swap/disk/energy where measurable, all retries, unknown usage, corrections, and total cost per accepted task. No aggregate vendor retention or finite fixture pass establishes real safety, privacy, quality, or resource fit.

### Preserve gates and valid negative decisions

Current authorization ends at text-only plan publication and human review. After plan/test-boundary agreement, a later request may authorize offline fixture work. Actual model, runtime, hardware, and human work remain separately gated after #100/#91 priority review. Freeze review-accepted counts, order/cache/reset controls, noninferiority and practical-benefit margins, resource ceilings, spend, and stop rules before measurements. Any critical authority/isolation failure vetoes promotion. Zero failures in a finite set is necessary evidence, not universal safety proof. Default retain Qwen/defer; a bounded prototype and any eventual adoption need their own scope.

## Risks / Trade-offs

- Custom kernels may turn a bounded comparison into an engine project. Stop and recommend defer when reviewed maintenance scope is exceeded.
- A static eligibility matrix can become stale. Recheck exact artifacts/rights/runtime before a trial and retain the old row's identity.
- Fixture success can hide unsuitable real model behavior. Keep actual quality, hardware fit, retention/privacy, and correction effort pending.
- Offline commands can invoke download-capable hosts. Apply the installed-dependency and no-download guards in `verification.md`.

## Migration Plan

No deployment or data migration accompanies this plan. Later fixtures live in disposable benchmark state. Preserve the original baseline and raw results; do not change adapter defaults. Roll back a future experimental slice by discarding its isolated state, never by deleting user data or shared history.

## Review requested

Review the text-only scope, shared validator ownership, actual target device, supported route/rights evidence, holdout counts, quality/effort margins, resource ceilings, and trial budget. These are pending decisions before execution, not guessed approvals. Human review of this plan does not lift the pilot pause, authorize inference, or approve adoption.
