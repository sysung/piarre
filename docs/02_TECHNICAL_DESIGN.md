# Piarre technical design

Status: Target architecture. This document defines lasting contracts; GitHub issues record implementation progress.

## Ownership and data

The VS Code extension presents agent activity, work ownership, direct controls, and contextual project inspection. Typed discussion is a supporting surface. An editor-neutral core owns the project model. Adapters connect storage, workspaces, supported agent providers, coding workers, and optional typed interpretation. Voice adapters are deferred.

The ProjectController validates proposals and owns authorization, task transitions, dependency readiness, scheduling, budgets, reconciliation, and evidence freshness. Only the runtime appends domain events. Workers report observations or propose actions.

SQLite events are authoritative for tasks, runs, approvals, and execution evidence. Snapshots are rebuildable projections. Persist events before acknowledging durable changes. Commands carry an identifier and expected project revision. Replay and retries must not duplicate external effects.

The domain includes Project, Goal, Requirement, Plan, Task, Worker, Run, Approval, Budget, Decision, Evidence, Workflow, and Session. Knowledge, Recommendation records, linked threads, council assignments, reflection proposals, checkpoints, provisional drafts, and test bundles extend this model. Define small typed contracts before separate UI and persistence paths diverge.

Human-readable knowledge and decision files are possible, but their authority, import, revision, and conflict rules must be explicit. Do not create competing authoritative copies. Missing or invalid files must remain distinguishable from empty knowledge.

The reviewed-intent prototype uses editable `docs/project-intent/<id>.md` proposals and exact-byte native review. An adoption event atomically records the accepted Markdown, source digest, prior knowledge revision and review command with the corresponding knowledge version. A hash-identified Markdown snapshot under `.piarre/accepted` is checked before portable handoff generation. Saving, committing, metadata labels and editing a handoff cannot grant adoption or execution authority. Working changes remain pending; missing accepted snapshots are unavailable, not silently replaced. Original authorship and source claims remain separate from human adoption.

The portable handoff is a derived snapshot at a project revision, with accepted versions, pending proposals, disputes, explicitly linked stale work and gaps. It is not live state or independent verification. Legacy record export preserves identity and history without overwriting files; adopting new provenance can require review of plans bound to older knowledge revisions. Pilot instructions and the unmeasured human-value gate are in [the intent trial](../test/intent-pilot/README.md).

## UI and interaction

The agent overview, work controls, supporting discussion, and inspection reference the same durable objects. Proposed, applied, running, unknown, failed, stale, and accepted states must be distinguishable without reading logs. Deferred tasks remain discoverable. Priority and agenda disposition are separate from execution state.

