# Design

## Context

See [proposal.md](proposal.md) for the problem. The planning branch starts at master `0b36edc6c2ead6b7094518d9d98747cd79c98b6e`. Existing candidate references are PR #89 `42fa20f`, PR #95 `d12cc75`, PR #97 `ba752455` and PR #101 `25c8fa5`; each is unmerged. A source inspection is not a runtime or product-use result.

## Goals / Non-Goals

The goal is the smallest falsifiable experiment for #93. This turn publishes planning artifacts only. It does not change production code, install tooling, invoke models or collect human observations. Review the proposed defaults below before Apply.

## Decisions

Keep an unchanged exact+FTS5 arm and one bounded source-derived reverse-module relationship arm at identical evidence limits. Preserve the original fixture and separate retrieval recall from generated-answer support, unsupported claims and abstention.

- Extend existing `scripts/evaluate-project-retrieval.mjs` with explicit development/held-out manifests and evaluator/scorer controls. Preserve `test/acceptance/retrieval-fixture.json`; proposed `retrieval-heldout.json` is a new artifact.
- Use actual `ProjectRetrieval` and source-derived relationships. Compiler references are eligible only for appropriate static questions; dynamic relationships require explicitly observed or labeled synthetic evidence.
- Reuse PR #97 at ba752455 for exposed development cases and freshness examples. Its full required-source coverage and distractor-use difference do not establish production-controller behavior or satisfy this exact comparison. Share scenario/result identity with #94/PR #95 at d12cc75 instead of cloning the runner.

Actual answer generation requires #88/PR #89. #94/PR #95 owns the common manifest/results. #79 consumes the technical evidence; PR #97 historical keyword/dense experiments remain supporting exposed research, not a replacement comparison.

### Proposed defaults for review

Propose twelve fresh questions, two each for exact lookup, paraphrased rationale, multi-file relation, changed/conflicting intent, unanswerable cases and dynamic dependency. Independently author and review keys before tuning, freeze source/evidence budgets, and record exposure. Natural versus injected dynamic cases remain distinct.

Use A as base for the explicit unchanged exact+FTS5 versus bounded reverse-module relationship comparison. Refresh #94 to d12cc75 and graft B’s distinction between full source coverage and distractor-use failure. Reject lexical-only retesting, fake fresh holdouts and completion from retrieval-only checks.

See [arena.md](arena.md) for both candidates, criterion scores and the independent cross-judgment. A plan review does not silently authorize later inference or human participation.

## Risks / Trade-offs

- Synthetic fixtures can validate bookkeeping while missing real behavior. Keep actual inference, containment and human-effort evidence separate and pending.
- A source or configuration change can invalidate findings. Pin immutable identities and expose stale results rather than quietly reuse them.
- Shared evaluation work can drift into a second platform. Reuse existing owners and introduce only this story’s bounded extension.

Retain exact+FTS5 if relationship expansion fails to improve fully supported questions at the fixed limit or introduces false dependencies/currentness regressions. Embeddings, reranking and graphs require a demonstrated remaining miss and separate scope.

## Migration Plan

No runtime migration is part of this planning PR. Future implementation chooses and records its exact dependency base after review. Use isolated disposable state, keep the baseline available and preserve unrelated files. A rejected proposal can be closed without changing product state.

## Review requested

Confirm the bounded scope and proposed defaults, inspect the case outcomes in [verification.md](verification.md), and record approval against this plan version before Apply. Later real-run sample counts, practical quality/effort margins, supported route and resource/spend ceilings must be agreed and frozen before measurement.

Issue #88/PR #89’s frozen local route and actual paired same-model inference remain required for completion after the pause is explicitly revisited. Freeze artifact/runtime/hardware/prompt settings, all attempts and independent source-support judgments. Offline retrieval/mocks cannot replace that evidence. #79 still owns runnable human arms and user selection.
