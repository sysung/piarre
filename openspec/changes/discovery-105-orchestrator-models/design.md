# Design

## Context

See `proposal.md` for the decision. Comparison spans model contracts, rights, and authority boundaries, so the design records these before any code.

The plan base is frozen `origin/master` at `0b36edc6c2ead6b7094518d9d98747cd79c98b6e`. Source dependencies below are open PR snapshots, not merged or released capabilities. The plan branch does not import those implementations. Later work must resolve the exact integration separately.

| Source | Inspected revision and existing paths | Consequence |
| --- | --- | --- |
| PR #89 / issue #88 | `42fa20f42d6274dfddef43bc4a965c798cd90186`, `apps/vscode/src/docker-model-runner-conversation-client.ts`, `apps/vscode/test/suite/local-discussion-transport.test.ts` | Pinned Qwen route and bounded response contract exist only on this PR. |
| PR #95 / issue #94 | `d12cc75fdcca5532e180c8371b1b766df1155b08`, `scripts/iteration-benchmark.mjs`, `test/iteration-benchmark/README.md`, `metrics.test.mjs`, `stress-cases.mjs` | Existing benchmark owner. Exposed synthetic checks do not establish model or production-controller quality. |
| PR #97 / issue #93 | `ba752455e33f6fef87085c27c86e16c1edc5d1a9`, `test/context-selection/README.md`, `semantic/holdout-results/` | Historical lexical/dense results are development evidence. Do not reuse their questions as fresh holdouts. |

The inspected PR #89 default is `docker.io/ai/qwen3.5:4b-q6_K`, digest `ea484046efba5fc126b1b331c2d590a20cb7d3abdfc65366a7f8b547350cd629`. Its private Docker-internal or literal-loopback HTTP `/engines/v1` route caps the full prompt at 6,000 UTF-8 bytes, output at 1,024 tokens, timeout at 60 seconds, and one in-flight request. Tool calls and unsupported reasoning fail; interrupted delivery leaves backend stop unconfirmed. These are source facts, not present-machine availability checks.

Candidate cards and license descriptions below are supplied issue #105 claims, marked inspected Nov 10 in that issue. They were not freshly verified for this plan. Exact artifact revisions and terms require later review.

## Goals / Non-Goals

Produce a source-labeled eligibility queue and recorded-tool protocol. Do not build an installer, marketplace, ensemble, debate system, automatic router, production tool adapter, or hosted escalation. Model output remains proposed data; it cannot adopt intent, grant tools, or create provider authority.

## Decisions

### Keep every issue candidate visible, admit at most one challenger

