# Design

## Context

See [proposal.md](proposal.md) for the problem and [roadmap.md](roadmap.md) for the agreed product direction. At inspected commit `090008e`, the Rust entry point builds requests from an in-memory `Vec<Message>`. It has no durable knowledge store or file-operation receipts. The active PoC intentionally discards `/workspace`; persistence is outside its scope. Implement against the accepted PoC revision after [#165](https://github.com/sysung/piarre/issues/165), not this snapshot or the archived TypeScript implementation.

This design is proposed, not shipped or human-accepted implementation. It satisfies the design-artifact condition because it changes data ownership, persistence, retrieval, and workspace boundaries. [Arena synthesis](arena-synthesis.md) records the comparison that informed it.

## Goals / Non-Goals

The first release delivers both cross-session workflows in one selected project: remember a scoped correction and explain an artifact's purpose. Foundation and conversational integration are parts of that release, not separate architecture-only products.

Include a specification-aware foundation and an explicit spec/change/ADR lifecycle in selected projects. Product-behavior and architectural changes default to SDD; bounded edits retain Direct mode. Exclude automatic workflow selection, bulk relocation of existing repositories, merge interviews, Git hooks, MCP, online access, graph services, broad dependency parsing, and lossy compression. Retain existing execution authority and avoid whole-transcript storage. Necessary local controls for enabling memory and withdrawing knowledge are included; a generic plugin configuration framework is not.

## Decisions

### D1. Use a selected persistent project profile

Add a post-PoC profile with one operator-selected Git checkout bound to the container workspace. The first qualification uses a harmless fixture project. The documented launch procedure selects that exact checkout once; the model receives no new shell, network, or arbitrary host-path access. Keep Git metadata read-only and deny model file tools access to internal Git and Piarre control state. Only typed host knowledge operations write managed knowledge. Preserve the disposable profile and its teardown semantics.

The first implementation ticket must demonstrate restart, stopping without deletion, and checkout identity before capture relies on persistence. Reject unsupported linked-worktree layouts with a clear reason rather than broadening access to discover metadata. A needed linked-worktree metadata mount must be explicitly scoped and read-only. This profile expands access to the selected checkout only and requires review before implementation. A separate persistent-volume copy was rejected because it would require a second import/export workflow around the user's ordinary Git checkout.

### D2. Keep canonical text and derived state separate

Proposed first-release layout:

```text
.piarre/
  specs/<capability>/spec.md        # adopted behavior contracts
  changes/<change-id>/              # proposal, design, tasks, delta specs
  changes/archive/                 # preserved completed changes
  decisions/<adr-id>.md             # durable architectural decision records
  knowledge/<id>.md                 # supporting statements and observations
  skills/                          # project skills, later execution integration
  local/                           # Git-ignored
    captures/<checkout-id>/<id>.md  # unpublished canonical records
    controls/                      # persistent local exclusions and deletion tombstones
    cache/<checkout-id>/index.db    # disposable derived index
    recovery/                      # minimal pending write receipts, bounded retention
```

This is the target logical layout, pending T0 qualification before T2 implements canonical storage. Preserve native OpenSpec artifact syntax where useful; do not assume its CLI supports these paths. Specs own adopted behavior, changes own proposals and delta specs, and ADRs own durable architectural rationale, alternatives, consequences, status, and supersession links. Change designs reference ADRs instead of maintaining another authoritative decision copy. Knowledge records supply original statements and evidence, not a second spec catalog. Do not create empty plugin trees or duplicate existing specs. The application must establish ignore rules for `local/` before capture and stop private capture if that boundary is not effective or the destination is already tracked. Report the issue without silently removing tracked files. A deliberate force-add is still the user's ordinary Git operation and is not intercepted.

The minimal explicit lifecycle is proposal/delta/ADR drafting, review, requested adoption of approved deltas into specs, and archival of the completed change. ADRs distinguish proposed, accepted, rejected, and superseded decisions with exact revision references. Local adoption does not imply team adoption until integration into the designated main baseline. Capture, successful checks, and archival alone cannot manufacture approval. Interrupted adoption retains the proposal and reports incomplete reconciliation rather than presenting a partly applied spec as settled. An instruction to adopt the reviewed revision needs no repeat confirmation.

SDD defaults apply to changes in product behavior; meaningful architectural decisions also receive ADRs. Typos and bounded edits without contract impact can remain Direct. An explicit permitted workflow override does not waive permissions or silently override accepted requirements. Automatic selection comes in K3.

One record owns each stable ID. Auto-capture writes only to `local/captures`. When the user asks to share a record, move it to `knowledge` with its identity intact and leave Git staging, commits, and pushes to the existing requested workflow. Moving is the publication-preparation action, not an extra approval ceremony. A user can also edit or move text manually. No Git operation automatically selects or promotes records.

For an interrupted move, identical IDs with identical content are one logical record. Divergent copies are a conflict, never last-writer-wins. SQLite can be deleted without deleting knowledge or local withdrawal decisions. This rejects both a canonical SQLite store and untracked auto-capture in the shareable directory, which routine bulk staging could publish accidentally.

### D3. Model provenance, lifecycle, and applicability independently

Use Markdown bodies with validated YAML frontmatter. The proposed schema has these concepts, with exact serialization finalized in the record-contract ticket:

| Concept | Meaning |
| --- | --- |
| `RecordId`, `ProjectId`, schema version | Stable portable identity and versioned parsing |
| `kind` | Intent, policy/correction, observation, or interpretation |
| `scope` | Project, component, artifact, or explicitly named task scope |
| `origin` | Direct user excerpt, actual runtime receipt, or imported source; source ID and exact supporting span |
| `lifecycle` | Active, superseded by a named ID, or withdrawn |
| `links` | Minimal typed relations: supports, corrects, supersedes, concerns-artifact; typed references to capabilities, requirements, ADRs, and changes |
| `revision` | Source content hash, known Git revision, and dirty state where applicable |
| `observed_result` | Completed, failed, partial, cancelled, or unknown; available only to observation records |

Derive applicability from scope and explicit lifecycle plus current source identities. Derive branch adoption from known Git content rather than trusting a hand-edited `accepted: true`. An inference remains an inference after merging. A human statement establishes that intent was stated, not that referenced code behaves as described. Imported claims of authorship or execution are attributed claims unless their sources can be checked; this design provides provenance, not cryptographic proof of human authorship.

Retain the smallest source excerpt sufficient to support a record, including qualifications and corrections. The excerpt has its own source identity and is sufficient for a fresh clone to inspect without a private transcript. A content hash identifies bytes, not truth. Several records derived from one claim remain one origin, not independent corroboration.

### D4. Capture at actual conversation and operation boundaries

Use a narrow `KnowledgeService` with capture, select, inspect, and lifecycle operations. It is an internal contract, not a second agent-facing workflow. Capture explicit user statements at the user-turn boundary and artifact observations at completed tool-result boundaries. The actual accepted PoC event contract determines adapter signatures.

The existing local model may propose a structured capture during the normal task turn. No required second model or extra classification call is introduced. Rust validates record types, source IDs, exact excerpt matches, bounded sizes, links, and lifecycle preconditions. Semantic interpretation remains fallible: matching an excerpt does not prove the model interpreted it correctly. Preserve verbatim user direction separately from inferred scope or meaning. Where ambiguity changes a consequential action, ask a focused question with a Recommendation. Do not require users to repeat clear corrections in a special command.

A model cannot label its own prose as a user statement or mint a completed operation receipt. Store the original request and successful artifact receipt as separate linked records. SQL purpose does not imply SQL execution, correctness, or forecast accuracy. If an operation succeeds but capture fails, report the operation as completed and memory as unsaved. Announce successful capture only after its canonical text is durable.

Use stable event IDs for idempotent capture. Before dispatching an artifact mutation, persist a minimal pending operation identity; after the actual result, persist its outcome before acknowledging captured memory. If a crash occurs between the file effect and the outcome receipt, inspect the current artifact but keep the original operation outcome unknown unless the available evidence establishes it. Matching bytes alone cannot prove which actor wrote them. A bounded pending receipt records only needed fields, not the whole conversation. Capture excludes secret-marked or excluded content; unsupported sensitive-source handling fails without claiming durable capture.

### D5. Make the current checkout the retrieval boundary

Each worktree has a separate local identity and index. Scope unpublished captures to their originating project, worktree, and branch context. Record the local base revision and verify continuity. A renamed branch, detached HEAD, or rewritten ancestry that cannot be reconciled leaves captures inspectable but inactive until explicitly reattached; never guess that a different branch shares the intent. A normal commit on the same branch does not discard its captures.

Read shared records from the current worktree, including explicitly labeled local edits. Use the configured default branch and a known local ref only when baseline classification is needed. At planning time that branch is `master`, not a hard-coded `main`. Do not fetch, change branches, or claim remote freshness. Absence of a known baseline yields unknown adoption, not an invented accepted status.

Before retrieval, inspect the selected checkout identity and canonical record contents. Use a bounded content fingerprint inventory so unchanged timestamps cannot hide edits. Apply added, changed, and deleted index entries transactionally. Index scope by component for monorepos, but do not claim uninspected scopes are current. Changed HEAD alone is not enough; dirty records and untracked captures matter.

Detect unmerged entries, merge markers, malformed versions, duplicate identities, and broken links. Quarantine affected records and report degraded coverage. Never silently serve an older cached version as current. On index failure, use a bounded direct source read if it can meet the same contract; otherwise report knowledge unavailable. Ordinary chat can continue but cannot claim remembered constraints were checked.

### D6. Select evidence before considering compression

Selection order:

1. Enforce project/worktree scope, local exclusions, and record lifecycle.
2. Select applicable explicit corrections and policies for the task's known subject.
3. Resolve exact IDs, artifact paths, and cited sources, including spec/requirement references, ADRs, and active or archived changes.
4. Rank text using SQLite FTS5 and traverse a bounded number of relevant typed links.
5. Inspect current source hashes when a claim depends on an observation's currentness.
6. Build a context package with source IDs, exact excerpts, status, and coverage limits.

Reserve separate budgets for applicable constraints, evidence, and working conversation. Do not silently drop a relevant correction to satisfy top-k ranking. If required material cannot fit, retrieve narrower complete passages, stage bounded follow-up reads, or state insufficient coverage. No universal token threshold is claimed; select limits against the actual model and accepted request controls. Model extraction that misses a correction is a behavior failure, even if the storage operation succeeded.

The index includes spec/requirement identities, ADR IDs, change IDs, and supporting records without copying their bodies into `knowledge/`. Retrieve request -> applicable spec -> ADR/change -> artifact -> evidence only where links exist. A Direct task can legitimately have no change or ADR. Missing links remain explicit; they do not justify fabricated requirements. Proposed deltas and ADRs never silently replace adopted baseline content, and archived changes remain historical sources.

Source content enters as data, not instructions. Model responses identify which statements are grounded and which are inferred. The host validates reference existence and status; semantic entailment remains an observed quality criterion, not something ID validation proves. Missing evidence leads to targeted retrieval before asking the user. Exact links are not evidence of complete dependency coverage.

### D7. Keep lifecycle decisions durable outside the cache

Corrections append a superseding record rather than silently overwriting the original claim. A policy stays effective until scope, expiry, revocation, or supersession changes. File changes can stale observations without invalidating the historical purpose.

Conversational withdrawal writes a local control record excluding the stable ID from active guidance. Keep these project-scoped controls across branch switches and cache rebuilding. A pulled or restored historical record cannot silently undo withdrawal. Deliberate restoration is a separate user instruction. A local exclusion does not remove the record from another clone.

Deletion removes selected current app-managed record bodies, excerpts, duplicate local copies, and related derived cache entries. Clear affected recovery receipts and rebuild/remove cache files and sidecars as needed. Retain a minimal non-content tombstone to prevent unwanted reactivation. Explain that filesystem snapshots, Git history, remote clones, and secure physical erasure are outside that operation. If deleting a tracked record is requested, make the working-tree change without committing it automatically. Atomic writes use expected-content checks and a local writer lock; concurrent manual changes cause a visible conflict instead of overwrite.

### D8. Investigate OpenSpec compatibility without duplicating authority

The installed CLI reports version 2.0.0. Official [store documentation](https://openspec.dev/docs/stores) describes repositories containing `openspec/` and machine registration; it does not establish a direct arbitrary-root rename. A nested `.piarre/openspec/` adapter may preserve syntax, but its working-directory, path-reference, generated-skill, validation, sync, and archive behavior must be checked before adoption.

Run the bounded compatibility investigation T0 in K1 after M3 UAT completion (#138) and explicit acceptance (#165). Its reviewed result blocks T2 canonical storage implementation. The target is direct `.piarre/specs/`, `.piarre/changes/`, and `.piarre/decisions/`; a nested `.piarre/openspec/` arrangement is only a comparison candidate, not an accepted substitute. If no pinned arrangement supports the target, report the gap and revise the integration design before T2 rather than silently deferring it to K3. Prefer a pinned supported arrangement when demonstrated. If a fork is required, record its changed path contract and upstream upgrade cost before choosing it. Pin CLI and skills/templates together. Do not copy editable specs into PKM or move this repository's active planning as a side effect of the investigation. The present proposal remains in the existing OpenSpec root under the explicit planning authorization.

## Risks / Trade-offs

- Semantic capture or retrieval can miss useful knowledge. Preserve exact text, report uncertainty, exercise paraphrased correction cases, and measure missed constraints separately from parser validity.
- Persistent storage changes the PoC boundary. Qualify the selected-checkout profile first and retain disposable defaults.
- Git ignores are not a security boundary. Default private captures to an ignored location, detect tracking conflicts, and never claim protection against deliberate force-add or external file access.
- Text edits can forge narrative metadata. Treat imports as attributed data and never derive execution permissions from it. Repository review supplies team adoption, not cryptographic event truth.
- Large monorepos make content inventories costly. Bound inspected scope, record coverage, incrementally update derived state, and defer performance claims until measured.
- Multiple local edits can race. Use expected-content checks and one writer per selected knowledge store; index transactions do not replace source-write protection.
- Learning a new index format can impede rollback. Keep canonical text versioned, stop on unsupported schemas, rebuild only compatible caches, and never restore withdrawn guidance through an older index.

## Migration Plan

1. Record actual PoC acceptance and re-inventory the delivered tool and request contracts.
2. Qualify the persistent fixture profile and record its exact selected-checkout and metadata mount boundaries before enabling capture.
3. Introduce schema-versioned text and ignored local state in new selected projects. Do not import legacy databases or entire transcripts.
4. Deliver correction capture and retrieval, then the SQL-purpose chain using actual tool results, followed by lifecycle/recovery acceptance.
5. Disable memory to stop capture and injection without deleting records. Roll back application code only against compatible canonical schemas; preserve local controls and stop rather than silently downgrade unsupported records.
6. Qualify the unified spec/change/ADR lifecycle in new selected projects during K1, with links, explicit adoption, interrupted-operation handling, and archive preservation. Leave this repository's current planning files in place. Later migration of existing projects updates skills, commands, links, agent guidance, and rollback instructions together. Current project guidance maps ADRs to change designs; that mapping must change with an approved migration, not implicitly during this planning edit.

## Verification plan

Acceptance scenarios are in the two capability specs. No new tests or standalone verifiers are authorized by these artifacts. Run existing build and relevant existing checks during implementation, and use direct manual sessions for behavior. Seek explicit authorization before adding automated checks for wrong-success outcomes.

| Evidence ID | Scenario | Observable success |
| --- | --- | --- |
| V1 | Persistent profile and restart | Selected knowledge survives; disposable profile still discards its workspace; no broader mount permission appears |
| V2 | Correction, restart, paraphrased question | Exact correction is retrieved and respected; unrelated task does not inherit it |
| V3 | SQL request, real write, restart | Original purpose and actual artifact identity are cited; no unobserved SQL execution claim |
| V4 | Change SQL and supersede policy | Old observation is historical; current policy uses explicit supersession, not age or latest timestamp |
| V5 | Delete cache, edit records, branch/worktree switch | Index reflects current selected sources; private captures do not cross contexts; unchanged mtimes do not hide changes |
| V6 | Conflicts, missing evidence, imported instruction | No stale fallback as truth, invented rationale, or expanded tool permission |
| V7 | Withdraw/delete, restart, restore old checkout | Active-use suppression persists; deletion claims match actual local scope and Git limitations |
| V8 | Cancellation, replay, write failure | Completed effects and unsaved memory are reported separately; no duplicate logical records or false saved claim |
| V9 | Ordinary Git and deliberate sharing | User Git commands cause no AI; shared text works in a fresh clone without another user's cache |
| V11 | Specification-aware lifecycle | Adopted specs, proposed deltas, ADR status/supersession, and archived history remain distinct; linked evidence is retrieved without requiring a complete chain for Direct edits |
| V10 | Baseline comparison and human acceptance | Same model/task conditions; retrieval vs answer correctness reported separately; failures and user decision recorded |

These are planned checks, all currently unexecuted. Paper results, Arena consensus, and OpenSpec validation are not runtime verification.

## Open Questions

Deferrable implementation choices include the exact supported SQLite binding/version, record-size limits, and retrieval budget values after observing the accepted local model. The existing architectural choice is SQLite-derived search; a failure to support it requires a design revision rather than an undocumented substitute.

OpenSpec root compatibility and persistent-profile qualification have bounded owning tickets and explicit stop conditions in the triage plan. T0 must settle the supported layout before T2 implements it. Neither is asserted to work. If investigation contradicts the target, revise the design before dependent implementation.
