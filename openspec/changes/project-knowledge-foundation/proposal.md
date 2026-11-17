# Proposal

## Why

Piarre must retain useful project intent and corrections across sessions without turning conversation history or model interpretations into accepted facts. The first post-PoC change should prove that a sourced correction prevents a repeated mistake and that a later session can explain why an artifact exists.

## What Changes

- Add project-scoped, human-readable knowledge records under `.piarre/`, with stable identity, exact source excerpts, typed relationships, and separate intent and evidence status.
- Organize adopted behavior in `.piarre/specs/`, proposed and archived work in `.piarre/changes/`, and durable ADRs in `.piarre/decisions/`. Supporting knowledge references these artifacts instead of duplicating them.
- Default product-behavior and architectural changes to SDD, with ADRs for meaningful architectural decisions. Keep Direct mode for bounded edits, explicit workflow preferences, and independent permissions.
- Qualify OpenSpec paths before canonical storage implementation; include a minimal explicit spec/ADR lifecycle and specification-aware retrieval in the foundation.
- Capture useful explicit statements and observed artifact operations during active Piarre tasks. Keep semantic interpretations provisional and full conversation retention off by default.
- Retrieve bounded relevant evidence automatically during ordinary conversation. Preserve access to original records and report missing, conflicting, or stale support.
- Keep unpublished capture local and a SQLite search index rebuildable. Share selected text records through ordinary Git operations without synchronizing databases or intercepting commits and pushes.
- Reconcile the current checkout before retrieval without model calls, Git hooks, automatic network access, or a manual sync command.
- Support scoped corrections, supersession, withdrawal, and honest deletion semantics through conversation.
- Establish a limited persistent workspace profile after PoC acceptance. Preserve the existing disposable PoC profile and do not grant broader filesystem or execution access through memory.
- Record the complete staged direction in `roadmap.md` and draft milestones, parent trackers, dependencies, and first-change briefs in `triage-plan.md`.

This is a planning change. It does not implement persistence, move current OpenSpec files, update installed skills, publish issues, or authorize new tests. The proposed product layout places PKM, workflow artifacts, and project skills inside `.piarre/`; compatibility and migration are explicit future work.

## Capabilities

### New Capabilities

- `project-knowledge`: spec/change/ADR ownership and adoption, scoped durable statements, source-linked observations, local capture, Git sharing boundaries, and conversational lifecycle management.
- `knowledge-retrieval`: linked spec/ADR/change/evidence retrieval, current-checkout reconciliation, bounded source selection, status-aware context, and grounded cross-session answers.

### Modified Capabilities

None. The main capability catalog is empty at planning time. The active `local-model-chat-poc` contracts remain separate and unchanged. Recheck the catalog before implementation if the PoC has since been synchronized.

## Impact

The Rust conversation loop will need a bounded knowledge service at request and completed-operation boundaries. The post-PoC workspace profile will need narrowly scoped durable storage, a text-record parser, and a local SQLite index. Exact dependency versions and event-hook APIs must be selected against the accepted PoC code, not assumed from archived TypeScript work.

Implementation begins only after explicit PoC acceptance is recorded in [#165](https://github.com/sysung/piarre/issues/165), the planning change is approved, and persistent workspace boundaries are reviewed. GitHub currently names that acceptance milestone M3; its database number is 4. This proposal does not invent a completed M4.

Later changes own automatic adaptive Direct/Light/Spec routing, broader integration and migration of existing repositories, merge interviews, opt-in hooks and integrations, and lossy context compression. The first change establishes the unified layout and minimal explicit lifecycle in selected projects. Existing permission checks remain authoritative throughout.
