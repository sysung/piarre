# C first integrated release plan

Status: First implementation plan, 2026-11-01. No C implementation or passing release is claimed.

The [immediate implementation and verification plan](07_C01_IMPLEMENTATION_VERIFICATION.md) expands the baseline work package into concrete execution steps and evidence requirements.

## 1. Delivery contract

C replaces the B-series as the proposed forward delivery plan. It builds one coherent Piarre candidate for a concentrated user-testing round. Internal issues, commits, reviews, and automated tests remain incremental. The user is not asked to launch and inspect every internal work package.

The product contract is [the consolidated design](05_CONSOLIDATED_PRODUCT_DESIGN.md). The historical baseline is [the live B snapshot](history/b-series-baseline-2026-11-01.md). The tracked summary preserves actual B issue states and Project 8 status. Local work artifacts preserve the full issue bodies, project fields, and recent pull requests. Existing B issues are retained as historical records, with explicit retirement links where superseded. Open execution review is preserved and is not counted as an implemented C feature.

One C release epic groups the implementation work packages. Each package has acceptance checks and evidence. Maintain a runnable integrated development build as each package lands. One final gate decides whether the integrated candidate is ready for the user's concentrated feedback session. This is one planned initial testing round, not a promise that feedback can never require retesting.

## 2. First candidate scope

The first candidate is a typed conversational project partner in VS Code. It offers a main conversation area and project inspection views, durable memory and Basis, task triage, one supervised coding writer, linked idea threads, bounded read-only council work, optional reflection, and a consolidated review package.

It includes proactive progress updates at meaningful milestones even when the user is silent. It supports provisional read-only preparation and drafts against explicitly submitted input. Preparation never substitutes for authorization.

The first candidate includes test logs and a test-bundle manifest with links to optional recordings. Native audio capture, screen capture, video interpretation, and a polished local voice stack are subsequent experiments unless separately added to scope. Existing recording tools can supply optional test artifacts.

Voice remains an important product goal. This candidate does not claim to validate speech turn-taking. The architecture preserves separate voice input and speech output controls, with the same command boundary as typing.

Local-model evaluation starts during C, but the 6–8 GB goal is not a release claim. A configured hosted conversational provider can establish a quality baseline when explicitly authorized. No provider is silently selected, no account integration is assumed permitted, and no background paid call runs without applicable approval.

Multiple writers, a standalone IDE, automatic self-modification, shared cloud projects, and autonomous deployments are outside this candidate. Bounded read-only concurrency and linked conversations are included. User-facing product changes still require approval.

These are explicit proposed scope boundaries. If a boundary conflicts with the product owner's intended first review, record the change in the epic before implementation expands.

## 3. Implementation baseline and retained lessons

Live GitHub shows bootstrap, durable projects, and reviewable proposals as completed. The bounded-execution pull request was subsequently closed as superseded, with its source branch retained for reuse assessment. This planning checkout initially predated reviewable proposals. It has now been rebased onto the current default branch, which includes them. Assess the preserved execution branch before adapting it. Closed unmerged work must not be treated as part of the current baseline.

Retain event-first persistence, optimistic revisions, runtime-owned state, idempotent commands, capability detection, stale evidence rejection, manual-edit protection, and one-writer ownership. Retain failure scenarios and tests from B, not its mandatory story-by-story human walkthroughs.

The B snapshot is historical. C issue status is the current forward execution queue after publication. Historical B work remains linked and discoverable. Any closure or migration of B issues must explicitly identify the C replacement and preserve its PR context.

## 4. Work packages

### C00. Deliver the first integrated Piarre candidate

The release epic tracks C01–C08 and the complete demonstration. Its completion requires all mandatory evidence and one reviewable candidate. It does not ask the user to verify each child issue.

### C01. Establish contracts, traceability, and a current baseline

Design coverage: consolidated sections 2, 3, 6, 10, 11, 14, and 15.

Dependencies: none.

