# Post-PoC roadmap

## Status and acceptance boundary

This roadmap records the product direction agreed in the exploration. The milestone and tracker structure has been published at the user's request; [publication-map.md](publication-map.md) records actual GitHub URLs. Implementation details remain planned and implementation has not started.

On 2026-11-16, GitHub reported `master` as the default branch. Existing milestone titles were M0 Preparation and isolation, M1 Running a local model, M2 Creating the agent harness, and M3 User Acceptance Testing. GitHub milestone number 4 is M3. [#165](https://github.com/sysung/piarre/issues/165) remained open with no acceptance comment. Project 8 still placed that issue and its UAT predecessors in Backlog.

Use descriptive milestone titles below rather than allocating M4-M9 numbers before publication. The `K` and `P` identifiers are local planning references, not GitHub numbers. Publication of this plan can proceed now. The first task T0 and persistent-profile task T1 both wait for M3 UAT completion (#138) and explicit acceptance (#165). Product implementation also requires approval of this change and the persistent workspace review.

## Outcomes

1. Ordinary developer requests work conversationally without memory forms or mandatory skill invocation.
2. Piarre chooses Direct, Light plan, or Spec-driven work proportionately, honoring explicit preferences and independent execution permissions.
3. Useful business purpose, explicit corrections, decisions, and constraints survive across sessions.
4. Answers connect intent to relevant specifications, code, and observed results with source references.
5. Missing, changed, or contradictory information produces specific uncertainty rather than invented assurance.
6. Users control adoption, correction, withdrawal, deletion, publication, and capability access.
7. Improvements justify their user interruption, latency, model usage, memory, and maintenance costs.

## Proposed milestones and parent trackers

| ID | Proposed milestone | Parent tracker title | Depends on | Exit evidence |
| --- | --- | --- | --- | --- |
| K1 / P1 | Project knowledge foundation | Preserve inspectable project knowledge in a selected workspace | Accepted PoC and approved first change | Pinned spec/change/ADR layout and explicit lifecycle qualified; linked text records and local capture survive restart; derived index rebuilds; manual edits, checkout changes, conflicts, and deletion behave honestly |
| K2 / P2 | Useful memory across sessions | Remember corrections and explain artifact purpose | K1 and accepted artifact-operation receipts | Real local-model runs demonstrate both recall scenarios, source support, appropriate non-use, and user acceptance |
| K3 / P3 | Adaptive workflow and specifications | Choose proportionate workflow with one `.piarre/` knowledge home | K2 with its qualified specification foundation | Automatic selection defaults behavior/architecture work to SDD, keeps bounded edits Direct, honors permitted preferences, and uses the established artifact lifecycle |
| K4 / P4 | Collaboration assistance | Resolve conflicting project decisions through an interview | K3 | Explicitly invoked merge skill compares ancestor and both sides, recommends resulting behavior, and applies the user's selected resolution without repeat approval |
| K5 / P5 | Configurable capabilities | Control skills, hooks, MCP connections, and online access | K4 | Shared declarations plus restrictive local overrides; master hook switch and individual controls; opt-in conditional reconciliation assistance; disabled capabilities fail clearly |
| K6 / P6 | Context efficiency evaluation | Choose context reduction from measured local-model results | K2 baseline; scheduled after K5 by default | Matched selection-only and compression comparisons report correctness, resource use, failures, and an adopt/narrow/defer decision |

K1 and K2 are delivery stages of the first `project-knowledge-foundation` change, not separate independently useful architecture projects. Finish the complete memory workflow before expanding the system. K3-K6 get parent-level briefs now; their detailed designs and children are deferred. K6 has no technical dependency on integrations or merge assistance and can move earlier if measured context pressure warrants it. It never blocks the first useful memory release.

## Decisions that apply across stages

### Text sources and local indexes

Use Markdown records with structured metadata and typed links as the storage candidate. Keep PKM, AI workflow artifacts, and project skills under `.piarre/`, with skills under `.piarre/skills/`. SQLite is a rebuildable local index, not shared canonical state. Source code, tests, and ordinary human documentation stay in their normal locations.

Capture useful observations and exact minimal excerpts during active Piarre work. Preserve explicit user wording and label inferred interpretations. Full transcript retention is not a prerequisite. Original observation scope and content identity matter more than a scalar confidence score or source count.

### Specs and ADRs organize durable knowledge

Adopted behavior lives under `.piarre/specs/`; proposed changes and archived history live under `.piarre/changes/`; durable ADRs live under `.piarre/decisions/`. Change designs reference ADRs rather than duplicate their authoritative rationale. Supporting records remain under `knowledge/`. Capture never promotes an observation into a spec or accepted ADR.

SDD is the default for changes to product behavior or architecture, with ADRs for meaningful architectural decisions. Bounded edits retain Direct mode and permitted explicit workflow preferences remain effective. Permissions are independent. K1 includes the minimal explicit proposal/review/adoption/archive lifecycle and specification-aware storage; K2 demonstrates linked retrieval; K3 adds automatic workflow selection and broader existing-project integration. T0 now blocks T2 until the direct `.piarre/` layout is qualified.

### Git and adoption

Main is the accepted project baseline at the known revision, not a guarantee of factual correctness. Feature work can intentionally differ. Work from the current checkout without repeatedly fetching or checking out main. Update the local index when Piarre next needs it, with no model call, hook, or manual sync.

Automatic capture stays local until the user deliberately makes selected records shareable and publishes through Git. User-run commits, pushes, pulls, and direct pushes to main run without Piarre review or intervention. No automatic knowledge repair, publication gate, or unsolicited AI review is added. Reviewers inspect the ordinary diff. When asked to prepare a PR description, Piarre explains intentional behavior changes.

### Intent, evidence, and lifecycle

Explicit scoped corrections persist without a second approval prompt. An instruction that clearly changes a requirement resolves that intent. Piarre asks only about consequential uncertainty not already resolved and provides a Recommendation. Inferred directions can guide suggestions but remain provisional and never grant execution authority.

Human agreement establishes intent, not observed code behavior. Historical intent remains useful after code changes; historical tests do not establish current behavior indefinitely. Normative policies do not expire merely by aging. Unknown dependencies or unsupported parsing yield unknown coverage.

Knowledge management uses ordinary conversation. Withdrawal from current use, supersession, and deletion are separate outcomes. Local withdrawal persists across index rebuilding and old checkout restoration. Deleting a current record does not erase Git history or other clones.

### Later merge and extension behavior

The merge skill groups conflict markers by underlying decision and can recommend a combined solution instead of choosing a whole side. Selecting its concrete resolution authorizes those edits, not an automatic commit or push. Complex semantic conflict review remains explicit and later than basic text-conflict detection.

An optional future hook can detect a relevant pull or merge condition and start the interview. Routine successful pulls cause no AI calls. Git integration must cover actual failure and rebase paths; no particular hook is promised to catch every pull conflict. Integration choice belongs to K5. Pulled configuration declares capabilities but does not enable local model calls, network access, or MCP connections. Local restrictions win and never silently fall back to a different capability.

## First-release evidence

The first change must demonstrate both positive use and appropriate non-use:

- A correction about transient conversation history prevents the same unsupported inference in a fresh session and a differently worded task.
- A SQL artifact's purpose is recovered from the original request and actual write observation after restart. Modified SQL keeps its historical purpose without inheriting old verification.
- A changed refund policy uses the applicable 45-day version rather than the superseded 30-day version, without treating approval as proof of implementation.
- Unrelated-project content, withdrawn guidance, missing sources, and conflicts do not become confident answers.
- Cache deletion, manual record changes, branch switching, and an interrupted capture preserve honest state.
- Retrieval distinguishes adopted specs, proposed deltas, accepted or superseded ADRs, and archived history. Direct work can lack these links without Piarre inventing them. Explicit adoption updates only approved deltas and preserves history; interrupted adoption reports incomplete state.

Record retrieval correctness separately from model answer correctness. Compare the same model and tasks against ordinary project notes plus the existing agent. Record human corrections, interruptions, supplied context, and observed resource use with limitations. Passing a small demonstration does not prove broad fatigue reduction.

## Context efficiency research

Reuse [the Todoist discovery](https://app.todoist.com/app/task/6j2h5GwGv5Hpx4jp), [historical #79](https://github.com/sysung/piarre/issues/79), and [historical #94](https://github.com/sysung/piarre/issues/94) instead of creating duplicate research programs.

[NVIDIA's paper](https://arxiv.org/html/2611.05306v1) distinguishes selective reading from history compaction. Its open-model results vary sharply; its Qwen 3 Coder Next result is not a Piarre performance forecast. K6 compares full context where feasible, selective source retrieval, and retrieval with a structured handoff under matched model, task, and source conditions. If the full-context arm exceeds available memory, report that limitation rather than silently changing its model.

Consider learned extractive compression such as [LLMLingua-2](https://arxiv.org/abs/2403.12968) and extractive or abstractive retrieval compression such as [RECOMP](https://proceedings.iclr.cc/paper_files/paper/2024/hash/bda88ed2892f5e61c9a9bf215c566913-Abstract-Conference.html) only as later challengers. Count their model memory, extra calls, latency, lost constraints, and total token cost. Preserve original evidence. Runtime KV-cache changes are separate from retrieval quality and require their own compatibility evidence.

## Original handoff disposition

The original downloaded handoff was context, not authorization. The subsequent conversation controls this plan.

| Original draft | Disposition |
| --- | --- |
| PKM-01, PKM-02 | K3 adaptive workflow; no mandatory spec on every edit |
| PKM-03, PKM-04 | K1 minimal records, lifecycle, storage, and reconciliation |
| PKM-05 | Layout qualification and minimal spec/change/ADR lifecycle in K1; automatic workflow and broader migration in K3 |
| PKM-06, PKM-07, PKM-08 | K1-K2 scoped capture, provenance, and direct-source freshness |
| PKM-09 | Optional semantic extraction beyond the minimal first-turn proposal, deferred until incremental benefit is shown |
| PKM-10, PKM-12 | K1-K2 bounded exact/FTS retrieval and source-linked context |
| PKM-11 | Broad SQL/code dependency parsing deferred; first slice uses exact artifact references |
| PKM-13 | K2 SQL purpose scenario, without implying query execution or forecast validation |
| PKM-14 | Basic comparison in K2; advanced context experiments in K6 |
| PKM-15 | Necessary recovery/isolation checks in K1-K2; broader migrations and integration hardening stay with owning later stages |

Defer graph databases, vector stores, external knowledge services, global cross-repository synchronization, graph visualization, required secondary models, automatic ontology generation, and live sharing of uncommitted work. Do not create speculative integration tickets for Graphiti, GraphRAG, or Obsidian.

## Remaining technical investigations

These are implementation prerequisites with owners in `triage-plan.md`, not unresolved product preferences:

- Verify the accepted PoC tool receipts and launch isolation before adding selected-project persistence.
- Qualify direct `.piarre/specs/`, `.piarre/changes/`, and `.piarre/decisions/` paths with pinned tooling before T2 storage implementation. A nested path is not an approved substitute. Preserve this current planning root until a separately approved migration; revise the design if qualification fails.
- Determine bounded retrieval/output budgets and semantic capture reliability on the actual local model. No model quality is inferred from paper results or older implementations.
- Verify SQLite FTS5 packaging and linked-worktree metadata access in the intended runtime.

New tests or standalone verifiers still require explicit authorization. The current artifacts specify observable scenarios and existing-command/manual validation, not permission to create new verification infrastructure.