Use the selected [Session brief layout](https://www.figma.com/design/I7CeHDqFJEvoEdmslfKrNp?node-id=7-2): one compact project brief above an agent/work overview and contextual inspector. Agent visibility now takes precedence over the historical conversation-first arrangement. Derive displayed summaries from canonical project records, not a second UI store. Refresh inspection and brief without replacing the composer or capturing unsent input. Use VS Code theme tokens and stack the regions in narrow panes. A planning-only shell is not evidence of live agent visibility or sourced resumption.

Preserve keyboard access, visible transcripts, screen-reader state, and non-color status cues. Detailed artifacts open on demand without repeatedly changing focus. Active-run and deterministic stop controls belong outside replaceable inspector destinations so inspecting Recommendation or memory cannot hide them. Distinguish pre-run acceptance criteria from consent controls, and carry the approved criterion identities into current result evidence. Knowledge correction revisions and review acknowledgments must bind the actual record/result rather than a page-global flag. Prototype remaining state and question formats before enabling their actions.

Keep task entry, inspection, and deterministic stop controls responsive while agents work. Emit concise progress from observed state changes and deduplicate unchanged status. Explanation depth is a visible, correctable preference.

The translation layer builds human explanations from bounded, structured records of claims, goals, constraints, sources, uncertainty, and action state. Worker context and human explanations reference the same record identities and revisions. Translation may explain terminology and implications but cannot modify authoritative state or promote an inference into evidence. Display approval and execution state from runtime records rather than generated prose.

Preserve original user statements with proposed interpretations and relevant term definitions. Corrections enter the existing knowledge or plan proposal boundary. Material ambiguity remains unresolved until clarified. Test preservation of conditions, negation, quantities, uncertainty, and authority across both directions of translation. This is an interface contract, not a requirement for an additional model call on every turn.

An agent activity projection derives identity, role, parent assignment, task and scope, provider/session identity, last observation, progress/blocker, pending decisions, output references, and supported controls from durable assignments, runs, and adapter observations. It is a rebuildable view, not a second scheduler or source of authority. Keep worker/session connectivity distinct from task completion, evidence freshness, and human acceptance. Unknown or stale observations remain explicit, with their observation time and coverage boundary.

Voice input, speech output, turn-taking detection, and speech-specific performance work are deferred. Do not add microphone or speech controls to the current agent overview. Existing typed discussion remains optional and uses the same untrusted-proposal boundary.

## Memory and recommendations

Knowledge records need identity, content, sources, confirmation state, revisions, supersession, and affected-work links. Observed, inferred, confirmed, disputed, invalid, and stale states must not collapse into a single remembered fact.

Decision records distinguish human directives/adopted decisions, AI working decisions within delegated scope, and inferred claims. Preserve author identity separately from acceptance identity, timestamp, exact revision, and scope. Bind adoption to the reviewed proposal; broad task approval cannot imply acceptance of every premise. Reaffirmed human intent remains authoritative within applicable permissions, while implementation and runtime claims need observed evidence.

Represent evidence assessment separately from authority, initially as supported, tentative, or unresolved with reasons, source revisions, assumptions, and counterevidence. An agent-reported assessment is not a calibrated probability. Preserve dependency provenance so summaries of one source cannot manufacture independent support. When premises change, mark dependent assessments for reconsideration and invalidate affected work through existing revision rules. Graph links cannot establish complete impact coverage or automatic supersession. Retrieval must preserve these distinctions when assembling context.

Retrieve a bounded set of relevant records for each request. Distinguish retrieval failure from no matching record. Recommendation links exact supporting sources and revisions and exposes unconfirmed premises. Test whether sources support the answer, not merely whether links render.

Approved corrections invalidate affected plans and evidence while preserving unrelated work. Contradictory confirmed sources need a visible resolution proposal. Reflection and repeated interactions cannot silently grant authority or confirm requirements.

Retrieval indexes are rebuildable projections of authoritative records and versioned workspace sources. Candidate methods include exact identifiers and full-text search, semantic matching, compiler-derived symbol references, and bounded traversal of sourced relationships. Keep file and symbol identity, source locations, workspace revision or content hash, index coverage, and extraction method. Track uncommitted edits and reject or label stale results. Recheck relevant sources before consequential proposals or verification claims.

A knowledge graph may connect requirements, decisions, symbols, modules, infrastructure declarations, tests, and evidence. Every relationship needs provenance and a distinction between extracted observations, model inferences, and confirmed assertions. Static references do not prove runtime behavior or complete dependency coverage. A graph cannot grant approval, establish that a test ran, or infer the rationale for a decision from code alone. Expose unknown and conflicting relationships.

Keep the retrieval interface independent of a dedicated graph database. Evaluate relationships stored in the existing SQLite system before introducing another service. Add semantic indexes, reranking, or a graph engine when representative evaluations justify their quality, freshness, latency, and maintenance cost. Filter retrieved context by project, source revision, and access policy. Derived summaries must retain source links and never replace original evidence.

### Local retrieval evaluation and next prototype

The bounded [retrieval fixture](../test/acceptance/retrieval-fixture.json) and [standalone evaluator](../scripts/evaluate-project-retrieval.mjs) compare exact identifiers, SQLite FTS5, sourced reverse module relationships, and compiler symbol lookup against pinned repository sources. Run `node scripts/evaluate-project-retrieval.mjs /tmp/retrieval-results.json` after `npm ci`. Results retain the corpus revision, harness revision, source and excerpt hashes, project identity, locations, extraction methods, confirmation state, coverage gaps, and repeated timing samples. The fixture includes unsupported questions, paraphrased rationale, direct dependencies, changed and conflicting decisions, infrastructure declarations, and freshness overlays. It is a small authored experiment, not production accuracy evidence.

Use exact identifiers plus FTS5 as the next local retrieval baseline. Add bounded sourced relationship traversal for impact questions when direct search misses dependencies. Keep compiler-derived definitions and references as a specialist for supported code languages. Store relationships as replaceable SQLite projections before considering a dedicated graph service. Static relationships cannot establish runtime dependencies, deployed state, confirmed business rationale, or successful verification. The evaluator retains a paraphrase miss and a computed-dispatch dependency miss instead of treating a connected graph as proof of completeness.

The proposed retrieval boundary accepts project identity, access policy, a query with a result limit, and the relevant source revisions or live content hashes. Results distinguish evidence from no match, retrieval failure, stale sources, conflicting sources, and incomplete coverage. Evidence retains original text and source identity, location, revision or content hash, extraction method, and observation or confirmation state. Filter by project and access policy before returning evidence. Recheck relevant live sources before a consequential proposal or verification claim. Reject old source hashes after edits, renames, or deletion. Quarantine unresolved conflicts and rebuild derived indexes without replacing authoritative records. This describes the later runtime contract; the standalone evaluator does not implement access control or an editor watcher.

Defer embeddings, contextual chunks, and reranking until an approved model is configured and representative paraphrase failures justify them. Defer a graph engine until measured traversal or maintenance requirements exceed the SQLite approach. The local micro timings exclude application startup, source loading, model work, and user-facing latency, and do not choose a performance winner. Semantic contradiction detection, dynamic dependency coverage, live invalidation, project isolation, and a held-out corpus remain necessary before broader product claims.

## Execution and approval

Task state differs from run state. A finished run can leave a task needing verification or review. Preserve Proposed, Ready, Running, Blocked, Needs approval, Needs verification, Needs review, Accepted, and Cancelled states with explicit transitions.

Approvals bind concrete scope, relevant plan and workspace revisions, duration, and spending or disclosure authority. Material changes invalidate affected approvals. Repository content, transcripts, tool output, and worker messages cannot change policy.

Worker adapters expose observed capabilities for start, status, steering, interruption, and inspection. Parse wire data at adapter boundaries. One writer owns the workspace. Parallel writers require separate write roots and reviewed integration.

Separate observed usage, provider estimates, and application estimates. Reject spending without applicable authority. Stop new scheduling at enforceable limits while preserving honest active-run state. Never promise a hard cap unsupported by the provider.

Billing context distinguishes API rates from subscription allowances. A requested plan is not proof of the authenticated billing route. Metered estimates use configured input/output rates and disclose the unknown token mix, retry assumptions, and excluded costs. Subscription projections need usage samples bound to the originating provider, plan, and model, or a provider estimate for each supported window. Old samples without that context remain unbound and yield unknown estimates. Open Work views refresh when provider settings change without taking focus or reopening a closed panel. Current usage percentages are observations, not task forecasts or a token-to-quota conversion. Missing calibration remains unknown. No estimator may authorize spending or assume that extra usage is free.

## Preparation, threads, and council

Provisional preparation belongs to a project, thread, input revision, context revision, cancellation state, and resource allowance. It accepts submitted input or explicitly enabled streams. It cannot confirm knowledge, apply plans, start writers, or cause unapproved spending or disclosure.

Changed intent cancels or supersedes old preparation. Late results are rejected. Adopting a draft requires validation against final intent. Cancellation cannot undo prior external effects, so prevent those effects rather than promise rollback.

Linked threads preserve parent relationships, scoped context, and return points. Findings merge through explicit proposals. Conversation concurrency does not grant write concurrency.

Council assignments need bounded purpose, context, permissions, provider, resource limits, and available controls. Synthesis retains disagreements and source quality. Agent failure or cancellation must remain visible. Explanations and available traces must not be presented as hidden model reasoning.

## Recovery and checkpoints

A stop request remains pending until worker and disk state are inspected. Stop all also prevents new scheduling. Cancellation preserves partial changes and does not imply rollback.

After restart or provider failure, mark uncertain activity unknown and reconcile before replacement execution. Lost acknowledgments must not repeat external actions. Detect manual edits and block conflicting acceptance instead of overwriting them.

Checkpoints record included scope, revision, and exclusions. Restore previews differences, reconciles active writers, checks newer edits and untracked files, and obtains approval before destructive replacement. Preserve current work recoverably before a supported restore.

A restore is a new auditable operation. It invalidates affected evidence and reconciles task/run state. Repository restoration does not automatically rewrite confirmed memory, revive approvals, reverse external services, or refund charges. Test partial failure and restart during restoration.

## Providers, resources, and privacy

Keep agent connections, retrieval, and coding workers independently configurable. Supporting typed interpretation must not be required for direct controls. Voice services are deferred. Escalation to a stronger model obeys cost and data-sharing policy. Unsupported integrations stay unavailable.

Measure agent connection, active-work state freshness, control latency, retrieval, and runtime overhead separately. Model footprint matters when a model is actually hosted; voice-model resource targets are deferred. Evaluate quality before reducing model size. Record hardware, models, context size, versions, failures, and sample counts. Research results do not substitute for product measurements.

No microphone capture is required in this release. Optional screen capture requires opt-in. Keep capture, storage, export, and remote analysis separate. Redact secrets from logs and artifacts. Verify local deletion and explain that provider retention is separate.

Test bundles link timestamps, transcripts, user actions, model and prompt versions, tool activity, approvals, memory/task revisions, repository changes, checks, and optional recordings. They belong with the tested run, not in permanent design documentation.

Stable and development builds need distinct identity, storage, and execution roots. Candidate failure must not corrupt daily state. Versioned packages and CI evidence support explicit promotion and rollback.

## Verification requirements

Use domain tests for policy, revisions, replay, and idempotency; adapter contracts for actual provider behavior; and Extension Host journeys for visible state, persistence, and disk results. Mocks do not prove live agent or worker semantics.

Required failure coverage includes ambiguous targets, denied authority, changed requirements, stale completion, manual edits, build failure, provider disconnect, lost acknowledgment, stop, restart, export/redaction/deletion, contradictory memory, late preparation, thread conflicts, council failure, and checkpoint restoration.

Evidence binds to the relevant plan and workspace revision. Relevant changes make it stale. A completion claim cannot accept its own result. Report scenarios as passed, failed, blocked, unsupported, or not tested.

Measure agent-state freshness, visibility of pending decisions, and control responsiveness during active work, not only acknowledgment speed. Compare task outcomes and review accuracy alongside reading and interruption burden. One session does not establish a performance or fatigue-reduction claim.

Internal changes require appropriate automated checks. Reproduce practical regression defects before fixing them. A release needs current end-to-end evidence and consolidated human review. Detailed test procedures, run results, and release-specific gates belong in issues and artifacts.
