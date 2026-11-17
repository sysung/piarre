# Arena synthesis

## Contract and process

The requested artifact was a first usable PKM design plus a staged milestone/triage plan, grounded in the completed interview and current Rust PoC. The parent used two independent candidates with isolated output directories, followed by a read-only cross-judge after both candidates finished. No agents wrote to the same artifact. No implementation, tests, dependency installation, or tracker mutations were performed.

Runners followed the configured `arena runners` mapping: gpt-6.1-sol and gpt-6-astra at xhigh reasoning. The configured cross-judge pool contained those same model families; gpt-6-astra judged in a fresh context. This is an independent-context review, not independent empirical evidence or cross-provider consensus. Both candidates delivered; no dropouts occurred.

The parent read both designs end to end. The source candidates and cross-judge verdict are preserved in `arena/` as non-authoritative comparison evidence. The synthesized `design.md`, capability specs, `roadmap.md`, `tasks.md`, and `triage-plan.md` are the reviewable proposed result.

## Rubric and selection

Scores are ordinal design judgments on a 1-5 scale, not measured product performance.

| Criterion | Parent C1 | Parent C2 | Judge C1 | Judge C2 |
| --- | --- | --- | --- | --- |
| Fidelity to confirmed scope | 5 | 4 | 5 | 4 |
| Data ownership and recovery | 4 | 3 | 4 | 3 |
| Retrieval and claim integrity | 4 | 5 | 4 | 5 |
| Small usable implementation | 4 | 4 | 4 | 4 |
| Delivery and verification | 4 | 4 | 5 | 4 |
| Total | 21 | 20 | 22 | 20 |

Both selected Candidate 1. Its ignored local capture area avoids accidentally sharing session knowledge through ordinary broad staging. Its ownership and recovery rules were more concrete. The parent scored delivery lower than the judge because index work and conversational lifecycle needed more explicit child boundaries. The final plan makes those separate briefs while keeping them inside one usable release.

## Grafts and coherent revisions

Three focused grafts came from Candidate 2:

1. Reserve context for applicable explicit corrections and policies before ranked evidence, and disclose overflow rather than silently dropping constraints.
2. Separate intent, policy/correction, observation, and interpretation records, with lifecycle independent of evidence applicability.
3. Let the existing model propose structured capture during a normal turn, while the host validates sources, excerpts, identities, and transitions before announcing a save. Schema validity does not prove semantic correctness.

The cross-judge identified remaining gaps that the synthesis resolved explicitly:

- Withdrawal/deletion suppression is canonical local control state outside SQLite, survives old-checkout restoration, and requires explicit restoration to reactivate.
- Pending operation identities and actual receipts have explicit ordering. A crash after mutation but before a receipt leaves an unknown outcome unless evidence establishes it; matching bytes alone cannot prove actor or execution.
- Selected persistent workspace access, linked-worktree metadata, FTS5 availability, and real-model limits have owning tickets and direct acceptance evidence.
- An ordinary request to share a record preserves its ID and prepares text without a new approval ritual or automatic Git publication.

## Rejected alternatives and convergence

Candidate 2's untracked captures in the shareable directory were rejected in favor of ignored capture. Its persistent-volume copy was rejected because it introduces a separate import/export workflow around ordinary Git. The proposed selected-checkout profile still requires explicit review and narrow access qualification before implementation.

Both candidates suggested M4-M8 display numbering. The synthesis instead uses descriptive milestone titles and draft K/P IDs because the live project has M0-M3 and the earlier handoff's M4 boundary was ambiguous. The accepted foundation and complete-memory stages remain visible as K1 and K2 in the same first change.

Both candidates converge on readable text plus a disposable SQLite index, current-checkout retrieval, provenance separate from inference, no Git interception, and later merge/hooks/compression work. The final plan retains those choices. A general graph database, full transcript archive, and required second model were rejected.

The Separate Before Serializing Shared State principle led to isolated candidate outputs and worktree-local indexes. Redesign From First Principles led to treating Git sharing and private capture as original ownership constraints. Laziness Protocol favored the smaller Candidate 1 boundary. Prove It Works led to direct CLI validation and artifact inspection, without claiming runtime proof or adding an unauthorized verifier.

## Verification

`openspec validate project-knowledge-foundation --strict --no-interactive` passed. The original CLI readback found both proposed capabilities and 18 requirements, with 24 implementation tasks unchecked. Those counts describe the pre-SDD-revision package. Relative artifact links resolved, all artifact paths stayed inside the change root, and per-file whitespace checks passed for the newly created files. The working tree contains only the new change directory.

Original dependency inspection caught and removed a parent-to-own-child blocker. The later approved SDD revision below changes T0 ownership and blockers. All implementation scenarios remain unexecuted. OpenSpec's planning-complete status means documents exist; it does not mean implementation or human product acceptance is complete. GitHub publication and implementation remain separate next actions.

## Subsequent approved SDD and ADR revision

After Arena, the user confirmed that specs and ADRs should organize durable knowledge, while bounded edits keep Direct mode. The current design now targets `.piarre/specs/`, `.piarre/changes/`, `.piarre/changes/archive/`, and `.piarre/decisions/`, alongside supporting knowledge, skills, and ignored local state. Change designs reference durable ADRs rather than duplicating decisions.

T0 moved to P1/K1 and blocks T2 canonical storage implementation. The first slice includes a minimal explicit adoption/archive lifecycle and linked spec/ADR/change/evidence retrieval. K3 retains automatic workflow selection and broader existing-project integration. No existing planning files were relocated.

Candidate files and the cross-judge verdict remain unchanged historical evidence. Their scores do not evaluate this later revision; Arena was not rerun. The revision is checked through artifact consistency and strict OpenSpec validation.
