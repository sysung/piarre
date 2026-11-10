# Design

## Context

See [proposal.md](proposal.md) for the problem. The planning branch starts at master `0b36edc6c2ead6b7094518d9d98747cd79c98b6e`. Existing candidate references are PR #89 `42fa20f`, PR #95 `d12cc75`, PR #97 `ba752455` and PR #101 `25c8fa5`; each is unmerged. A source inspection is not a runtime or product-use result.

## Goals / Non-Goals

The goal is the smallest falsifiable experiment for #87. This turn publishes planning artifacts only. It does not change production code, install tooling, invoke models or collect human observations. Review the proposed defaults below before Apply.

## Decisions

Prototype history, exact diff and reviewed restore for one copied synthetic skill and explicitly enumerated local assets. Full immutable snapshots create a new monotonic revision linked to the current head and historical content.

- Existing `apps/vscode/src/sqlite-project-repository.ts` dispatch/receipt transaction and core knowledge supersession provide authority/idempotence references. Existing execution recovery concerns workspace files, not skill history.
- Existing `packages/core/src/knowledge.ts`, `execution.ts` and `recovery.ts` distinguish current knowledge, freshness, approvals and recovery; preserve those distinctions rather than reviving historical authority.
- Proposed `test/skill-restore/restore-prototype.mjs`, `restore-prototype.test.mjs`, fixtures and a history/diff/confirm view use only disposable experiment-owned state. No production event variant is added in the first slice.

#83 supplies manifest terminology and #91 the accepted-scope example. Neither requires building a template platform or migrating the authoritative runtime event log.

### Proposed defaults for review

One copied skill, its instructions and enumerated local asset/config hashes. Capture three revisions and restore an earlier version as a fourth revision. Retain that small fixture history for the trial; production retention, external dependencies and linked/global restoration remain separate decisions. No pre-capture history is invented.

Use B’s full-snapshot and identical-bytes controls. Add A’s symlink/path-escape rejection, forgotten-target check and queued-launch revalidation. Reject restoring live/global skills or treating workspace recovery as an existing skill-restore implementation.

See [arena.md](arena.md) for both candidates, criterion scores and the independent cross-judgment. A plan review does not silently authorize later inference or human participation.

## Risks / Trade-offs

- Synthetic fixtures can validate bookkeeping while missing real behavior. Keep actual inference, containment and human-effort evidence separate and pending.
- A source or configuration change can invalidate findings. Pin immutable identities and expose stale results rather than quietly reuse them.
- Shared evaluation work can drift into a second platform. Reuse existing owners and introduce only this story’s bounded extension.

Reject whole-project Git reset or a patch-only history that cannot explain exact scope and provenance. Reject any loss of unrelated bytes, duplicate restore, forgotten-data resurrection or revived approval.

## Migration Plan

No runtime migration is part of this planning PR. Future implementation chooses and records its exact dependency base after review. Use isolated disposable state, keep the baseline available and preserve unrelated files. A rejected proposal can be closed without changing product state.

## Review requested

Confirm the bounded scope and proposed defaults, inspect the case outcomes in [verification.md](verification.md), and record approval against this plan version before Apply. Later real-run sample counts, practical quality/effort margins, supported route and resource/spend ceilings must be agreed and frozen before measurement.

Real user skill changes, representative model behavior, human scope/recovery understanding, memory rollback and production retention remain pending. Any later production restore requires a reviewed scope/ownership contract and fresh execution authority.
