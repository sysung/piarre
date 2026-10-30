# Product design for Piarre

**Status:** Draft v0.2 proposal
**Product:** Voice-first IDE for directing, observing, and verifying coding agents
**First delivery target:** VS Code extension with an editor-neutral core

This document describes the proposed product. It does not claim that the features exist. The v0.2 technical design, backlog, and evaluation plan define how each claim must earn current evidence.

## 1. Product thesis

Piarre helps a developer supervise agent work as a project, not as a collection of chats.

The developer states an objective by voice or text. Piarre turns that objective into a reviewable work graph with requirements, tasks, dependencies, owners, approvals, budgets, and acceptance checks. Coding agents perform bounded work. Piarre keeps project state, applies deterministic execution rules, and attaches current evidence to each result.

Voice is a control method. Voice is not the whole interface. The screen remains the source of precision for plans, code, diffs, costs, approvals, and evidence.

### Product promise

A developer can say what must change, see how Piarre divided the work, redirect active work, and verify the result without reconstructing context from several agent chats.

### Positioning

> Piarre is a voice-first IDE for directing, observing, and verifying teams of coding agents.

Codex and other providers supply workers. Piarre owns the project model, the supervision experience, and the rules that govern execution.

## 2. Problem

Agent tools can write code, but developers still coordinate the work manually. They repeat project context, inspect several conversations, resolve overlapping changes, check unsupported completion claims, and reconstruct decisions after interruptions.

Piarre tests the following product hypothesis:

> A persistent work graph, controlled through voice and a visual IDE, reduces the effort required to supervise bounded agent work without reducing developer control.

This hypothesis remains unverified. The product must compare Piarre with the developer's current workflow before it claims a productivity advantage.

### Objective: reduce AI fatigue

Piarre aims to reduce the mental effort of keeping up with AI-generated work. Developers should spend less attention reading agent output, reconstructing progress, checking repeated claims, and deciding which updates matter to their project.

Piarre must provide useful updates when they change what the developer needs to know or do. Routine execution details belong in an inspectable Activity history. The default experience prioritizes decisions, actionable blockers, material changes to scope or risk, failures that affect the outcome, and results ready for review.

The product must:

- Stay quiet when authorized work continues without a meaningful change. Deduplicate repeated updates and batch related non-urgent changes.
- Lead each necessary update with what changed, its effect on the project, and any action required from the user.
- Present a concise review summary with the changed scope, current check results, unresolved uncertainty, and links to exact diffs or evidence. Reveal detailed logs on demand.
- Run authorized automated checks and report their observed results so the user does not have to repeat routine validation or interpret unsupported completion claims.
- Keep outstanding decisions and review items visible until resolved, without repeatedly interrupting the user about unchanged items.
- Let the user request more detail or a progress update. Keep essential approvals, material failures, and uncertainty visible even when updates are reduced.

Fewer messages alone do not establish success. Reduced reading and interruption must not hide defects, weaken review, or transfer unrecognized risk to the developer. AI-fatigue reduction is a product objective to validate, not a current capability claim.

## 3. Audience

### Primary audience

The first user is an experienced solo developer or technical founder who:

- already uses coding agents.
- can review code, diffs, and test results.
- works in one local repository at a time.
- delegates multi-step work but wants explicit control.
- values voice when planning, navigating, or supervising work.
- wants to switch between voice, keyboard, and mouse without losing state.

### Secondary audience

- Engineers handling migrations, investigations, and maintenance work with several dependent tasks.
- Technical leads supervising bounded agent work inside their own workspace.
- Developers who need a local or provider-neutral control layer for privacy, cost, or reliability.
- Developers with motor or repetitive-strain constraints who benefit from voice control but still need a complete keyboard path.

### Early anti-personas

Piarre is not designed first for:

- people who cannot assess generated code or acceptance criteria.
- users seeking unattended production deployment.
- teams that need shared cloud collaboration and access control.
- users who expect guaranteed offline operation on any device.
- developers who want voice-driven character-by-character editing.
- users who want an agent to approve its own risky actions.