| Candidate | Proposed disposition and source |
| --- | --- |
| Qwen3.5 4B Q6_K | Required pinned PR #89 control. Prior production holdouts do not establish a fully successful orchestrator. |
| [Qwen3.5 9B](https://huggingface.co/Qwen/Qwen3.5-9B) | Eligibility review. Issue describes Apache-2.0; exact artifact/terms unverified here. |
| [Ministral 3 8B Instruct 2512](https://huggingface.co/mistralai/Ministral-3-8B-Instruct-2512) | Eligibility review. Verify native template/tool parser and the issue's Apache-2.0 claim. |
| [Gemma 4 12B-it](https://huggingface.co/google/gemma-4-12B-it) | Eligibility review. Verify text deployment, thinking, runtime and this artifact's claimed Apache-2.0 terms. |
| [NVIDIA Nemotron 3 Nano 4B](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-4B-BF16) | Eligibility review under the issue-described NVIDIA Nemotron Open Model License, not assumed Apache terms. |
| [Bonsai 27B 1-bit](https://huggingface.co/prism-ml/Bonsai-27B-gguf) | Consume #104's text-only row, exclusions, and later results without duplicate execution. |
| [Nemotron-Orchestrator-8B](https://huggingface.co/nvidia/Nemotron-Orchestrator-8B) / [ToolOrchestra](https://research.nvidia.com/labs/lpr/ToolOrchestra/) | Research-only, excluded from production selection pending separately resolved rights. Whole-system expert performance does not establish this local model's capability. |

The queue reports excluded, unresolved, eligible-for-reviewed-trial, and actually-tested distinctly. Missing runtime, digest, rights, hardware, parser, private endpoint, or cancellation evidence prevents eligibility. Descriptive completeness is insufficient. Weight size excludes KV/runtime and concurrent IDE load. M3 Pro/36GiB is an issue reference, not a verified target. No challenger or all challengers may be excluded. At most one later challenger bounds setup and coordination cost.

### Reuse #104 and #94, add only missing cases

Choose Candidate B's small model-selection slice. Proposed future files, not present today, are `test/iteration-benchmark/local-routes/candidates.json`, `test/iteration-benchmark/orchestrator-cases.json`, and `test/iteration-benchmark/orchestrator.test.mjs`. They use #104's proposed shared compatibility validator and #94's manifest/scoring conventions. #103 supplies resource lessons, #102 full accounting, #96 clarification semantics, and #86 per-call execution boundaries. Do not import these unmerged implementations into this plan branch.

Recorded tools have independently known outputs and execute no external action. Cover clarification, grounding, tools/routing, correction/recovery, and efficiency/usefulness as separately reported families. Important negative controls include semantically wrong but schema-valid arguments, needless escalation, retry loops, denied actions, malformed results, changed requirements, source injection, and cross-project confusion. A correct local answer or abstention can be better than an expert handoff.

For optional skip, present visible editable provisional assumptions, preserve open consequential uncertainty, and retain all permission-critical checks. A model cannot turn skip into authorization. No implicit hosted fallback is allowed. The PR #89 adapter rejects tools and unsupported reasoning; simulated routing cannot be described as production orchestration integration.

### Separate contract evidence from actual quality

Proposed offline development cases establish validator/scorer behavior only. Later fresh holdouts are independently authored by project/scenario family, frozen before tuning, keyed outside model inputs, exposure-logged, and independently adjudicated with blinded arms where practical. Reused #88/#97 cases remain development material. An LLM judge cannot supply sole ground truth.

Pair Qwen and the admitted challenger with fixed tasks/evidence/retrieval/skills/permissions, matched output/time budgets, documented native templates/parsers, and explicit reasoning ceilings. Thinking-on/off and backend/quantization differences have separate cells; differing backends are deployment comparisons. Counterbalance order and freeze repeat/cache/reset/stop rules before any output. Preserve failures, unsupported cells, retries, all expert calls, missing telemetry, and unknown stops. #102 separates measured provider charges, estimates, subscription use, and local compute. Zero-success cost per accepted task is undefined.

### Preserve the critical-failure veto

Graft Candidate A's full list and veto into B. Any observed critical authority/isolation failure blocks promotion regardless of average quality. Finite zero failures never prove universal safety. Freeze noninferiority, practical benefit, latency/memory ceilings, trial spend, and family sample sizes during a separate execution review after #100/#91. Valid recommendations remain retain Qwen, bounded challenger trial, defer, and insufficient evidence. Adoption/default changes need a separate scoped decision.

## Risks / Trade-offs

- Native templates may expose different capabilities. Record the difference rather than relaxing the common authority contract.
- A large shortlist encourages unbounded setup. Admit at most one challenger after source-only eligibility review.
- Research licenses may change or differ by artifact. Exclude ToolOrchestra production selection pending rights and recheck every artifact before execution.
- Synthetic tools hide live integration defects. Preserve actual orchestration, human clarification, privacy, and resource evidence as pending.

## Migration Plan

This plan performs no migration or model switch. Later work uses isolated benchmark state and append-only evidence. Preserve Qwen defaults and previous results. Remove only disposable future trial state when retiring a slice, with no user-data deletion implied.

## Review requested

Review the shortlist dispositions, one-challenger cap, shared validator contract, family case counts, actual hardware, license/runtime admissibility, noninferiority/benefit margins, resource/spend ceilings, and pilot sequencing. Approval of this plan does not authorize downloads, models, external tools, human trials, or automatic hosted escalation.
