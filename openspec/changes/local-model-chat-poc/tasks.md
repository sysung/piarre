# Tasks

All checkboxes are future delivery, not completed planning. Each is a draft GitHub child issue. Publication needs review; implementation needs its real issue and an issue-linked branch.

## Story map

| Parent | Milestone | User story |
|---|---|---|
| S0 | M0 | I can start clean and recover the old version. |
| S1 | M0 | I can isolate testing from daily work. |
| S2 | M0 | I can see future work and its blockers. |
| S3 | M1 | I can run a local model and inspect speed and memory. |
| S4 | M1 | I can choose a model using comparable quality results. |
| S5 | M2 | I can chat with the selected model through Rig. |
| S6 | M3 | I can explicitly accept or reject the PoC. |

Every child uses enhancement and exactly one triage label. Provisional work starts needs-triage with missing inputs linked to their producing task. Human gates become ready-for-human when inputs exist. Research briefs may become ready-for-agent after review; blockers and positive evidence predicates still apply. Parents are navigation, not execution dependencies.

## 0. M0 Preparation and isolation

- [x] 0.0 Bootstrap the reviewed issue map. Verify using the steps below.
  - Description: Create reviewed tracking records before implementation.
  - Value: Give implementation an issue before edits.
  - Parent: S2. Blocked by: none.
  - Human verification:
    1. Match approved M0 tickets and M1–M3 placeholders to real issues.
    2. Verify parent links and initial blocked states.
  - Excludes: code changes, model installation and scoring.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [x] 0.1 Verify the recovery reference. Verify using the steps below.
  - Description: Record a restorable remote reference at the pre-reset SHA.
  - Value: Preserve a recoverable old version.
  - Parent: S0. Blocked by: none.
  - Human verification:
    1. Inspect a remote reference at the pre-reset SHA and open it in a separate checkout.
    2. Compare tracked contents.
  - Excludes: model scoring and chat implementation; only this task's approved preparation scope.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [x] 0.2 Approve the exact reset manifest. Verify using the steps below.
  - Description: List tracked deletions and retained paths for approval.
  - Value: Remove legacy work without losing unrelated files.
  - Parent: S0. Blocked by: 0.0, 0.1.
  - Human verification:
    1. Review every proposed deletion and retained path against current tracked state.
    2. Record maintainer approval.
  - Excludes: model scoring and chat implementation; only this task's approved preparation scope.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [ ] 0.3 Remove approved legacy code and release machinery. Verify using the steps below.
  - Description: Delete only approved paths and retire their release jobs.
  - Value: Give the PoC a clean starting point.
  - Parent: S0. Blocked by: 0.2.
  - Human verification:
    1. Inspect the diff against the approved manifest and confirm no VSIX release job remains.
    2. Document recovery.
  - Excludes: model scoring and chat implementation; only this task's approved preparation scope.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [ ] 0.4 Record retained and retired specification scope. Verify using the steps below.
  - Description: Document which legacy contracts are retired or replaced.
  - Value: Prevent agents from following obsolete product requirements.
  - Parent: S0. Blocked by: 0.3.
  - Human verification:
    1. Compare all eight legacy capabilities with this change's deltas.
    2. Record retirement/purpose follow-up and update navigation.
  - Excludes: model scoring and chat implementation; only this task's approved preparation scope.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [ ] 0.5 Inventory runtime and model prerequisites. Verify using the steps below.
  - Description: Record exact artifacts, licenses, formats and compatibility.
  - Value: Avoid spending implementation effort on unsupported artifacts.
  - Parent: S1. Blocked by: none.
  - Human verification:
    1. Read exact versions, licenses, formats, sizes, parameter counts, and compatibility evidence.
    2. List missing prerequisites without installing.
  - Excludes: model scoring and chat implementation; only this task's approved preparation scope.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [ ] 0.6 Approve the isolation and provisioning profile. Verify using the steps below.
  - Description: Specify permitted native-server, storage and network access.
  - Value: Keep the experiment separate from daily work.
  - Parent: S1. Blocked by: 0.5.
  - Human verification:
    1. Review mounts, user, native-server permissions, management routes, egress, cache paths, and permitted downloads.
    2. Record approval.
  - Excludes: model scoring and chat implementation; only this task's approved preparation scope.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [ ] 0.7 Check the surrogate isolation environment. Verify using the steps below.
  - Description: Probe the proposed policy using a synthetic endpoint.
  - Value: Prove access limits before model use.
  - Parent: S1. Blocked by: 0.0, 0.6.
  - Human verification:
    1. Probe synthetic denied paths and endpoints in the empty environment.
    2. Label evidence surrogate-only and preserve live-runtime gates.
  - Excludes: model scoring and chat implementation; only this task's approved preparation scope.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [ ] 0.8 Freeze measurement and evaluation protocol. Verify using the steps below.
  - Description: Pin workloads, limits, scoring and measurement methods.
  - Value: Make comparisons explainable and repeatable.
  - Parent: S2. Blocked by: 0.5, 0.6.
  - Human verification:
    1. Review workload IDs, cohort rules, memory accounting, repetitions, quality scoring, evaluator containment, and failure reporting.
    2. Read back the evidence and confirm the expected outcome stated above.
  - Excludes: model scoring and chat implementation; only this task's approved preparation scope.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [ ] 0.9 Finalize the complete backlog after research. Verify using the steps below.
  - Description: Update existing placeholders after research without duplicates.
  - Value: Make future work visible before implementation.
  - Parent: S2. Blocked by: 0.0, 0.4, 0.8.
  - Human verification:
    1. Update existing issue briefs and blockers without duplication.
    2. Read back all M0–M3 relationships and unresolved inputs.
  - Excludes: code changes, model installation and scoring.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [ ] 0.10 Configure Project views and transitions. Verify using the steps below.
  - Description: Configure three agreed views and their transition rules.
  - Value: Show progress without claiming premature acceptance.
  - Parent: S2. Blocked by: 0.9.
  - Human verification:
    1. Inspect three agreed views.
    2. Exercise new, closed, reopened, blocked, and UAT cases on approved disposable items; read back automations.
  - Excludes: code changes, model installation and scoring.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [ ] 0.11 Review M0 readiness with the maintainer. Verify using the steps below.
  - Description: Present M0 evidence for a human proceed or revise decision.
  - Value: Agree the environment and backlog before running models.
  - Parent: S2. Blocked by: 0.7, 0.10.
  - Human verification:
    1. Review recovery, cleanout, isolation evidence, research, complete backlog and protocol.
    2. Record a human proceed or revise decision.
  - Excludes: model scoring and chat implementation; only this task's approved preparation scope.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