## 4. Jobs to be done

A developer hires Piarre to:

- turn a spoken goal into a plan with acceptance criteria.
- assign approved work without repeating project context.
- see what is ready, running, blocked, awaiting approval, or awaiting review.
- change a requirement without losing unrelated progress.
- ask why a decision was made and receive its recorded basis.
- stop speech, one task, or all work without confusing those actions.
- resume a project after an editor restart or provider failure.
- compare worker claims with current diffs, checks, and observations.
- choose a local or hosted model without changing the project model.
- reuse a successful work pattern without copying prompts between chats.

## 5. Differentiation

Piarre does not try to be a stronger coding model. It coordinates models and makes their work inspectable.

| General agent chat | Piarre |
|---|---|
| A conversation or task is the main object. | The project and work graph are the main objects. |
| One provider defines the experience. | Provider adapters implement one capability contract. |
| The model decides how to proceed. | Models propose actions. Deterministic code authorizes and applies them. |
| Status lives in messages. | Status lives in versioned tasks, runs, approvals, and evidence. |
| The user reconstructs dependencies. | Piarre stores and displays dependencies. |
| Completion is a worker response. | Completion requires current evidence and developer acceptance. |
| Voice behaves like spoken chat or dictation. | Voice directs visible project work. |

The product earns its place only if persistent supervision is better than using separate agent chats. Voice alone is not a defensible difference.

## 6. Product principles

1. **The project outlives the conversation.** Ending a voice session does not erase requirements, decisions, tasks, approvals, or evidence.
2. **Voice controls intent. The screen carries precision.** Speak goals and navigation. Inspect exact plans, code, diffs, budgets, and evidence visually.
3. **Speech stays brief and interruptible.** Piarre reports the state change or blocker. The UI holds the details.
4. **Models propose. Code decides.** Deterministic code owns authorization, task transitions, dependency state, budgets, and stale-result rejection.
5. **A completion claim needs current evidence.** A finished run can still require verification and review.
6. **Manual work is first-class.** Piarre detects conflicts and never silently overwrites user changes.
7. **Uncertainty is visible.** Unsupported controls, unknown run state, estimated cost, and stale evidence receive distinct labels.
8. **Voice is optional.** Every essential action has a keyboard, mouse, or typed-command path.
9. **Interrupt only for decisions.** Piarre stays quiet during authorized work unless the user asks, work completes, or a decision blocks progress.
10. **Start narrow.** Prove one supervised writer before adding concurrent writers.
11. **Protect developer attention.** Send updates that affect project decisions or outcomes. Keep routine detail available on demand and consolidate review evidence.

## 7. Product model

The following objects define the product:

| Object | Purpose |
|---|---|
| `Project` | Persistent workspace, policy, provider configuration, and history. |
| `Goal` | Desired outcome and acceptance criteria. |
| `Requirement` | Versioned constraint with provenance and confirmation status. |
| `Plan` | Versioned proposal that connects requirements to tasks. |
| `Task` | Bounded work with dependencies, scope, owner, and acceptance checks. |
| `Worker` | Configured agent provider and its verified capabilities. |
| `Run` | One worker attempt for a task and plan version. |
| `Approval` | Authorization for a concrete action, scope, revision, and duration. |
| `Budget` | Authorized limits, reservations, observed usage, and uncertainty. |
| `Decision` | Choice, rationale, alternatives, source, and affected work. |
| `Evidence` | Diff, command result, preview observation, or artifact tied to a revision. |
| `Workflow` | Reusable task structure with inputs, permissions, and acceptance checks. |
| `Session` | Temporary voice or typed interaction context. |

Task state and run state remain separate. A worker can finish a run while the task remains **Needs verification** or **Needs review**.

### Task states