- Reconcile the live default branch and preserved, unmerged bounded-execution branch.
- Define canonical objects for knowledge, Basis, threads, council findings, reflection proposals, provisional drafts, and test bundles.
- Define explicit proposal, approval, execution, verification, and acceptance boundaries.
- Specify the observation-versus-confirmed-memory approval rule as a visible policy, without silently resolving the remaining preference question.
- Provide per-operation spending approval by default until a different bounded approval policy is explicitly agreed.
- Define model/provider configuration and data-sharing policy. Use a real configured provider for live evidence and label mock evidence separately.
- Inventory the adopted pstack and Poteto principles with source versions, observable requirements, and conflict rules. Apply KISS to scope, UI, and code rather than enabling every skill or agent for every task.
- Create a requirement-to-package-to-scenario matrix and a single integrated acceptance script.
- Resolve canonical knowledge storage, candidate promotion and rollback policy, and the distinction between a prepared draft and an applied record before dependent behavior ships.

Evidence: current baseline record, contract review, executable revision and authorization checks, traceability matrix, and identified unsupported provider capabilities.

### C02. Build the conversational workspace and responsive controls

Design coverage: consolidated sections 3, 4.1–4.6, 4.9, and 4.10.

Dependencies: C01.

- Provide typed conversation, direct deterministic controls, and inspectable tasks, plans, artifacts, Activity, and pending decisions.
- Distinguish discussing, proposing, and applying an action.
- Keep conversation and stop controls responsive while a worker runs.
- Show concise milestone completion, material blockers, and next activity without repeated routine status.
- Implement revision-bound provisional drafts and safe read-only preparation from submitted or explicitly streamed input. Discard late results after direction changes.
- Keep unsent input private by default. Do not let speculative work mutate canonical records or spend outside authorization.
- Compare a small number of layout and question-format prototypes before choosing the initial interaction.

Evidence: real Extension Development Host observations, input revision and late-result scenarios, nonblocking controls, progress accuracy, and selected prototype rationale.

### C03. Implement inspectable memory, Basis, and project resumption

Design coverage: consolidated sections 6.

Dependencies: C01, C02.

- Record sourced observations separately from confirmed knowledge, with provenance, revisions, and inspectable approval state.
- Detect and show relevant contradictions. Require approval to replace confirmed knowledge.
- Implement correction, supersession, affected-work invalidation, and stale or absent memory states.
- Show supporting sources, assumptions, alternatives, and proposed versus applied actions in Basis.
- Resume with brief accomplishments, upcoming work, unresolved decisions, and relevant changes since the prior session.
- Keep exact lookup and semantic retrieval measurable. Do not equate a B-tree with semantic understanding.

Evidence: correct recall, unsupported-answer behavior, contradictory and stale sources, human correction, restart, and current source links. Check that displayed Basis records actually support the recommendation, rather than merely checking that links render.

### C04. Implement bounded execution and consolidated outcome review

Design coverage: consolidated sections 5, 10.5, and 11.

Dependencies: C01, C02, C03.

- Integrate verified B execution work where applicable, using one writer and observed capabilities.
- Approve concrete scope and spending before execution. Explain damage and failure consequences, backup steps, and recovery limits.
- Persist task/run separation, dependencies, triage, steering, interruption, and restart reconciliation.
- Protect manual edits and reject stale completion and duplicate external effects.
- Run approved checks and collect exact diffs, command outcomes, previews, and unresolved uncertainty.
- Implement scoped checkpoints and a previewed, approved restore. Preserve newer work before destructive replacement, reconcile active writers, retain audit history, and invalidate affected evidence. Explicitly exclude unsupported external-effect rollback.
- Present one outcome review package, while internal subtasks retain their evidence and honest status.

Evidence: a real provider completes a bounded change, checks run against its revision, a manual edit is preserved, stop/restart reconciles, and stale output cannot pass acceptance. Checkpoint restore covers newer edits, untracked files, partial failure, replay after restart, and repeated requests without silent data loss.

### C05. Add linked idea threads and a bounded council

Design coverage: consolidated sections 7 and 8.

Dependencies: C01, C02, C03, C04.

- Capture an interruption as a linked idea without losing the main goal or automatically spending money.
- Preserve parent context, return point, findings, and pending decisions across thread switches and restart.
- Run explicitly bounded read-only investigations or independent reviews with visible purpose, model/provider, state, scope, available traces, artifacts, and cost information.
- Synthesize agreement and disagreement with evidence. Do not present consensus or generated reasoning as verification.
- Keep findings as proposals until applicable approval. Block shared-root concurrent writes.

