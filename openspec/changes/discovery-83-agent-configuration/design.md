# Design

## Context

See [proposal.md](proposal.md) for the problem. The planning branch starts at master `0b36edc6c2ead6b7094518d9d98747cd79c98b6e`. Existing candidate references are PR #89 `42fa20f`, PR #95 `d12cc75`, PR #97 `ba752455` and PR #101 `25c8fa5`; each is unmerged. A source inspection is not a runtime or product-use result.

## Goals / Non-Goals

The goal is the smallest falsifiable experiment for #83. This turn publishes planning artifacts only. It does not change production code, install tooling, invoke models or collect human observations. Review the proposed defaults below before Apply.

## Decisions

Prepare a disposable roster and inspector, with a small canvas alternative over identical data. Support one sanitized repository-local SKILL.md bundle copied into experiment-owned state; preserve unsupported fields and original source bytes.

- Existing `packages/core/src/coordination.ts` separates bounded assignments and their revisions. Existing `apps/vscode/src/coordination-controller.ts` and `coordination-view.ts` are reference boundaries, not a template/import library.
- PR #89 repository-skills.ts discovers/captures bounded skill excerpts; it does not install, version or restore a global skill. Do not claim those capabilities exist on master.
- Proposed `test/agent-equipment/import-preview.mjs`, `import-preview.test.mjs`, sanitized fixtures and roster/canvas HTML keep this experiment out of production coordination.

#87 consumes version/dependency terminology without depending on a production template store. #102 owns later instruction-volume experiments. Map the lifecycle owners explicitly: grilling explores consequential gaps, OpenSpec records proposed scope/tasks, TDD builds approved work, pstack primarily verifies intended behavior and supported evidence, and archive records the completed reviewed change. Do not automatically retire or install any skill.

### Proposed defaults for review

One repository-local copied bundle. Global sources and linked originals remain read-only. Five prescribed activities cover start fresh, skip/import later, selected import with conflicts, versioned copy and composition verification. Keep optional drag/drop plus keyboard Add agent. No import, copy or preview launches an agent.

Use repaired B as base with A’s single inspected local format and copied ownership. Add the complete optional onboarding path, queue-time revalidation, criterion-bound evidence and workspace-wide contention. Reject silent Codex/Claude fidelity promises and skill-count-only success metrics.

See [arena.md](arena.md) for both candidates, criterion scores and the independent cross-judgment. A plan review does not silently authorize later inference or human participation.

## Risks / Trade-offs

- Synthetic fixtures can validate bookkeeping while missing real behavior. Keep actual inference, containment and human-effort evidence separate and pending.
- A source or configuration change can invalidate findings. Pin immutable identities and expose stale results rather than quietly reuse them.
- Shared evaluation work can drift into a second platform. Reuse existing owners and introduce only this story’s bounded extension.

Reject a configuration simplification that drops constraints, conceals unsupported mappings or adds review effort without useful understanding. A smaller instruction set is not automatically better.

## Migration Plan

No runtime migration is part of this planning PR. Future implementation chooses and records its exact dependency base after review. Use isolated disposable state, keep the baseline available and preserve unrelated files. A rejected proposal can be closed without changing product state.

## Review requested

Confirm the bounded scope and proposed defaults, inspect the case outcomes in [verification.md](verification.md), and record approval against this plan version before Apply. Later real-run sample counts, practical quality/effort margins, supported route and resource/spend ceilings must be agreed and frozen before measurement.

Human keyboard/scope/launch/cost prediction and comparison remain pending. Actual agent behavior is untested by the prototype. Before conversion or runtime integration, review each supported format, copy/link ownership and budget policy. Use #67’s existing human checkpoint if this experiment earns one.