- **Proposed** means the task belongs to an unapproved plan.
- **Ready** means dependencies and approvals allow execution.
- **Running** means a worker has an active run.
- **Blocked** means an external fact or dependency prevents progress.
- **Needs approval** means the next action exceeds current authorization.
- **Needs verification** means the run finished but required checks remain.
- **Needs review** means evidence is current and the developer must inspect the result.
- **Accepted** means the developer accepted the verified result.
- **Cancelled** means Piarre stopped future work and reconciled partial state.

Failed and interrupted runs remain visible inside the task history. They do not replace the task.

## 8. Information architecture

The primary navigation contains:

- **Work** shows the goal, plan, tasks, dependencies, owners, and current state.
- **Review** collects plans, approvals, diffs, previews, verification, and acceptance decisions.
- **Decisions** shows recorded choices, assumptions, alternatives, and affected tasks.
- **Activity** shows an event-backed history of worker and user actions.
- **Settings** controls providers, voice, privacy, policies, budgets, and accessibility.

Conversation history appears in a collapsible panel. It supports the work graph but does not replace it.

### Primary layout

```text
+----------------------------------------------------------------------------+
| Piarre / Portfolio       Voice off       Budget $5        [Stop all work]  |
+---------------+-----------------------------------+------------------------+
| Work          | Goal                              | Build homepage         |
| Review     1  | Publishable local portfolio       | Worker: Codex          |
| Decisions     | Plan v3             [Review plan] | State: Running         |
| Activity      |                                   |                        |
| Settings      |  [Accepted] Inspect workspace     | Scope                  |
|               |       |                           | src/pages              |
|               |  [Running] Build homepage        | src/styles             |
|               |       |                           |                        |
|               |  [Blocked] Verify layout         | [Changes] [Evidence]   |
|               |  Waiting for homepage            | [Activity]             |
|               |                                   |                        |
|               |  [Needs approval] Add package    | [Stop task]            |
+---------------+-----------------------------------+------------------------+
| [Start voice]  [Type a command...]                       [Conversation]    |
+----------------------------------------------------------------------------+
```

The middle column uses a dependency-aware task list first. A free-form node canvas can come later if testing proves that it improves navigation. Small projects must remain understandable without graph manipulation.

### Task inspector

The selected task shows:

- the desired outcome and acceptance checks.
- the current owner and verified capabilities.
- the approved file, command, network, and cost scope.
- dependencies and affected tasks.
- active and previous runs.
- current changes and conflicts.
- evidence freshness.
- available controls, based on provider capabilities.

Do not display **Pause** unless the worker proves safe suspension. Display **Stop task** when the only supported behavior is interruption and reconciliation.

## 9. Voice interaction

### Interaction loop

1. Piarre captures speech only during an explicit session.
2. The voice interpreter produces a transcript and a structured proposal.
3. Piarre resolves references against the visible selection and recent interaction.
4. Deterministic policy validates the target, scope, permission, budget, and plan version.
5. Piarre either applies the action, requests a review, or asks one blocking question.
6. Piarre reports the observed state and updates the screen.

### Example commands

- "Add a task to test password reset."
- "What is blocking checkout?"
- "Show the homepage diff."
- "Ask Codex to implement the approved homepage task."
- "Make dark mode the default."
- "Give the research task to the local model."
- "Stop talking."
- "Stop the homepage task."
- "Stop all work."
- "What still needs verification?"

### Reference resolution

Phrases such as "that task" first refer to the visible selection. Piarre can use recent interaction when the selected item does not resolve the phrase. If two targets remain plausible, Piarre asks which target the user means.

Piarre never guesses the target of a destructive action.

### Spoken status

Spoken status must match observed state:

- Say "Stop requested" before a worker confirms interruption.
- Say "Stopped. Two files changed" only after Piarre reconciles the run and workspace.
- Say "The build passed. Layout still needs review" when command evidence exists but visual review does not.
- Say "I cannot verify that yet" when evidence is missing or stale.

