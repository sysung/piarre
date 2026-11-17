# Candidate 2: a project memory that explains its evidence

This proposal makes one complete workflow usable after actual PoC acceptance. A user corrects an unsupported assumption, creates a SQL artifact for a stated purpose, closes Piarre, and returns. Piarre respects the correction and explains the artifact's purpose with the original request and observed operation. It distinguishes that purpose from what the current SQL actually does.

## Baseline and release boundary

The inspected `src/main.rs` keeps `Vec<Message>` only in memory. It has a fixed 128-token response limit and no file tools or persistence. The active PoC design expressly excludes retrieval and persistence. Its disposable `/workspace` is discarded on teardown. These are future requirements, not existing capabilities.

The implementation therefore waits for recorded acceptance behind issue #165, including its actual prerequisites. Closure alone is insufficient. The first PKM release also adds an explicit durable project mode. I recommend an operator-selected project stored in a persistent container volume for the initial release. Keep personal filesystem access a separate opt-in boundary. Restart preserves the selected project, while destroying that project remains an explicit operation. This introduces persistence without silently changing the disposable chat trial.

Planning remains in the current `openspec` root. The target organization is `.piarre` for canonical knowledge, skills, and AI workflow artifacts. Do not relocate existing OpenSpec artifacts until compatibility has been established.

## Ownership and record model

Use one Markdown file per stable record ID, with validated frontmatter and readable source excerpts. SQLite is a local derived index. It is never authoritative or committed.

A record contains its schema version, project ID, record ID, kind, scope, lifecycle, source references, typed links, and text. Keep these concepts independent:

- `Intent` records why the user wants an outcome. `Policy` records an explicit restriction or continuing instruction. Both cite the user's exact minimal wording.
- `Observation` records an inspected file or completed operation, including revision, content hash, path, result, and observation time.
- `Interpretation` records an inference and its supporting sources. It remains provisional until the user adopts it. Adoption establishes intent where relevant, never proof of code behavior.
- Lifecycle is active, superseded by a named record, or withdrawn. Evidence availability and staleness are separate properties. A policy does not expire because its linked file changed.

Typed links initially need `supports`, `corrects`, `supersedes`, and `concerns-artifact`. The SQL operation receipt links the stated intent to the actual artifact identity and before/after hashes. A failed write cannot produce a completed-operation observation. Imported SQL without a source has unknown purpose.

This applies the Model the Domain principle. Separate record kinds and lifecycle transitions prevent one confidence flag from conflating user authority, code truth, and freshness.

## Local capture and ordinary Git

Proposed paths are `.piarre/knowledge/<id>.md`, `.piarre/skills/`, and ignored `.piarre/local/` for SQLite, locks, and checkout bookkeeping. Auto-captured records begin as ordinary untracked text. Automatic corrections add a new superseding record instead of rewriting a committed statement in place. Piarre never stages, commits, or pushes these records automatically.

The user can stage selected records through normal Git. This needs no new publication ceremony. Report “untracked,” “locally committed,” or a specifically known remote revision. Do not infer that a committed record was pushed. Preserve the minimal source excerpt inside its record so deliberate sharing does not depend on an unavailable transcript.

Project identity is portable. Each worktree has its own ignored runtime identity and index. Uncommitted captures record their originating checkout and branch context. They do not become applicable on another branch merely because Git left untracked files in place. Committed records present in the current checkout are evaluated with their declared scope. Branch rename, detached HEAD, and externally moved local records need explicit reconciliation rules rather than guessed continuity.

Normal commit/push/pull commands trigger no knowledge review, AI calls, or edits. Main establishes an accepted baseline only at the last known revision. Feature-branch proposals guide that checkout without fetching main before every turn.

## Turn flow and control

On project open and before a knowledge-dependent turn, inspect HEAD, relevant Git state, and the bounded knowledge directory. Hash canonical text to catch external edits even when timestamps are misleading. Update changed and deleted index entries in one SQLite transaction. No filesystem hook, AI process, or manual synchronization is required.

Selection starts with project and checkout scope. Include applicable active policies and corrections before ranked search. Then use exact IDs and artifact paths, SQLite FTS5, and a bounded traversal of typed links. Reserve separate context budgets for policies, evidence, and conversation. If required policies exceed the budget, report the limitation instead of silently dropping restrictions. Source text enters as quoted data and cannot grant permissions.

For a correction, preserve the user's wording and the affected assumption without a second approval. If the replacement is uncertain, stop using the rejected assumption and retain that uncertainty. Inspect factual questions before asking the user. Clarify consequential unresolved intent. Low-impact authorized assumptions may proceed provisionally, with no invented rationale.

The existing local model may propose structured capture operations during its normal turn. Rust validates IDs, scope, exact source excerpts, and lifecycle transitions before persistence. The model cannot designate its own prose as user authorization. Saving succeeds before Piarre says it remembered something. Failed capture remains visibly unsaved.

The conversational interface supports inspection, correction, supersession, stop-use, and deletion. Stop-use retains provenance but excludes a record from future answers. Deletion removes the active record and cached excerpts, and explains that prior Git history or remote copies may remain. A user instruction to make a scoped change already authorizes that change.

## Failure and recovery

Canonical writes use a worktree-local writer lock, temporary files, and atomic rename. Stable operation IDs make interrupted capture recoverable without duplicate records. A later index failure does not undo a successful text write. SQLite loss rebuilds from canonical files on the next use.

