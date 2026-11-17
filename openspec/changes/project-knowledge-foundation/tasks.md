# Tasks

Implementation checklist only. No task is complete merely because this plan exists. Milestone and ticket IDs are draft IDs defined in [triage-plan.md](triage-plan.md). Implementation requires actual PoC acceptance, approval of this change, and review of the selected-checkout persistence boundary. New tests and standalone verifiers require separate explicit authorization; use existing checks and observable manual behavior below.

## 0. Qualify the specification foundation (T0, P1)

Blocked by completion of M3 UAT (#138) and explicit acceptance (#165), including read-only investigation.

- [ ] 0.1 Inspect pinned OpenSpec root, skill/template, validation, sync, and archive contracts; deliver a concrete compatibility finding for direct `.piarre/specs/`, `.piarre/changes/`, and `.piarre/decisions/` paths, with unsupported behavior identified.
- [ ] 0.2 Qualify the proposed explicit spec/ADR lifecycle in an isolated authorized fixture; inspect proposal/delta handling, exact-revision adoption, ADR status/supersession, archive links, and interrupted-operation reporting. Do not implement a fork or relocate this repository.
- [ ] 0.3 Record the reviewed integration choice and rollback implications before T2; if the target layout is unsupported, revise the design instead of substituting another layout or deferring the prerequisite.

## 1. Qualify the selected project profile (T1, P1)

- [ ] 1.1 Verify the recorded human acceptance at #165 and inspect the accepted PoC tool/result and request-limit contracts; deliver a revision-bound prerequisite note with failures and unknowns rather than treating issue closure as acceptance.
- [ ] 1.2 Add the reviewed selected-checkout profile while preserving disposable defaults; verify V1 with a harmless project, restart, stopping without deletion, and denied access outside the selected checkout.
- [ ] 1.3 Resolve project/worktree identity and read-only Git metadata boundaries; verify a normal checkout and linked worktree or document an explicit unsupported-layout error without expanding mounts.
- [ ] 1.4 Document enable, stop, disable-memory, and recovery behavior with the profile; run the documented launch procedure and existing build checks at the resulting revision.

## 2. Persist specifications and supporting records safely (T2, P1)

Requires T0 qualification and T1 persistence.

- [ ] 2.1 Define schema-versioned record kinds, source identity, exact excerpts, lifecycle, typed links, and direct-source revision semantics; inspect representative correction, policy, observation, and inference records against the project-knowledge spec.
- [ ] 2.2 Implement ignored local canonical capture and user-selected shareable text with the same stable IDs; verify ignore enforcement, deliberate sharing, identical-copy deduplication, and divergent-ID conflict reporting using actual files.
- [ ] 2.3 Implement expected-content writes, replay identity, local writer protection, and persistent suppression controls; verify interrupted writes and old-checkout restoration do not overwrite newer edits or reactivate withdrawn guidance.
- [ ] 2.4 Implement the qualified explicit spec/change/ADR lifecycle and typed references without duplicate authoritative records; verify V11 with adopted specs, proposed deltas, ADR supersession, archived history, and incomplete-adoption recovery.
- [ ] 2.5 Document record ownership, manual editing, unsupported-schema behavior, and deletion limits; verify the examples by reading their resulting files and run existing applicable checks.

## 3. Reconcile and retrieve current evidence (T3, P1)

- [ ] 3.1 Add the local derived SQLite/FTS5 index in the selected runtime; verify installation/build success and rebuild from canonical text after deleting the cache.
- [ ] 3.2 Reconcile current checkout and record fingerprints before retrieval; verify V5-V6 for manual edits including unchanged timestamps, removal, branch/worktree separation, merge conflicts, malformed metadata, and missing targets.
- [ ] 3.3 Assemble bounded context across specs, ADRs, active/archived changes, and supporting records, with corrections/policies before ranked evidence; verify V11 source status and available links plus unrelated, conflicting, missing-link, and over-budget cases.
- [ ] 3.4 Document source expansion and degraded-retrieval behavior; verify a current-source read or explicit unavailable result replaces stale cached claims, without a model call merely to refresh the index.

## 4. Use a correction across sessions (T4, P2)

- [ ] 4.1 Integrate exact user-source capture proposals into the real local conversation with host validation; verify that assistant prose cannot become a user source and ambiguous scope produces a focused Recommendation only when consequential.
- [ ] 4.2 Inject selected evidence into normal requests and expose resolvable citations; verify V2 with restart and a paraphrased task, then an unrelated-component control, on the actual configured local model.
- [ ] 4.3 Enforce honest save reporting and request/output bounds; simulate a save failure through ordinary environment conditions, inspect the unsaved result, and document capture limits without adding a verifier.

## 5. Explain an artifact's purpose (T5, P2)

- [ ] 5.1 Connect original request intent to actual accepted file-tool receipts, with a minimal pending identity and completion ordering; verify V8 for replay, cancellation, failure, and crash uncertainty without inferring execution from matching file bytes alone.
- [ ] 5.2 Preserve the SQL request, successful write identity, and historical purpose across restart; verify V3 by inspecting the real artifact and cited record, with no claim that SQL was executed or forecasts were validated.
- [ ] 5.3 Detect changed/missing artifact support while retaining historical intent; verify V4 and a missing-rationale control and document what exact source coverage establishes.

## 6. Manage knowledge conversationally (T6, P2)

- [ ] 6.1 Support inspect, scoped correction, and explicit supersession with existing intent authorization; verify the 30-day to 45-day policy journey and that old but unsuperseded policy does not expire by age.
- [ ] 6.2 Support withdrawal, deletion, and explicit restoration with persistent local controls; verify V7 after restart, cache rebuild, and restoring older shared records, including accurate Git-history limitations.
- [ ] 6.3 Support an ordinary request to make a chosen record shareable without staging or publishing; verify V9 in a fresh clone and document the difference between local capture, shared text, and team baseline adoption.

## 7. Review the complete first slice (T7, P2)

- [ ] 7.1 Run the integrated V1-V9 and V11 scenarios on the exact local model, runtime, and build with direct source/receipt inspection; record passed, failed, unsupported, and unexecuted outcomes separately from existing build/check results.
- [ ] 7.2 Compare both memory scenarios with ordinary project notes plus the same agent under matched conditions; record retrieval selection, answer correctness, missed constraints, user corrections, context, latency, and observed resource limits without generalizing from small samples.
- [ ] 7.3 Conduct the human acceptance session and record accept, narrow, or defer with remaining limitations; passing commands alone does not close P2 or authorize later milestones.

## Workflow follow-up

- T0 is a K1 foundation prerequisite for T2. Compatibility work begins only after M3 UAT completion (#138) and explicit acceptance (#165); fixture execution follows its scoped authorization. This task list does not authorize relocating the current repository. K3 later owns automatic workflow selection and broader existing-project migration.
- Milestones, parents, and children were published at the user's request; see publication-map.md. Publication completes no implementation checkbox. Native blockers preserve M3 UAT and explicit acceptance.
- Refresh the capability catalog against the implementation base before applying or synchronizing this change. Reconcile any intervening PoC adoption explicitly.
- After actual implementation and acceptance, separately synchronize and archive through the owning OpenSpec skills. No sync/archive or Git publication is authorized by this checklist itself.