## 1. M1 Running a local model

- [ ] 1.1 Provision one approved baseline model. Verify using the steps below.
  - Description: Provision an approved artifact in its dedicated location.
  - Value: Establish the smallest working local route.
  - Parent: S3. Blocked by: 0.11.
  - Human verification:
    1. Verify approved artifact identity, storage and startup/stop procedure.
    2. Use synthetic data only until the live-route gate passes.
  - Excludes: Rig chat features, harness tools and unapproved experiment expansion.
  - Contract: [isolated-local-inference](specs/isolated-local-inference/spec.md); [verification](design.md#verification-plan).

- [ ] 1.2 Qualify the live inference route. Verify using the steps below.
  - Description: Probe the actual server and client access path.
  - Value: Prevent measurements on an unapproved access path.
  - Parent: S3. Blocked by: 1.1.
  - Human verification:
    1. Check actual server permissions, listening routes and denied management/network operations.
    2. Record pass/fail/unknown before timing.
  - Excludes: Rig chat features, harness tools and unapproved experiment expansion.
  - Contract: [isolated-local-inference](specs/isolated-local-inference/spec.md); [verification](design.md#verification-plan).

- [ ] 1.3 Qualify candidate memory and timing. Verify using the steps below.
  - Description: Measure each candidate's attributed memory and latency.
  - Value: Determine whether the baseline fits the local budget.
  - Parent: S3. Blocked by: 1.2.
  - Human verification:
    1. Repeat the frozen workload for each approved configuration after live-route qualification.
    2. Record eligible, excluded or unknown per context tier.
  - Excludes: Rig chat features, harness tools and unapproved experiment expansion.
  - Contract: [isolated-local-inference](specs/isolated-local-inference/spec.md); [verification](design.md#verification-plan).

- [ ] 1.4 Compare compatible runtime configurations. Verify using the steps below.
  - Description: Measure compatible runtimes using a common artifact.
  - Value: Choose the local serving configuration from measurements.
  - Parent: S3. Blocked by: 1.3.
  - Human verification:
    1. Compare eligible common-artifact runtime profiles.
    2. Record unsupported configurations without blocking other eligible candidates.
  - Excludes: Rig chat features, harness tools and unapproved experiment expansion.
  - Contract: [inference-evaluation](specs/inference-evaluation/spec.md); [verification](design.md#verification-plan).

- [ ] 1.5 Qualify the model-quality evaluator. Verify using the steps below.
  - Description: Prepare a disposable evaluator with bounded resources.
  - Value: Contain generated benchmark code.
  - Parent: S4. Blocked by: 0.11.
  - Human verification:
    1. Demonstrate timeout, memory/output limits, denied network/host access and disposable cleanup on known synthetic cases before model outputs.
    2. Read back the evidence and confirm the expected outcome stated above.
  - Excludes: Rig chat features, harness tools and unapproved experiment expansion.
  - Contract: [inference-evaluation](specs/inference-evaluation/spec.md); [verification](design.md#verification-plan).

- [ ] 1.6 Evaluate the eligible small-model cohort. Verify using the steps below.
  - Description: Score eligible models on the frozen public task slice.
  - Value: Choose a model from quality and speed evidence.
  - Parent: S4. Blocked by: 1.4, 1.5.
  - Human verification:
    1. Score eligible candidates with frozen quality budgets in the qualified evaluator.
    2. Retain all exclusions and failed attempts.
  - Excludes: Rig chat features, harness tools and unapproved experiment expansion.
  - Contract: [inference-evaluation](specs/inference-evaluation/spec.md); [verification](design.md#verification-plan).

- [ ] 1.7 Record the selected configuration or stop decision. Verify using the steps below.
  - Description: Pin a qualified selection or record a stop decision.
  - Value: Give M2 a supported baseline.
  - Parent: S4. Blocked by: 1.6.
  - Human verification:
    1. Review all evidence and record a qualified selection ID or no-go.
    2. A no-go must leave M2 blocked.
  - Excludes: Rig chat features, harness tools and unapproved experiment expansion.
  - Contract: [inference-evaluation](specs/inference-evaluation/spec.md); [verification](design.md#verification-plan).

## 2. M2 Creating the agent harness

- [ ] 2.1 Route a fixed input through containerized Rig. Verify using the steps below.
  - Description: Add a minimal Rust request path inside Compose.
  - Value: Prove integration inside the intended boundary.
  - Parent: S5. Blocked by: 1.7.
  - Human verification:
    1. Launch a minimal Compose image against the qualified route and confirm model identity.
    2. Unavailable endpoint yields an error without fallback.
  - Excludes: execution tools, persistent history, full-screen UI and remote fallback.
  - Contract: [typed-discussion](specs/typed-discussion/spec.md); [verification](design.md#verification-plan).

- [ ] 2.2 Add Rustyline conversation input. Verify using the steps below.
  - Description: Add editable input and session-local conversation context.
  - Value: Let a user exchange messages without a full-screen UI.
  - Parent: S5. Blocked by: 2.1.
  - Human verification:
    1. Edit input and send two related turns.
    2. Verify in-session context and fresh history after restart; document usage.
  - Excludes: execution tools, persistent history, full-screen UI and remote fallback.
  - Contract: [typed-discussion](specs/typed-discussion/spec.md); [verification](design.md#verification-plan).

- [ ] 2.3 Stream and safely render model text. Verify using the steps below.
  - Description: Render streamed replies without terminal side effects.
  - Value: Make replies readable without terminal side effects.
  - Parent: S5. Blocked by: 2.2.
  - Human verification:
    1. Observe incremental output and synthetic split escape sequences.
    2. Verify control sequences cannot alter clipboard or terminal state.
  - Excludes: execution tools, persistent history, full-screen UI and remote fallback.
  - Contract: [typed-discussion](specs/typed-discussion/spec.md); [verification](design.md#verification-plan).

- [ ] 2.4 Enforce context and request limits. Verify using the steps below.
  - Description: Implement validated context accounting and request deadlines.
  - Value: Prevent silent truncation and stalled sessions.
  - Parent: S5. Blocked by: 2.3.
  - Human verification:
    1. Exercise context overflow plus each frozen deadline with synthetic input.
    2. Observe explicit incomplete/error outcomes and no silent history loss.
  - Excludes: execution tools, persistent history, full-screen UI and remote fallback.
  - Contract: [typed-discussion](specs/typed-discussion/spec.md); [verification](design.md#verification-plan).

- [ ] 2.5 Cancel and reconcile interrupted requests. Verify using the steps below.
  - Description: Expose interrupted outcomes and reconcile server activity.
  - Value: Stop local output without hiding remaining server work.
  - Parent: S5. Blocked by: 2.4.
  - Human verification:
    1. Cancel and disconnect a stream.
    2. Verify no retry or overlapping request until idle confirmation or serving-process restart.
  - Excludes: execution tools, persistent history, full-screen UI and remote fallback.
  - Contract: [typed-discussion](specs/typed-discussion/spec.md); [verification](design.md#verification-plan).

- [ ] 2.6 Package the chat launch in Compose. Verify using the steps below.
  - Description: Verify packaged launch paths and finish setup instructions.
  - Value: Make the same chat setup repeatable for another tester.
  - Parent: S5. Blocked by: 2.5, 0.7.
  - Human verification:
    1. Use both documented launch paths and recheck the actual image, mounts, route and terminal exits.
    2. Confirm no model download or personal-data persistence.
  - Excludes: execution tools, persistent history, full-screen UI and remote fallback.
  - Contract: [typed-discussion](specs/typed-discussion/spec.md); [verification](design.md#verification-plan).

## 3. M3 User Acceptance Testing

- [ ] 3.1 Run the human acceptance session. Verify using the steps below.
  - Description: Have the maintainer exercise and assess the PoC.
  - Value: Learn whether the PoC is usable and separated from daily work.
  - Parent: S6. Blocked by: 2.6.
  - Human verification:
    1. Maintainer follows setup/chat/cancel/restart/error/isolation checklist on the pinned build.
    2. Record observed results and linked defects.
  - Excludes: new features and acceptance inferred from issue closure.
  - Contract: [result-review](specs/result-review/spec.md); [verification](design.md#verification-plan).

- [ ] 3.2 Retest accepted UAT fixes. Verify using the steps below.
  - Description: Recheck accepted fixes or record that none need retesting.
  - Value: Resolve demonstrated blockers without unplanned expansion.
  - Parent: S6. Blocked by: 3.1.
  - Human verification:
    1. Retest scoped linked defects against the exact build, or record no retest needed when no accepted fixes exist.
    2. Preserve unresolved blockers.
  - Excludes: new features and acceptance inferred from issue closure.
  - Contract: [result-review](specs/result-review/spec.md); [verification](design.md#verification-plan).

- [ ] 3.3 Record PoC acceptance and next questions. Verify using the steps below.
  - Description: Record explicit acceptance or rejection and future questions.
  - Value: End the experiment with an explicit decision.
  - Parent: S6. Blocked by: 3.2.
  - Human verification:
    1. Read the maintainer's accepted or rejected disposition with build and evidence IDs.
    2. Closing a rejected experiment must not mark it accepted.
  - Excludes: new features and acceptance inferred from issue closure.
  - Contract: [result-review](specs/result-review/spec.md); [verification](design.md#verification-plan).

## Readiness and publication predicates

- 0.0 publishes reviewed M0 records and provisional M1–M3 placeholders before implementation. Keep a draft-to-issue map; preserve unrelated records. 0.9 finalizes the existing records after research.
- 0.3 requires verified recovery and fresh manifest approval. Include spec retirement/navigation in the reset review; 0.4 completes the mapping without prematurely syncing unimplemented chat requirements.
- 0.7 qualifies only its surrogate. Each actual runtime/client-route pair must satisfy 1.2 before measurement, including alternatives in 1.4/1.6. Each candidate must satisfy 1.3 memory eligibility before ranking. Exclusion is a research outcome, not qualification.
- Failure of the baseline does not prevent trying other entries in the bounded approved inventory. If none qualify, 1.7 records no-go and 2.1 remains blocked despite the closed native dependency.
- 2.1 requires a positive selection ID from 1.7 with qualified route, memory and evaluator evidence. 3.1 requires passing final Compose qualification from 2.6. Put these predicates in the issue briefs and Ready transition review.
- 3.2 can complete with evidence that no retest is needed. 3.3 may close accepted or rejected; the decision must be explicit. Closure alone does not mean acceptance.
- 0.5 and 0.8 provide exact versions, candidates, commands and budgets. Downstream briefs stay provisional until these inputs exist. New tests/verifiers need the authorship authorization described in design.

## Workflow follow-up

- Review planning and explicitly request apply before implementation.
- Prefix published triage issues/comments with the AI-generated disclaimer. Link briefs to published OpenSpec artifacts, and preserve native blockers separately from parentage.
- Review reset paths, provisioning operations and GitHub mutations within their stated scopes.
- Sync/archive after delivery and human gates; update legacy Purpose text and check historical links.
