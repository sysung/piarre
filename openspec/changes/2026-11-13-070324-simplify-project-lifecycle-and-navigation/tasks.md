# Tasks

The [design](design.md) owns the implementation shape and [canonical verification plan](design.md#verification-plan). V01–V12 below refer to that plan. Checkboxes record verified progress. Perform each correctness slice as a failing behavioral test, minimal fix, green test and refactor; do not write all tests first or call static analysis a red run.

## 1. Establish the implementation baseline

- [x] 1.1 Create or identify a new feature issue and issue-linked clean branch containing consolidated documentation and the archive; transfer only this change and record the actual baseline SHA. Verify the caller inventory and relevant differences from the audited SHA under V01.
- [x] 1.2 Capture the original README, principles body, research, archive hashes and catalog mappings for preservation comparison; verify the existing archive checker passes and record the baseline under V02. Do not regenerate its source manifest.

## 2. Contributor navigation and document presentation

- [x] 2.1 Add the explicit editor exclusions from D5; verify actual Explorer/Search visibility, reversible historical search and unchanged Git/package/skill access under V03.
- [x] 2.2 Fold README details and add the principles anchor index without changing original substantive text; verify stripped-wrapper/body equality, rendered command blocks and links under V02. Keep overview, workflow and research intact.
- [x] 2.3 Remove the two placeholders only after empty/populated-directory checks, and remove inactive config examples while preserving real settings; run contract tests, strict OpenSpec validation and V02–V03, then record the verified stage commit.

## 3. Project lifetime correctness

- [x] 3.1 Add a controlled partial-open failure and immediate same-root retry regression in the Host fixture; execute it against the baseline and record the intended V04 failure before changing lifecycle code.
- [x] 3.2 Introduce the private scope/attempt ownership and immediate cleanup registration from D2; remove independent nullable globals and repair failed-open rollback. Verify V04 turns green and trusted/untrusted activation still works.
- [x] 3.3 Add and run deterministic A-to-B and dispose-during-open regressions, then guard stale success, failure and attempt cleanup; verify V05 is green with no obsolete controls, errors or visits.
- [x] 3.4 Inventory repository-touching continuations and preserve or add captured-instance checks where retirement can intervene, including native dialogs, lookup, conversation and status callbacks. Verify V05 plus existing controller behavior without redesigning those controllers.
- [x] 3.5 Make retirement/disposal idempotent and continue cleanup after a throwing resource, with DB close last; verify throwing-disposer and late-provider tests plus V06 Stop/recovery visibility and durable uncertainty.
- [x] 3.6 Record lifecycle test evidence, updated developer guidance only if behavior requires it, and the verified stage commit. Verify V04–V06 and typechecking before starting dependent pane work.

## 4. Explicit acceptance of recovered integration

- [x] 4.1 Add a real source-changing integration/restart regression that drives the offered acceptance control and native confirmation; record the V07 baseline failure and unreviewed state before implementation.
- [x] 4.2 Implement the host-only tagged review binding and mode-specific dialog from D3; migrate all applyAndAccept callers/tests and remove that old entry point. Verify V07 green with one original publication/checkpoint and no journal creation during acceptance-only review.
- [x] 4.3 Add cancel, exact replay, concurrent confirmation and drift-during-modal cases, including applicable check changes with unchanged file hashes; implement required revalidation and prove V08 plus idempotent V07 outcomes.
- [x] 4.4 Inventory coordinator restore callers, migrate meaningful direct tests to production recovery/adapter coverage, and remove test-only entry points only if proof permits. Verify V09 historical replay and preserved bytes; otherwise record retained methods and the concrete missing proof.
- [ ] 4.5 Consolidate only remaining identical publication begin/end bookkeeping privately if it deletes duplication without moving authority or adding branch flags; otherwise record why no extraction is warranted. Verify V09 owner exclusion/journal failures and V07–V08, update affected review wording/guidance, and record the verified stage commit.

## 5. Detail identity and document mechanics

- [ ] 5.1 Add actual rendered-control regressions for identical-looking records, obsolete documents, wrong current-document targets/actions, and selection changes during confirmation; execute baseline failures for V10 before changing routing.
- [ ] 5.2 Bind cache, messages and host-rendered control lookup to project instance, record and document identity. Carry origin checks through ExecutionUi/RecoveryUi and deletion confirmation. Verify V10 green and remove old unbound listeners/caches in the same change.
- [ ] 5.3 Extract only shared detail-document mechanics, preserving pane-specific selection, disposal and state policies; verify V11 scroll/disclosure/focus, repeated controls, reduced motion, unsent Work text and responsive Stop in actual webviews.
- [ ] 5.4 Update fixtures to use real rendered envelopes, record V10–V11 evidence and any changed user-facing guidance, and record the verified stage commit. Verify all prior positive proposal/review/recovery actions still work.

## 6. Integrated verification and review

- [ ] 6.1 Execute the canonical verification command set and V12 trusted/restricted Host, SQLite receipt/replay and package checks on the integrated revision; rerun V02 preservation. Record exact SHAs, environment, commands and outcomes; label environmental blockers rather than passing them.
- [ ] 6.2 Independently review the final architecture and affected callers for stale authority, duplicate old/new paths, hidden documentation and recovery regressions. Resolve findings, rerun affected checks, and verify the V01–V12 evidence index is complete without claiming the retained pending product criteria passed.
- [ ] 6.3 Update proposal History with implementation issue, PR, verified commits and evidence links; verify remote delivery state if publishing is requested and keep human acceptance distinct from automated checks.

## Workflow follow-up

- Stop after implementation and verification for review; do not merge or archive merely because tasks or validation pass.
- Archive through the OpenSpec archive workflow after explicit request, including delta-sync assessment and repaired archive links.
