# Design

## Context

See [proposal.md](proposal.md) for the problem. The planning branch starts at master `0b36edc6c2ead6b7094518d9d98747cd79c98b6e`. Existing candidate references are PR #89 `42fa20f`, PR #95 `d12cc75`, PR #97 `ba752455` and PR #101 `25c8fa5`; each is unmerged. A source inspection is not a runtime or product-use result.

## Goals / Non-Goals

The goal is the smallest falsifiable experiment for #91. This turn publishes planning artifacts only. It does not change production code, install tooling, invoke models or collect human observations. Review the proposed defaults below before Apply.

## Decisions

Reuse PR #101 and extend only uncovered branch/divergence and pilot cases. Compare ordinary Markdown, OpenSpec and the existing reviewed-snapshot/adoption-event candidate, without implementing another storage architecture.

- PR #101 at 25c8fa5 adds `packages/core/src/intent-document.ts`, `apps/vscode/src/intent-documents.ts` and `intent-commands.ts`. Its exact-byte adoption and handoff are unmerged candidate behavior, not released features.
- After explicitly selecting that implementation base, inspect existing `intent-document.test.ts`, `intent-documents.test.ts` and `intent-commands.test.ts` before adding only missing cases. Use IntentDocuments preview/adopt/handoff and the parser’s revision/hash boundaries.
- Extend `test/intent-pilot/README.md`, `BASELINE.md`, the #87 restore-scope fixture and a proposed machine-readable effort/outcome worksheet. Preserve blank human measurements until actually supplied.

This plan depends logically on PR #101 for later implementation, not on PR #89/#99. #87 supplies a restore-scope example; #92 can reuse accepted identities. #67 consumes findings without a second feedback ceremony. The plain-Markdown pilot remains the immediate product priority.

### Proposed defaults for review

Reuse the agreed 120-minute total pilot and existing plain-Markdown baseline first. Compare readable files, database-readable exports and the existing hybrid at the ownership/maintenance level, not by building both stores. At least two genuine resumptions and voluntary preference remain human evidence. No storage winner is preselected.

Use B as base with A’s add-only-uncovered-tests rule and machine-readable effort worksheet. Correct native syntax to CONTAINER, not PROFILE. Preserve the 120-minute pilot and original author/adopter distinction. Reject a second intent store or a claim that technical tests establish usefulness.

See [arena.md](arena.md) for both candidates, criterion scores and the independent cross-judgment. A plan review does not silently authorize later inference or human participation.

## Risks / Trade-offs

- Synthetic fixtures can validate bookkeeping while missing real behavior. Keep actual inference, containment and human-effort evidence separate and pending.
- A source or configuration change can invalidate findings. Pin immutable identities and expose stale results rather than quietly reuse them.
- Shared evaluation work can drift into a second platform. Reuse existing owners and introduce only this story’s bounded extension.

Reject a candidate that loses a consequential constraint, invents adoption or adds maintenance without observed effort benefit. Narrow to a handoff helper if that is the useful part; retain Markdown or an existing tool if easier.

## Migration Plan

No runtime migration is part of this planning PR. Future implementation chooses and records its exact dependency base after review. Use isolated disposable state, keep the baseline available and preserve unrelated files. A rejected proposal can be closed without changing product state.

## Review requested

Confirm the bounded scope and proposed defaults, inspect the case outcomes in [verification.md](verification.md), and record approval against this plan version before Apply. Later real-run sample counts, practical quality/effort margins, supported route and resource/spend ceilings must be agreed and frozen before measurement.

Actual Markdown comfort, matched OpenSpec/prototype activities and genuine resumed work remain pending. Stop expansion if ordinary Markdown is comfortable. Only continue against a specific gap, recording all setup, linking, review, reading, maintenance and correction effort through #100/#91. Any authority/storage contract change requires explicit review.
