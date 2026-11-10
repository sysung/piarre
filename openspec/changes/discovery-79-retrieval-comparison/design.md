# Design

## Context

See [proposal.md](proposal.md) for the problem. The planning branch starts at master `0b36edc6c2ead6b7094518d9d98747cd79c98b6e`. Existing candidate references are PR #89 `42fa20f`, PR #95 `d12cc75`, PR #97 `ba752455` and PR #101 `25c8fa5`; each is unmerged. A source inspection is not a runtime or product-use result.

## Goals / Non-Goals

The goal is the smallest falsifiable experiment for #79. This turn publishes planning artifacts only. It does not change production code, install tooling, invoke models or collect human observations. Review the proposed defaults below before Apply.

## Decisions

Prepare an unchanged exact/FTS5 baseline and one bounded, source-derived relationship challenger. Preserve the existing exact, fts5, fts5-relations and compiler methods and the original fixture.

- Existing `scripts/evaluate-project-retrieval.mjs` and `test/acceptance/retrieval-fixture.json` on master own the comparison baseline. Extend them with a separate frozen manifest rather than replacing their corpus.
- Existing `ProjectRetrieval.search`, `rebuild` and `assertCapturedCurrent` in `apps/vscode/src/project-retrieval.ts` bind source currentness. `technical-lookup.ts` supplies compiler references for appropriate static questions only.
- Proposed `test/retrieval-comparison/manifest.json`, `README.md` and `test/retrieval-comparison.test.mjs` define neutral labels, source hashes, fixed evidence budgets, per-arm state and offline checks. These paths are not implemented by this PR.

#93 supplies technical cases and #94 supplies reporting. #58 supplies isolation; #88/PR #89 supplies any later local answer route. PR #97 at ba752455 is historical context-selection evidence, not completion of this comparison.

### Proposed defaults for review

Two neutral-labeled arms at the same frozen top-k and byte budget. Propose six matched activities: two business-rationale, two code-lookup and two changed/conflicting-information activities. Technical fault cases are separate from these human activities. Preserve C79-COMPARE-R1, pr-feedback-v1 and F-source-applicability-v1. Final human time and meaningful-benefit margins must be agreed before measurement.

Use B as base. Add A’s neutral arm mapping, assertCapturedCurrent checks, separate per-arm branches and explicit C79 checkpoint. Preserve every retained #79 requirement, including late history, revocation, slow sources and incomplete coverage. Reject a graph/vector rollout based only on the small historical keyword result.

See [arena.md](arena.md) for both candidates, criterion scores and the independent cross-judgment. A plan review does not silently authorize later inference or human participation.

## Risks / Trade-offs

- Synthetic fixtures can validate bookkeeping while missing real behavior. Keep actual inference, containment and human-effort evidence separate and pending.
- A source or configuration change can invalidate findings. Pin immutable identities and expose stale results rather than quietly reuse them.
- Shared evaluation work can drift into a second platform. Reuse existing owners and introduce only this story’s bounded extension.

Reject the challenger on any authority, deletion, isolation or currentness regression. Retain the baseline if additional supported answers and lower correction effort do not earn the extra setup/update/review burden. Recall alone cannot pick a winner.

## Migration Plan

No runtime migration is part of this planning PR. Future implementation chooses and records its exact dependency base after review. Use isolated disposable state, keep the baseline available and preserve unrelated files. A rejected proposal can be closed without changing product state.

## Review requested

Confirm the bounded scope and proposed defaults, inspect the case outcomes in [verification.md](verification.md), and record approval against this plan version before Apply. Later real-run sample counts, practical quality/effort margins, supported route and resource/spend ceilings must be agreed and frozen before measurement.

After offline readiness, give each implemented human-tested arm its own `codex/79-retrieval-<solution>` branch, worktree, state, PR and immutable bundle, including the baseline. Verify start/stop/reset and independent checks before inviting the existing single comparison checkpoint. Actual same-model generated-answer evidence, applicability ratings and final human selection remain pending.
