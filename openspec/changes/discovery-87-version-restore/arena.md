# Arena synthesis

Two independent configured candidates, Sol and Astra, planned this story. The parent read both end to end. Astra cross-judged evidence grounding, discovery validity, scope/authority, executable verification and reuse, each scored 0–2. These are review judgments, not measured model or product performance.

| Candidate | Evidence / discovery / authority / execution / reuse | Selected base |
| --- | --- | --- |
| A, Sol | 2/2/2/2/2 | No |
| B, Astra | 2/2/2/2/2 | Yes |

## Candidate A

## #87: scoped history and restore

**Objective/verdict.** Explore history → diff → restore for one Piarre-owned synthetic skill and assets. Verdict: append-only single-item prototype; memory correction, workspace reset and linked global-file overwrite remain separate operations.

**Implementation after review.** Add `test/skill-history/{fixtures,restore-model.mjs,restore.test.mjs,README.md}`. Version a content/dependency/override manifest; a reviewed restore creates a new monotonic revision linked to prior head and target. Compare snapshot, patch and Git aids, retaining one event authority. Read actual `KnowledgeAction`/`applyKnowledgeEvent`/`knowledgeEvent`, `SqliteProjectRepository.dispatch`, `RecoveryRecord` and `ExecutionCoordinator.previewRecovery/recover`; do not pretend current recovery already handles skill histories. The experiment should use disposable state and explicit copy ownership, not introduce production event variants yet.

**Tests first/falsification.** Two edits then restore first content, reopen and assert new revision/provenance; unrelated skill/memory/workspace hashes unchanged. Reject stale preview after manual edit, missing/forgotten target or asset, denied scope, symlink/path escape and active/unknown writer. Replay duplicate request/lost acknowledgment and crash checkpoints with deterministic journal recovery. Queued launches revalidate dependencies; running sessions retain pinned versions. A restored historical pass/permission must remain stale.

**Verification/pending.** `node --test test/skill-history/restore.test.mjs`; inspect persisted histories and explicit partial/unknown outcomes. #83 supplies ownership/version semantics; #91 supplies accepted scope example. Real skills remain untouched; representative behavior comparison and human comprehension of scope/recovery are pending. Reject whole-project Git reset because it cannot express this scope or current authority. Open decisions: asset closure, retention policy and later event schema.

## Candidate B

## #87: skill history and restore

**Verdict and objective.** Prototype single-item restore in a disposable Piarre-owned copy. Do not restore a real skill or treat checkpoint recovery as skill history.

**Small deliverable.** Add new `test/skill-restore/` fixtures, `restore-prototype.mjs`, tests and a history/diff/confirm view. Represent captured content and required assets by immutable hashes; a restore creates a new revision referencing both current head and selected historical content. Reuse the event/receipt expectations in `SqliteProjectRepository.dispatch`, `knowledge.ts` correction/supersession and `planFreshness`, while keeping the experiment out of canonical production events until its authority contract is reviewed. Existing `RecoveryRequest` and `ExecutionCoordinator.previewRecovery/recover` concern workspace recovery and are reference boundaries only.

**Tests first.** Edit twice, restore the first content, restart, and verify monotonic history plus unchanged unrelated files/memories. Reject edited-after-preview, missing assets, renamed/deleted source, revoked access, forgotten content, stale approval and duplicate changed-payload requests. Inject crash before/after commit and lost acknowledgment. Active and queued copies keep pinned versions; unknown writers block application. Restored content never revives passing evidence or execution grants. The negative control restores identical bytes without pretending old authority returned.

**Verify and pending.** Run `node --test test/skill-restore/restore-prototype.test.mjs`; verify filesystem hashes and journals after each fault. #83 supplies manifest terminology, #91 supplies accepted intent, but this slice can use fixed manifests without waiting for a template platform. Prefer full snapshots for the bounded trial; reject Git-only history because pre-capture and acceptance identities are unavailable. Retention limits and linked-source support remain open. Human scope comprehension and authorized skill-behavior trials remain pending.

## Selected synthesis and rejected alternatives

Use B’s full-snapshot and identical-bytes controls. Add A’s symlink/path-escape rejection, forgotten-target check and queued-launch revalidation. Reject restoring live/global skills or treating workspace recovery as an existing skill-restore implementation.

The selected base is B. The synthesized contract is in design.md and verification.md, which supersede any stale source or command examples in the candidate excerpts above. In particular, use benchmark PR #95 head `d12cc75`, the CONTAINER argument for native intent verification, and an installed-host route that cannot implicitly download VS Code. Both candidates converge on offline preparation and preserving the existing pilot; neither recommends claiming complete discovery results from fixtures.

## Review checkpoint

The current user decision covers all twelve stories, offline-only work and plan publication followed by human review. No Apply, TDD implementation, runtime verification, Interrogate of new code, Blast Radius execution or Archive is complete. All later tasks remain pending.