Evidence: linked-thread return, conflicting conclusions, failed/cancelled agents, bounded fan-out, denied spending, and no unintended parent-plan mutation.

### C06. Add reflection, calibration, and lasting documentation

Design coverage: consolidated sections 4.7, 4.8, and 9.

Dependencies: C02, C03, C05.

- Offer a brief optional end-of-session reflection based on observed events and user feedback.
- Let users decline reflection and close immediately. Recover pending work after forced closure.
- Capture improvements as proposals, not silent policy, prompt, memory, or code changes.
- Offer skippable expertise and explanation preferences that remain inspectable and reversible.
- Store work-specific plans and artifacts under a consistent convention. Propose lasting documentation updates for purpose, decisions, and observed outcomes, with links and authority boundaries.

Evidence: declined and corrected reflection, policy approval protection, preference correction, artifact-to-doc provenance, and superseded-plan handling.

### C07. Package stable/dev separation and diagnostic test bundles

Design coverage: consolidated sections 12 and 13.

Dependencies: C01, C02, C04. Final capture checks also exercise C05 and C06.

- Keep stable daily use separate from candidate extension testing and storage.
- Produce a versioned extension package through CI with reproducible checks and release provenance.
- Test the candidate on another repository as well as the Piarre improvement workflow.
- Export synchronized logs, relevant revisions, provider/model configuration, checks, and a manifest linking optional voice or screen recordings.
- Separate recording, retention, export, and remote-analysis choices. Redact secrets and verify local deletion behavior.
- Document recovery from a bad candidate without overwriting the stable user's context.

Evidence: packaged candidate, separate Development Host, isolated test data, test bundle, redaction/deletion check, and stable environment preservation.

### C08. Validate alignment and hand over one integrated candidate

Design coverage: consolidated sections 16–18.

Dependencies: C01–C07.

- Run the acceptance journey, inherited safety scenarios, and expanded product scenarios against the exact candidate revision.
- Use independent coverage review for missing or weak requirements. Resolve concrete findings before user handoff.
- Run applicable lint, type, build, packaging, contract, integration, and live-provider checks. A blocked live scenario is not a pass.
- Compare local and approved stronger models on a bounded sample of realistic dialogue, recall, and structured actions. Report quality, cost uncertainty, responsiveness, and memory separately.
- Compare the integrated journey with a comparable existing-workflow task. Capture active supervision time, reading effort, interruptions, corrections, missed defects, and accepted outcomes, with sample counts and limitations.
- Record useful-response and control responsiveness during active work, peak memory, hardware, provider, model, context size, and failures. A single feedback session is not statistical proof of reduced fatigue.
- Report passed, failed, blocked, unsupported, and not-tested scenarios with evidence.
- Provide a short testing guide, known limits, a working candidate, and one place to collect the user's feedback.

Evidence: release manifest, complete traceability matrix, observed scenario results, independent review disposition, and a consolidated user test package.

## 5. Validation strategy

Evaluation establishes a concrete starting point for successive improvements. It does not require a perfect first product. Keep three judgments separate: minimum trust and recovery gates, whether the user finds the complete experience useful, and baseline measures that guide later iterations. Supervision effort includes reminders, repeated explanations, manual status checks, reading burden, and corrections. Missed failures include cases where the product claimed success or safety despite contradictory observable evidence. Ordinary UX improvements can enter the next iteration, while unauthorized actions, lost work, and misleading verification remain release blockers.

Apply KISS to the product and implementation. Use pstack practices proportionally. Arena compares alternative interaction or architectural shapes when the choice is consequential. Swarm partitions independent coverage or investigation work, with separate write ownership. Independent review targets concrete risk rather than duplicating every investigation.

TDD applies to defects with a practical regression target. Demonstrate failure for the intended reason before the fix, then rerun. Do not claim TDD for documentation or invent expensive mock-heavy tests to satisfy a label.

The core release scenarios are:

