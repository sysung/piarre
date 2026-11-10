# Design

## Context

See `proposal.md` for motivation. Current authorization is plan publication only. A later reviewed first slice is architecture/protocol audit only until #100/#91 pilot evidence and an explicit sequencing decision exist.

The plan base is `origin/master` at `0b36edc6c2ead6b7094518d9d98747cd79c98b6e`. Core domain source and `test/editor-boundary.test.mjs` exist there. That test checks the ESLint rejection of static and dynamic `vscode` and app imports; it is not evidence of a reusable runtime service layer. There is no `packages/runtime`.

| Source | Existing paths at pinned revision | Audit question |
| --- | --- | --- |
| Base `0b36edc6c2ead6b7094518d9d98747cd79c98b6e` | `packages/core/src/{context,knowledge,resumption,execution,recovery,contracts}.ts` | Which domain operations remain independent of editor/native hosts? |
| Same base | `apps/vscode/src/{sqlite-project-repository,project-retrieval,conversation-controller,execution-coordinator}.ts` | Which storage, retrieval, orchestration and recovery dependencies remain app-hosted? SQLite event/receipt authority must remain one transactional boundary. |
| PR #101 `25c8fa5e6fca8c14082df3f808e1ee4070244d27` | `packages/core/src/intent-document.ts`, `apps/vscode/src/intent-documents.ts`, `intent-commands.ts`, `test/intent-pilot/{README,BASELINE}.md` | Can existing `IntentDocuments.handoff/exportHandoff` plus a small helper satisfy the need? Exact accepted snapshots and pending proposals already have separate treatment. |
| PR #89 `42fa20f42d6274dfddef43bc4a965c798cd90186` | `apps/vscode/src/docker-model-runner-conversation-client.ts` and local discussion tests | Provider connection is restricted and unconfirmed cancellation must be retained. It is not an approved CLI backend. |
| PR #95 `d12cc75fdcca5532e180c8371b1b766df1155b08` | `scripts/iteration-benchmark.mjs`, `test/iteration-benchmark/README.md` | Reuse #94 reproducibility and #102 accounting if a future trial is separately authorized. |

All PR-only behavior above is open/unmerged in supplied inventory. The plan imports no implementation branches. Existing PR #101 pilot has a 120-minute human budget and schedules three genuine resumptions and requires preference in at least two for continuation; no human verdict is supplied. Plan review cannot silently override its pause.

## Goals / Non-Goals

Map the exact minimum host dependencies for one handoff journey and specify a fair comparison. Do not extract hosts, add runtime packages, invoke an agent, install models, build a conversational CLI, retire VS Code, or expand orchestration before the explicit post-pilot gate.

## Decisions

### Audit the existing handoff before designing a CLI

Use Candidate B's source-map audit and demonstrated-gap rule, grafting Candidate A's existing-export/helper outcome. Proposed future audit artifacts, absent today, are `test/intent-pilot/cli-feasibility/BOUNDARY.md` and `PROTOCOL.md`. The map records symbol/path/revision, required state, host/editor/native dependencies, current authority owner, minimum interface hypothesis, and unresolved blocker. Inspect source references, not labels such as extension packaging or candidate commands.

Trace accepted intent from core parsing/knowledge/resumption through PR #101's app-hosted `IntentDocuments`, repository, filesystem and command dialogs. Follow retrieval and provenance separately from provider, execution coordination and recovery. Inspect any VS Code imports and native file/process services at the proposed seam. Extract nothing during the audit. A boundary-test edit requires a demonstrated uncovered dependency escape and another explicit implementation authorization.

### Define one small matched journey

The proposed journey opens a repository/task, inspects small traceable evidence and accepted/pending intent, records conflicts/missing evidence and consequential questions, exports a reviewable handoff, then resumes after a changed requirement. Keep the first candidate manual. The control is versioned Markdown plus the same existing coding agent; a second direct-agent control receives identical handoff bytes so improved prompting is not attributed to CLI packaging. Match source snapshots, accepted facts, model/agent settings and budgets, counterbalance equivalent tasks, and include a later correction/resumption.

The audit records later requirements for supported private-runtime detection, one tested default and honest device/download failures via #88/#105; no installer is built. Clarification follows #96, including grounded options, useful recommendations, optional skip and visible editable provisional assumptions. Skip cannot waive authorization. Agent invocation, if ever useful, is a separately bounded choice. Handoff export grants no coding authority.

### Keep two distinct gates

Gate 1 is human plan/test-boundary agreement and a later request for audit work. Gate 2 requires recorded #100/#91 pilot evidence and an explicit human decision choosing bounded CLI, smaller skill/helper, retain current approach, or defer. Neither plan approval nor a plausible architecture satisfies Gate 2. If the pilot favors ordinary Markdown or only an export/helper, stop at that narrower outcome. A selected CLI then needs a separately bounded implementation plan, TDD, and verified launch/stop/reset before human participation.

### Preserve authority and honest evidence

A possible future read-only host must preserve exact accepted snapshot bytes, pending/accepted distinction, project/revision/source identity, conflicts, unknowns and recorded verification. Missing/changed snapshots fail visibly; a new working file never substitutes for acceptance. Unknown cancellation stays unknown until reconciliation. Do not create a second authoritative store, silent provider calls, execution events, or automatic reapproval. Dirty branches, wrong projects, interruption/restart, unsupported runtime and unavailable prerequisites require explicit outcomes.

Human measures remain active effort, repeated explanation, reading/review load, interruptions, corrections, fatigue, and voluntary reuse. Operational measures include setup time/blockers, commands learned, first useful result, end-to-end latency, citation/diff/approval inspection and recovery. Independently adjudicate correctness, supported claims, missed constraints, review errors and authority/isolation failures. #102 supplies full local/expert preparation, input/output/reasoning usage, failed attempts, retries, provider charges versus estimates/subscription, and cost per accepted task. Token reduction alone is insufficient.

## Risks / Trade-offs

- A reusable core can hide app-hosted authority dependencies. Map every selected host path before proposing interfaces.
- CLI effort can preempt the pilot. Keep the sequencing decision explicit and preserve defer/retain/helper outcomes.
- Terminal citations or diffs may increase review errors. Require native terminal inspection and matched human evidence later.
- Existing host tests may download VS Code. Use installed-dependency source checks only until a no-download host route is verified separately.

## Migration Plan

No migration or packaging work occurs now. A future chosen slice uses disposable project/profile state while preserving the manual baseline. No existing VS Code support, SQLite history or user runtime is removed. Integration with PR #101/#89 requires an explicit reviewed source decision, not a plan-branch merge.

## Review requested

Review the audit map scope and one manual journey. Preserve the later pilot/sequencing gate. Before any executable prototype, agree exact host extraction, task counts, practical benefit/correctness thresholds, human time budget, model/resource/spend controls and independent verification. Before human testing, verify actual launch/stop/reset and native inspection on an available isolated host. These later gates remain pending and cannot be inferred from plan approval.