Reject malformed metadata, duplicate IDs, and unresolved merge markers for the affected records. Show the affected IDs and degraded coverage. Do not silently use an older indexed value. Conflicting active policies remain visible until resolved. An answer that needs a conflicted record reports the conflict.

A changed or missing artifact makes its observation stale or unavailable. Re-read the current file when permitted. Preserve historical purpose while withholding unsupported current-behavior claims. Unknown dependency coverage remains unknown. Cancellation reports completed artifact and memory operations independently, without implying rollback.

## First-change scope and verification

The first change includes durable project opening, record persistence, bounded retrieval, correction and SQL-purpose capture, source-linked answers, lifecycle control, external-change reconciliation, branch/worktree separation, and index recovery. It excludes adaptive workflow routing, automatic spec generation, semantic merge assistance, plugins, hooks, lossy compression, and external graph services.

Use the real local model and direct artifact inspection for these acceptance scenarios. These are proposed human checks, not newly authored tests or verifiers:

1. Correct an unsupported inference, restart, and ask a related question. The answer respects the correction and cites the original wording. A paraphrased query also exercises correction selection.
2. Request SQL for a business reason, inspect its actual operation receipt, restart, and ask why it exists. The answer links purpose and artifact without asserting uninspected SQL behavior.
3. Change the SQL externally. Piarre preserves purpose, marks old code evidence stale, and inspects current contents before describing behavior.
4. Ask about an unrelated project or an artifact with no rationale. Piarre does not reuse unrelated knowledge or invent a purpose.
5. Supersede a policy, stop using a record, and delete another. Restart and inspect both answers and local persisted state.
6. Switch branches, open a second worktree, introduce a text conflict, and remove SQLite. Confirm isolation, explicit conflict handling, and reconstruction.
7. Interrupt a capture or fail a write. Confirm that no success claim or completed-operation record exceeds what actually persisted.

Record retrieval correctness separately from answer correctness. Observe user interruptions, repeated corrections, latency, selected context size, and maintenance burden. Do not claim a quality or speed improvement from this design alone.

## Staged roadmap and triage

Milestone names below are proposals. Do not confuse GitHub milestone database number 4 with an existing M4.

| Proposed milestone | Parent outcome | Exit condition |
|---|---|---|
| M4 Remember and explain project work | Reliable knowledge across sessions | Both correction and SQL-purpose workflows accepted, including non-use and recovery |
| M5 Adapt the work to its consequences | Proportionate Direct/Light/Spec workflow | Useful routing with user override, pinned OpenSpec integration, unified `.piarre` organization without duplicate authority |
| M6 Resolve shared knowledge deliberately | Git collaboration assistance | Explicit ancestor/both-sides merge skill explains behavioral options, applies selected edits, never auto-commits |
| M7 Extend under local control | Skills, MCP, and optional hooks | Shared configuration plus local restrictions; pulled configuration enables nothing automatically; master and individual switches work |
| M8 Evaluate context compression | Measured model-specific context management | Compare full context, selection-only, and structured handoff on the actual model before adoption |

M4 has three parents and these proposed child tickets:

| Parent | Ticket and durable contract | Dependencies |
|---|---|---|
| Persistent project and text records | A. Establish explicit durable project mode and lifecycle. Persistence survives restart and disposal is explicit. | Actual PoC acceptance |
| Persistent project and text records | B. Define and persist records, provenance, lifecycle, and local Git status. No transcript archive or automatic publication. | A |
| Grounded conversational memory | C. Reconcile checkout/index and select bounded context. External changes, deletes, conflicts, and cache loss cannot expose obsolete indexed truth. | B |
| Grounded conversational memory | D. Retain scoped corrections and SQL operation purpose through the real conversation. Never invent a source or completed operation. | B, C, accepted file tools |
| User control and acceptance | E. Inspect, supersede, stop using, and delete knowledge conversationally. Policies and observations have distinct freshness semantics. | D |
| User control and acceptance | F. Complete the restart/non-use/recovery acceptance session and record remaining limitations. | C, D, E |

A separate bounded compatibility investigation can run before PKM implementation. Inspect installed OpenSpec CLI, skills, templates, stores, and path assumptions. Produce evidence for a pinned adapter, fork, or native integration choice. It blocks M5 integration, not the first memory workflow, and performs no relocation.

Draft all proposed issues as `enhancement` with `needs-triage`. Use `needs-info` for a specific unresolved product choice. Add `ready-for-agent` only after acceptance criteria, actual prerequisites, and relevant facts are settled. Use native parent and dependency relationships, and link each child to the approved OpenSpec contract and verification section. Keep later milestones at parent level until evidence warrants detailed tickets.

## Alternatives and remaining facts

Full chat retention would preserve excess sensitive text and make retrieval less selective. An authoritative SQLite database would weaken review and Git portability. FTS alone would miss relevant restrictions, so active scoped policies have a dedicated selection path. Automatic semantic merge or hooks would introduce authority and maintenance costs before the basic workflow is useful. Graphiti, GraphRAG, Neo4j, vectors, and a second required model do not earn a place in this slice.

Before implementation, settle the durable-volume project import/export experience and verify real model capture/tool reliability within accepted context limits. Establish how branch renames and detached checkout identities preserve local scope. Check OpenSpec relocation support directly before selecting its integration. The historical NVIDIA compaction result motivates later evaluation; it does not predict Piarre's outcome.