| Scenario | Observed requirement | Primary package |
|---|---|---|
| Resume | Brief accomplishments, next tasks, unresolved decisions, correct sources. | C03 |
| Broad intent | Useful recommendation and consequential clarification, linked to Basis. | C02, C03 |
| Plan and triage | Reversible visible changes without implied execution approval. | C04 |
| Spend and damage | Concrete consequences, cost uncertainty, approval, and recovery limitations. | C04 |
| Useful completion | Actual revision-bound checks and one consolidated review. | C04 |
| Provisional work | Changed intent cancels old drafts and rejects late results without unauthorized effects. | C02 |
| Progress | Honest milestone updates while the user is silent, without routine log spam. | C02 |
| Correction | Contradiction resolution preserves provenance and invalidates affected work. | C03 |
| Side idea | Capture, investigate within authority, and return without context loss. | C05 |
| Council | Disagreement, failure, available traces, and bounded resource use remain visible. | C05 |
| Reflection | Optional, correctable, and unable to rewrite policy silently. | C06 |
| Documentation | Lasting intent and outcomes link back to work artifacts with clear authority. | C06 |
| Recovery | Stop, manual edits, restart, disconnect, and duplicate requests preserve honest state. | C04 |
| Checkpoint restore | Preview, approval, preservation of newer work, failure recovery, and stale evidence handling. | C04 |
| Simplicity and adopted principles | The simplest coherent workflow meets the need, with a versioned principle-to-behavior inventory. | C01, C08 |
| User testing | Separate candidate, synchronized evidence, optional recording links, and privacy controls. | C07 |
| Alignment | Every in-scope requirement has observed evidence or an explicit release blocker. | C08 |

Speech recognition, silence detection, spoken interruption, and local voice memory are future capability gates. They cannot be passed using the typed candidate.

## 6. Approval and escalation points

Continue routine authorized implementation without user walkthroughs. Interrupt only for unresolved product choices that materially affect scope, new spending, actions beyond authority, or a blocker that cannot be resolved from evidence.

The existing execution PR is closed as superseded following the product discussion. Preserve its branch and review evidence, and assess reuse without treating it as merged work. Do not release the daily production extension merely because the candidate checks pass. Shipping needs the applicable explicit authorization.

A single initial feedback round is the desired experience. Material defects, changes in scope, or later voice capabilities still require appropriate verification and may require another focused user test.

## 7. Plan publication and status

The C epic and eight child issues are published in [Project 8](https://github.com/users/sysung/projects/8), with the `piarre-c` label and P0 priority. The baseline work package is Ready; the other C items remain in Backlog. Dependencies are recorded in each issue. Native parent and dependency links are verified separately before this planning task is complete. Superseded open B planning issues are retired as not planned and archived from the active board, with links to their C replacements or deferred scope. Completed B cards remain in project history. The bounded-execution review is closed as superseded and its board card is archived. Its source branch remains available for reuse assessment. None is counted as completed C work.

No hour estimate is copied from B. Model, integration, UX, and local inference uncertainty require evidence before a delivery estimate. This plan is a reviewable first implementation route, not a claim that the expanded product can be built in one unattended pass.

## 8. Published execution queue

| Work package | GitHub issue |
|---|---|
| C00 | [Deliver the first integrated Piarre candidate](https://github.com/sysung/piarre/issues/51) |
| C01 | [Establish contracts, traceability, and a current baseline](https://github.com/sysung/piarre/issues/52) |
| C02 | [Build the conversational workspace and responsive controls](https://github.com/sysung/piarre/issues/53) |
| C03 | [Implement inspectable memory, Basis, and project resumption](https://github.com/sysung/piarre/issues/54) |
| C04 | [Implement bounded execution and consolidated outcome review](https://github.com/sysung/piarre/issues/55) |
| C05 | [Add linked idea threads and a bounded council](https://github.com/sysung/piarre/issues/56) |
| C06 | [Add reflection, calibration, and lasting documentation](https://github.com/sysung/piarre/issues/57) |
| C07 | [Package stable/dev separation and diagnostic test bundles](https://github.com/sysung/piarre/issues/58) |
| C08 | [Validate alignment and hand over one integrated candidate](https://github.com/sysung/piarre/issues/59) |
