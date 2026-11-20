# Tasks

Approved revision: 2026-11-15. Real model first; user chat trial before workspace tools. Deferred work below is not counted as completed delivery.

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

- [x] 0.3 Remove approved legacy code and release machinery. Verify using the steps below.
  - Description: Delete only approved paths and retire their release jobs.
  - Value: Give the PoC a clean starting point.
  - Parent: S0. Blocked by: 0.2.
  - Human verification:
    1. Inspect the diff against the approved manifest and confirm no VSIX release job remains.
    2. Document recovery.
  - Excludes: model scoring and chat implementation; only this task's approved preparation scope.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [x] 0.4 Record retained and retired specification scope. Verify using the steps below.
  - Description: Document which legacy contracts are retired or replaced.
  - Value: Prevent agents from following obsolete product requirements.
  - Parent: S0. Blocked by: 0.3.
  - Human verification:
    1. Compare all eight legacy capabilities with this change's deltas.
    2. Record retirement/purpose follow-up and update navigation.
  - Excludes: model scoring and chat implementation; only this task's approved preparation scope.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [x] 0.5 Inventory runtime and model prerequisites. Verify using the steps below.
  - Description: Inventory pinned artifacts, licenses, formats, documented compatibility and unresolved prerequisites.
  - Value: Avoid spending implementation effort on unsupported artifacts.
  - Parent: S1. Blocked by: none.
  - Human verification:
    1. Trace artifact identities, versions, licenses, formats, sizes, published parameter counts and documented support to sources; mark unknowns explicitly.
    2. Assign every unresolved prerequisite to its consuming task. Inventory completion requires no installation, live qualification or benchmark results.
  - Excludes: model scoring and chat implementation; only this task's approved preparation scope.
  - Contract: [poc-delivery](specs/poc-delivery/spec.md); [verification](design.md#verification-plan).

- [x] 0.6 Record the approved disposable workspace profile. Verify using the human steps below.
  - Description: Record the approved disposable workspace profile.
  - Value: Keep the experiment separate from personal work.
  - Parent: S1. Blocked by: 0.5.
  - Human verification: Read the approved profile: one container, no personal mounts, direct local inference, chat trial before tools.
  - Contract: [design and verification](design.md#verification-plan).

- [x] 0.9 Reconcile the approved PoC backlog. Verify using the human steps below.
  - Description: Reconcile the approved PoC backlog.
  - Value: Show the next useful work without research blockers.
  - Parent: S2. Blocked by: 0.0, 0.4, 0.6.
  - Human verification: Read back milestones, parents, PR links and native blockers; deferred research has no path into chat.
  - Contract: [design and verification](design.md#verification-plan).

- [x] 0.11 Record the approved M0 direction. Verify using the human steps below.
  - Description: Record the approved M0 direction.
  - Value: Begin real integration using the agreed scope.
  - Parent: S2. Blocked by: 0.6, 0.9.
  - Human verification: Record the user approval of real Qwen, direct Rig, disposable workspace and later file tools; distinguish approval from execution.
  - Contract: [design and verification](design.md#verification-plan).

## 1. M1 Running a local model

- [x] 1.1 Provision the first real local model. Verify using the human steps below.
  - Description: Provision the first real local model.
  - Value: Make actual inference available.
  - Parent: S3. Blocked by: 0.11.
  - Human verification: Use or download the pinned Qwen artifact, record identity and runtime, and document start/stop. No fake model or cloud fallback.
  - Contract: [design and verification](design.md#verification-plan).

- [x] 1.2 Observe the real local inference route. Verify using the human steps below.
  - Description: Observe the real local inference route.
  - Value: Know that the model responds before adding Rig.
  - Parent: S3. Blocked by: 1.1.
  - Human verification: Send a simple real prompt; record response or exact failure and endpoint/model settings. No score or memory admission check.
  - Contract: [design and verification](design.md#verification-plan).

- [x] 1.7 Record the working local configuration. Verify using the human steps below.
  - Description: Record the working local configuration.
  - Value: Give Rig a reproducible starting configuration.
  - Parent: S3. Blocked by: 1.2.
  - Human verification: Record the actual endpoint, model, runtime and observed response; failures remain failures and another model may be tried.
  - Contract: [design and verification](design.md#verification-plan).

## 2. M2 Creating the agent harness

- [x] 2.1 Route a real request through containerized Rig. Verify using the human steps below.
  - Description: Route a real request through containerized Rig.
  - Value: Prove the integration using the intended environment.
  - Parent: S5. Blocked by: 1.7.
  - Human verification: Build and launch Rig with Compose against real Qwen; inspect mounts/user and observe the reply. An unavailable endpoint reports an error.
  - Contract: [design and verification](design.md#verification-plan).

- [x] 2.2 Add Rustyline conversation input. Verify using the human steps below.
  - Description: Add Rustyline conversation input.
  - Value: Let the user hold a conversation.
  - Parent: S5. Blocked by: 2.1.
  - Human verification: Edit input and send two related turns; restart and observe fresh session history.
  - Contract: [design and verification](design.md#verification-plan).

- [x] 2.3 Stream and safely render responses. Verify using the human steps below.
  - Description: Stream and safely render responses.
  - Value: Show replies as they arrive without terminal side effects.
  - Parent: S5. Blocked by: 2.2.
  - Human verification: Observe incremental real-model output; inspect filtering of terminal-control sequences, including split chunks.
  - Contract: [design and verification](design.md#verification-plan).

- [x] 2.5 Handle cancellation and partial outcomes. Verify using the human steps below.
  - Description: Handle cancellation and partial outcomes.
  - Value: Let the user stop a request without confusing partial output with completion.
  - Parent: S5. Blocked by: 2.13.
  - Human verification: Cancel a live response; observe prompt return, no automatic retry and honest backend uncertainty.
  - Evidence: [Real Qwen cancellation checks](cancellation.md).
  - Contract: [design and verification](design.md#verification-plan).

- [x] 2.6 Document launch and disposable teardown. Verify using the human steps below.
  - Description: Document launch and disposable teardown.
  - Value: Make the same environment usable by the maintainer.
  - Parent: S5. Blocked by: 2.5.
  - Human verification: Follow launch/stop/reset instructions; inspect no personal mounts, writable scratch only, no persisted chat and discarded workspace.
  - Evidence: [Launch and teardown checks](launch-teardown.md).
  - Contract: [design and verification](design.md#verification-plan).

- [x] 2.7 Try real chat before enabling file tools. Verify using the human steps below.
  - Description: Try real chat before enabling file tools.
  - Value: Let the user assess chat before model-driven changes.
  - Parent: S5. Blocked by: 2.6.
  - Human verification: The maintainer tries real chat and explicitly records readiness to try workspace tools. Tools remain disabled until that choice.
  - Decision (2026-11-18): After personally trying chat/cancellation, selecting MiniCPM5-2B and accepting the recorded recall limitations in #206, the maintainer instructed us to continue when presented with this checkpoint and the next list/read slice. Proceed to disposable workspace tools. This is not final PoC acceptance or permission to access personal files.
  - Contract: [design and verification](design.md#verification-plan).

- [ ] 2.8a Evaluate and adopt Rig Agent if it preserves chat and simplifies the loop.
  - Value: Use a shorter turn loop before expanding model tool access.
  - Parent: [#174](https://github.com/sysung/piarre/issues/174). Blocked by: 2.7. Issue: [#212](https://github.com/sysung/piarre/issues/212).
  - Human verification: With real MiniCPM, observe streaming and a follow-up, cancel a turn and confirm it stays out of history, then observe a harmless tool round trip. Record whether the migration meets the adoption criteria.
  - Contract: [design and verification](design.md#verification-plan).

- [ ] 2.8b Enforce permissions for one disposable workspace.
  - Value: Ensure file access stays inside the container directory the user selected.
  - Parent: [#174](https://github.com/sysung/piarre/issues/174). Blocked by: 2.8a. Issue: [#213](https://github.com/sysung/piarre/issues/213).
  - Human verification: Independently of inference, select a valid subfolder and read an inside file. Verify outside paths and symlink escapes are rejected and invalid selections fail before inference.
  - Contract: [design and verification](design.md#verification-plan).

- [ ] 2.8c Connect MiniCPM to workspace listing and reading tools.
  - Description: Add workspace listing and reading tools.
  - Value: Let the agent inspect disposable sample files.
  - Parent: [#174](https://github.com/sysung/piarre/issues/174). Blocked by: 2.8b. Issue: [#214](https://github.com/sysung/piarre/issues/214).
  - Human verification: Real model calls list/read; operator checks results. Reject traversal, symlink escapes and non-regular files; bound output and tool steps.
  - Prior prototype: [PR #211](https://github.com/sysung/piarre/pull/211). Repeat the applicable checks against the replacement implementation.
  - Contract: [design and verification](design.md#verification-plan).

- [ ] 2.9 Create sample files through the real model. Verify using the human steps below.
  - Description: Create sample files through the real model.
  - Value: Prove that an agent request makes an observable file.
  - Parent: S5. Blocked by: 2.8c.
  - Human verification: Request a Python file in workspace-tool mode and inspect its bytes in the container. Reject existing-file overwrite and outside-workspace writes.
  - Contract: [design and verification](design.md#verification-plan).

- [ ] 2.10 Edit sample files through the real model. Verify using the human steps below.
  - Description: Edit sample files through the real model.
  - Value: Iterate on a sample file through conversation.
  - Parent: S5. Blocked by: 2.9.
  - Human verification: Request a specific edit, inspect the resulting contents and observe visible failures. No shell or Python execution.
  - Contract: [design and verification](design.md#verification-plan).

- [ ] 2.11 Delete sample files and report completed changes. Verify using the human steps below.
  - Description: Delete sample files and report completed changes.
  - Value: Try reversible disposable-workspace operations with honest results.
  - Parent: S5. Blocked by: 2.10.
  - Human verification: Request deletion and verify absence; reject root/recursive deletion. Cancel a multi-operation turn and inspect which completed changes remain.
  - Contract: [design and verification](design.md#verification-plan).

- [ ] 2.12 Show streamed model thinking separately from answers. Verify using the human steps below.
  - Description: Offer optional live model-provided reasoning with separate Thinking and Answer sections; distinguish hidden output from disabled reasoning.
  - Value: Let the user inspect emitted reasoning and see progress while waiting for an answer.
  - Parent: S5. Blocked by: 2.3. Issue: [#182](https://github.com/sysung/piarre/issues/182).
  - Human verification: Use the real supported configured model to observe thinking before the answer; hide thinking and retain the answer; report unavailable reasoning while keeping ordinary chat usable. Check filtering across chunks and honest interrupted/limited output. Document controls and observed time/output-limit effects in README.
  - Contract: [typed discussion](specs/typed-discussion/spec.md#requirement-show-optional-model-provided-reasoning); [design and verification](design.md#verification-plan).

- [x] 2.13 Remove harness output caps and request timeout. Verify using the human steps below.
  - Description: Remove the 128-token override and 120-second deadline; use configured model/runtime defaults without replacement knobs or generation deadlines.
  - Value: Let users see the answer without arbitrary harness cutoffs.
  - Parent: S5. Blocked by: 2.3. Issue: [#200](https://github.com/sysung/piarre/issues/200).
  - Human verification: Follow the issue verification plan: inspect request/transport configuration, observe long real output, verify context/history behavior and normal use. Record token-count or duration checks as unverified when not observed. Do not change runtime context merely to claim a pass.
  - Contract: [typed discussion](specs/typed-discussion/spec.md#requirement-use-runtime-generation-defaults-and-render-safe-text); [verification](design.md#verification-plan).

## 3. M3 User Acceptance Testing

- [ ] 3.1 Run the workspace agent acceptance session. Verify using the human steps below.
  - Description: Run the workspace agent acceptance session.
  - Value: Decide whether the small agent workflow is useful.
  - Parent: S6. Blocked by: 2.11.
  - Human verification: Maintainer creates, inspects, edits and deletes a sample file through the real model, resets the environment and records observations.
  - Contract: [design and verification](design.md#verification-plan).

- [ ] 3.2 Retest accepted UAT fixes. Verify using the human steps below.
  - Description: Retest accepted UAT fixes.
  - Value: Resolve demonstrated problems without expanding scope.
  - Parent: S6. Blocked by: 3.1.
  - Human verification: Recheck accepted fixes against the current build, or record no fixes need retesting.
  - Contract: [design and verification](design.md#verification-plan).

- [ ] 3.3 Record PoC acceptance and next questions. Verify using the human steps below.
  - Description: Record PoC acceptance and next questions.
  - Value: Decide what to improve next.
  - Parent: S6. Blocked by: 3.2.
  - Human verification: Record the maintainer acceptance or rejection with configuration and observed evidence; closure alone never means acceptance.
  - Contract: [design and verification](design.md#verification-plan).

## Deferred and superseded work

- 2.4 / #160: Retired as not planned; PR #199 closed without merging. Replaced by 2.13 / #200. This is not completed delivery.

- 0.7 / #145: Retired: surrogate isolation check. No active delivery task depends on it.
- 0.8 / #146: Deferred: comparison protocol. No active delivery task depends on it.
- 0.10 / #148: Parallel: Project views and transitions. No active delivery task depends on it.
- 1.3 / #152: Deferred: memory and timing observations. No active delivery task depends on it.
- 1.4 / #153: Deferred: runtime comparison. No active delivery task depends on it.
- 1.5 / #154: Deferred: benchmark evaluator. No active delivery task depends on it.
- 1.6 / #155: Deferred: model comparison. No active delivery task depends on it.

## Workflow follow-up

- Preserve completed recovery and research evidence. Update native GitHub dependencies alongside task briefs.
- Each worked issue links to its PR; future issues have no invented implementation evidence.
- Human chat trial and final UAT remain human actions. New automated tests/verifiers require explicit authorization.
- Sync/archive only after actual delivery and acceptance.