### Separate controls

- **Mute microphone** stops audio capture.
- **Stop speaking** stops Piarre audio output.
- **Stop task** interrupts one worker and reconciles partial changes.
- **Stop all work** stops speech, prevents new scheduling, requests interruption, and reconciles active runs.

Barge-in stops Piarre speech. It does not stop coding unless the utterance contains a validated work-control action.

### Voice modes

- **Continuous session** uses voice activity detection after the user explicitly starts the session.
- **Push to talk** supports shared offices, noisy rooms, and users who prefer tighter control.
- **Typed command** provides an equivalent path for every command.
- **Focus mode** speaks only when the user asks, a decision blocks work, or approved work completes.

## 10. Proposed features

All features in this section are proposals.

### P0 supervised worker

P0 proves the supervision loop with one active coding writer:

- explicit voice-session start, mute, push-to-talk, and end.
- typed fallback and keyboard access.
- visible transcript with partial and final states.
- a persistent project, goal, requirements, plan, task, and decision model.
- plan proposal, versioning, review, and approval.
- one coding worker with start, status, steer, stop, and capability detection.
- trusted-workspace and operation-scope enforcement.
- one active writer in the workspace.
- dependency-aware task state.
- diff, changed-file, command, test, and preview evidence.
- explicit **Needs verification**, **Needs review**, and **Accepted** gates.
- mid-build requirement changes with stale-plan protection.
- manual-edit conflict detection.
- restart replay and uncertain-run reconciliation.
- basic budget configuration and observed usage reporting.
- local export, retention, redaction, and verified deletion.
- one built-in workflow called **Build and verify a local website**.

### P1 supervised team

P1 adds workers only after P0 preserves state and evidence reliably:

- one parallel read-only research worker.
- two isolated coding workers using separate worktrees or equivalent boundaries.
- dependency scheduling and worker availability.
- provider capability comparison and explicit routing.
- conflict prediction before assignment.
- an integration-review task before changes enter the primary workspace.
- per-worker and per-task budgets.
- reusable workflow templates.
- independent verification by a different worker.
- comparison of competing plans or implementations.

### Later candidates

- team collaboration and shared project history.
- remote workers and organization policy.
- richer local models and offline bundles.
- workflow authoring UI.
- project-level knowledge retrieval.
- a desktop application outside VS Code.
- optional wake phrase.
- mobile supervision.
- deployment workflows with separate safety review.

## 11. Golden path

1. The developer opens a trusted workspace.
2. Piarre shows the connected worker, verified capabilities, execution boundary, and estimated cost behavior.
3. The developer selects an operation policy and an initial budget.
4. The developer starts voice or types a goal.
5. Piarre proposes requirements, tasks, dependencies, and acceptance checks.
6. The developer reviews the work graph and approves the plan and scope.
7. Piarre starts the ready task and shows its run, changes, and current evidence.
8. The developer asks why Piarre selected the stack. Piarre answers from the recorded decision without interrupting work.
9. The developer changes a requirement. Piarre marks affected work, creates a new plan version, and preserves unrelated progress.
10. The worker finishes. Piarre runs approved checks and attaches results to the current revision.
11. The developer reviews the diff and preview, then accepts or redirects the task.
12. After an editor restart, Piarre restores project state and reconciles uncertain runs with the workspace.

## 12. Onboarding

Onboarding must produce a small success before it asks the user to configure a team.

1. Explain that Piarre supervises agent work and does not replace code review.
2. Ask the user to choose a local workspace.
3. Show the first worker's capabilities and missing controls.
4. Explain which data the voice and coding providers receive.
5. Offer a safe starter task that changes one small area.
6. Show the plan, approval scope, run, evidence, and review in one guided flow.
7. Introduce budgets, additional workers, and workflows only after the first accepted task.

Do not require voice. Do not require a local model. Do not ask the user to design roles or workflows before they see the core loop.

## 13. Local and hosted models

