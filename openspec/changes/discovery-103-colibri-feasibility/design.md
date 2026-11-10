# Design

## Context

See [proposal.md](proposal.md) for motivation. This plan is based on `0b36edc6c2ead6b7094518d9d98747cd79c98b6e`. The local-client reference exists only in open PR #89 at `42fa20f42d6274dfddef43bc4a965c798cd90186`, in `apps/vscode/src/docker-model-runner-conversation-client.ts`. The inspected source restricts Docker-internal or literal-loopback HTTP `/engines/v1`, exact model identity, one in-flight nonstreamed request, a 60-second timeout, 6,000 UTF-8 prompt bytes, and 1,024 output tokens. It validates sourced JSON, rejects unsupported tools/reasoning, and reports cancellation as unconfirmed. No generic OpenAI-compatible API or GGUF claim satisfies that contract by itself.

Issue #94's benchmark exists only in open PR #95 at `d12cc75fdcca5532e180c8371b1b766df1155b08`, including `test/iteration-benchmark/metrics.mjs`, `metrics.test.mjs`, and `scripts/iteration-benchmark.mjs`. Current token usage is unknown. No PR implementation is copied into this plan branch.

Issue #103 records an upstream inspection dated 2026-11-09 at Colibri commit `0a5504a1dc64f86fcd0fe7db298b0448c730e7e6`. Primary references are the pinned [README](https://github.com/JustVugg/colibri/blob/0a5504a1dc64f86fcd0fe7db298b0448c730e7e6/README.md), [Metal notes](https://github.com/JustVugg/colibri/blob/0a5504a1dc64f86fcd0fe7db298b0448c730e7e6/docs/metal.md), [benchmarking protocol](https://github.com/JustVugg/colibri/blob/0a5504a1dc64f86fcd0fe7db298b0448c730e7e6/docs/benchmarking.md), and [API notes](https://github.com/JustVugg/colibri/blob/0a5504a1dc64f86fcd0fe7db298b0448c730e7e6/docs/api.md). This authoring phase uses that supplied source record offline. It does not refresh upstream or reproduce its results.

## Goals / Non-Goals

Produce a no-download eligibility report and evaluate at most two useful practices. Do not implement a Colibri client, relax the existing adapter, start a server, acquire a large model, or infer target-device suitability. Expert-weight routing is distinct from project-evidence retrieval and cannot replace currentness or accepted-intent authority.

## Decisions

### Keep two lessons within existing owners

Select Candidate B's small proposed `test/iteration-benchmark/local-routes/colibri/` report and recorded telemetry rows. Extend existing `metrics.mjs`/`metrics.test.mjs` only for accepted useful fields. Graft Candidate A's pinned source identity and labeled arithmetic check. A new provider client or custom inference engine would add unearned scope. See [arena.md](arena.md).

The two proposed lessons are phase/resource telemetry, and admission/stop accounting. #94 owns their metric representation; #102 consumes whole-task results; #90 owns cache applicability. Record queue, load, prefill/first useful response, decode, total HTTP request, cancellation acknowledgment, RAM/swap, and storage observations. Mark clock domains and overlapping intervals so totals cannot double-count. Separate provider-prefix, local retrieval/index, operating-system/expert cache, and reused-answer state. Missing phases remain unknown.

### Separate claims before comparing deployments

The report records exact source/artifact/license/backend/API/template identity and marks each statement upstream-documented, arithmetic, recorded-fixture, locally observed, or unresolved. Keep upstream dense-resident-weight claims separate from peak total RAM, expert buffers, KV/context state, page cache, runtime, free disk, and storage I/O. Issue-recorded 429 GB download and 16/24 GB minimum/measured RAM are upstream metadata, not this machine's inventory or a fit result. The historical 25 GB-available laptop and other GPU/Mac results describe different operating points.

Add an arithmetic sanity fixture: 100 decoded tokens divided by 0.05 to 0.1 token/s is about 1,000 to 2,000 seconds, or 17 to 33 minutes excluding prefill/overhead. This is an arithmetic illustration of issue-recorded rates, not an M3 Pro/36 GiB forecast. The runtime's opt-in experimental Metal notes do not establish compatibility on that target.

### Compare API and control contracts without implementing a route

Map issue-recorded upstream `/v1` and native model behavior against the actual `/engines/v1` endpoint, identity, prompt/output/deadline, source-support, serial-request, and interrupt contracts. Check missing or ignored fields, unsupported architecture/quantization/template/tool format, malformed/truncated JSON, citations, timeout, model mismatch, and public endpoints with recorded fixtures. Use starts, fits, responds correctly, and meets latency as separate judgments.

If later authorized, a tiny-model HTTP control can isolate transport faults. It cannot demonstrate large-model quality/resource fit or Piarre usefulness. Recorded HTTP fixtures prove parser/accounting contracts only, not actual retention, network privacy, artifact legality, backend inactivity, or cancellation behavior. Inspect and test those on the exact approved runtime before any such claim.

A runtime-only comparison requires matched weights/template/settings and fixed task evidence. Otherwise report a deployment comparison with confounders. Prefer no trial unless the exact artifact is supported and interactive latency/resource criteria are credible. Retain Docker Qwen by default; no automatic hosted fallback or model switch follows from a complete eligibility row.

## Risks / Trade-offs

- Upstream source may drift. Keep the supplied pinned identity and perform a fresh source/rights review only when separately authorized.
- Large artifacts and storage traffic can make trials impractical. Unknown device disk/RAM/I/O and resource ceilings block admission, never imply download permission.
- Mock privacy or stop assertions can overclaim safety. Retain explicit unverified runtime evidence fields.
- Extra telemetry can become another framework. Admit at most the two reviewed lessons through #94/#102.

## Migration Plan

After human plan/test-boundary agreement and explicit Apply, resolve #95 integration and add only the offline report/recorded accounting fixtures with red, minimum green, and refactor checks. Run independent configured Sol+Astra Interrogate and concrete Blast Radius probes, fix accepted findings, and reverify. Adopting a lesson requires evidence and the owning issue's review. A backend trial/client needs its own later plan and execution authorization, preserving current route behavior as the baseline.

## Review requested

Confirm the two lessons, provenance labels, compatibility fields, and offline test boundary. Before any runtime trial, agree exact artifact/license/backend, target inventory, context/output settings, retention/privacy inspection, interactive-quality/latency margins, sample/order/cache/reset protocol, resource/stop limits, and budget. Pilot #100/#91 remains the priority. Publish the plan, then wait for human review before Apply. No device suitability or discovery completion is claimed.