Piarre separates the voice interpreter from coding workers.

A small local model can classify commands, resolve references, and draft structured action proposals. Deterministic code validates every proposal. Local speech recognition and synthesis can keep the conversation path on the device.

A hosted model can handle complex planning or speech when the user configures it. Coding workers remain separate. A local voice model does not make a hosted coding worker free or private.

### Provider policy

- Show which provider receives audio, transcripts, code, and tool output.
- Never send local-only content to a hosted provider without an explicit configuration change.
- Label local and hosted execution in the activity log and evidence.
- Parse every provider response at the adapter boundary.
- Advertise a capability only after its adapter passes behavior checks.
- Route uncertainty to clarification or an approved fallback. Do not silently change providers.

The first local-model experiment should compare a constrained low-memory model with a stronger small model on Piarre commands. It must measure command accuracy, ambiguity handling, latency, memory, and invalid-action rate before local inference becomes a supported dependency.

## 14. Trust and safety

### Authorization

An approval binds to the concrete action, scope, plan version, workspace revision, and duration. A material scope change invalidates the affected approval. A model cannot expand its own authority.

Voice alone cannot authorize destructive actions. The user confirms those actions in a visual control that names the exact target and consequence.

### Untrusted inputs

Treat repository text, worker messages, provider responses, tool output, and transcripts as untrusted inputs. They can inform proposals but cannot grant permission or change policy.

### Budgets

Stop new scheduling when an enforceable budget boundary is reached. Distinguish measured usage, provider estimates, and Piarre estimates. Do not advertise a hard cost cap unless the provider and execution controls can enforce it.

### Concurrent work

P0 permits one active writer. P1 isolates writers before running them concurrently. Piarre integrates results through an explicit review step. Two workers never write the same working tree concurrently.

### Cancellation and recovery

Cancellation stops future work. It does not imply rollback. Piarre preserves partial changes for inspection and reconciles owned processes and files.

After a restart or provider failure, Piarre marks uncertain runs **Status unknown** until reconciliation. It never repeats an external action only because an acknowledgment is missing.

### Evidence freshness

Evidence belongs to a workspace revision and plan version. A relevant code change marks earlier evidence stale. Piarre separates **Run finished**, **Checks passed**, **Needs review**, and **Accepted**.

## 15. Privacy and accessibility

### Privacy

- Keep microphone state persistent and obvious.
- Capture audio only during an explicit session.
- Store raw audio only with explicit opt-in.
- Keep secrets out of transcripts, exports, and evidence.
- Separate local project history, provider retention, and optional telemetry.
- Explain that local deletion does not delete provider-held data.
- Provide export, retention, redaction, and verified local deletion.

### Accessibility

- Support keyboard navigation for every action.
- Provide visible transcripts and captions for Piarre speech.
- Expose task and run state to screen readers.
- Do not encode status through color alone.
- Support adjustable speech rate, speech output, and reduced motion.
- Let the user review and correct a transcript before a consequential action.
- Preserve a complete typed workflow for users who cannot or do not want to speak.

## 16. Success metrics

### Primary outcome

Measure accepted, verified tasks per hour of active developer supervision. Compare Piarre with the same developer's current agent workflow.

Also compare perceived mental workload, time spent reading updates and assembling review evidence, and avoidable interruptions per accepted task. Use comparable tasks and record review accuracy, missed material failures, and defects after acceptance alongside attention measures. A quieter interface that causes missed decisions or worse review does not meet the AI-fatigue objective. Establish a baseline before setting reduction targets.

### Supporting measures

- time spent supervising each accepted task.
- task completion and acceptance rate.
- correction time after a requirement change.
- number and duration of blocking approvals.
- stale-result rejection rate.
- restart and provider-failure recovery accuracy.
- manual-edit conflict detection.
- cost per accepted task.
- command-routing accuracy.
- speech-end to visible acknowledgment latency.
- speech-end to first audible response latency.
- interruption-to-silence latency.
- voice usage compared with typed-command usage.

Voice and typed interaction require separate measurement. A faster voice acknowledgment does not prove that the full task workflow is faster.

### Release safety gates

- Zero unauthorized destructive operations in the release suite.
- Zero silent losses of manual edits.
- Zero accepted tasks that rely only on evidence from a superseded revision.
- Every supported stop control has observed reconciliation behavior.
- Every advertised provider capability has a passing adapter test.

Numeric targets remain proposals until baseline sessions establish realistic distributions.

## 17. Staged delivery

| Stage | Product claim | Exit condition |
|---|---|---|
| Foundation | Piarre has an honest durable control loop. | A typed command can propose, approve, run, verify, review, and recover one bounded task. |
| P0 supervised worker | One developer can direct and verify one coding worker through a durable project model. | The website workflow completes repeatedly with plan approval, evidence, steering, review, restart recovery, and no unauthorized operation. |
| P1 supervised team | One developer can supervise isolated workers without losing unrelated work or current evidence. | A read-only worker and two isolated coding workers pass scheduling, conflict, integration, cancellation, budget, and evidence tests. |
| Later product | Piarre supports broader providers, workflows, and collaboration. | Each expansion has its own capability, privacy, safety, and usability gates. |

The retired A00 spike supplied bounded historical observations only. It did not prove speech recognition, local orchestration quality, provider behavior, or multi-agent execution. Current claims must pass the B-series release gates.

## 18. Non-goals for P0

- autonomous production deployment.
- shared cloud workspaces.
- multi-user collaboration.
- continuous background listening.
- a native wake phrase.
- a standalone IDE fork.
- arbitrary simultaneous writers.
- a generalized project knowledge graph.
- workflow authoring.
- guaranteed offline operation.
- replacement of human code review.
- voice-driven character-level code editing.

## 19. Principal risks

| Risk | Product response |
|---|---|
| Voice resolves the wrong target. | Prefer the visible selection, show consequential proposals, and clarify ambiguity. |
| The UI shows false confidence. | Derive status from persisted events and reconciliation. Label unknown and stale state. |
| A provider lacks a claimed control. | Capability-detect controls and remove unsupported actions from the UI. |
| Approval prompts overwhelm the user. | Bind approvals to clear scopes and interrupt only when authority must expand. |
| Cost reporting is incomplete. | Separate measured usage from estimates and avoid unsupported hard-cap claims. |
| Evidence becomes stale. | Bind evidence to revisions and invalidate it after relevant changes. |
| Parallel workers overwrite changes. | Keep one P0 writer. Isolate P1 writers and integrate through review. |
| A small local model selects unsafe actions. | Treat output as a proposal and validate it through deterministic policy. |
| Voice is unusable in the user's environment. | Keep push-to-talk, typed commands, keyboard controls, and visual status equivalent. |
| Piarre becomes another chat panel. | Keep **Work** as the default view and treat conversation as supporting context. |

## 20. Open product decisions

The following decisions need prototypes or measured trials:

- Whether the VS Code extension remains the long-term product or validates a separate desktop IDE.
- Whether a dependency-aware list is enough or a node graph improves supervision.
- Which operations qualify for standing approval.
- Which provider supplies the first coding worker and which controls it can enforce.
- Which providers support enforceable budgets rather than estimates.
- Whether task acceptance always requires a developer.
- Whether concurrent implementation beats sequential implementation plus independent verification for the first P1 workflow.
- Which local-model size meets command accuracy and latency requirements on supported hardware.
- Which languages and accents the first local voice path supports.
- Which recurring workflow should follow **Build and verify a local website**.

## 21. Delivery note

The v0.2 backlog contains 23 B-series stories. Its arithmetic planning totals are 184 focused hours for P0 and 84 focused hours for P1. These are estimates, not measured throughput or delivery promises. Re-estimate after the recovery, supervised-writer, and supervised-team gates produce current evidence.
