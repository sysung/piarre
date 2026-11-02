# Piarre consolidated product design

Status: Design synthesis and feature proposal, 2026-11-01.

This document combines the current design package with the product discussion on 2026-11-01. It records intended behavior, not implemented capabilities. It is the consolidated reference for the revised product direction. Existing technical contracts and safety invariants remain applicable unless this document explicitly identifies a proposed change.

The product name is Piarre. Spoken references to Pierre in the discussion refer to the same product.

## 1. Product purpose

Piarre is a conversational project partner that helps people think, organize, direct, and verify agent work. It maintains inspectable context for each project or repository across sessions. It explains important problems and action items in concise language, with exact plans, tasks, memory, artifacts, and evidence available for inspection.

The core problem is AI fatigue. Users spend attention reading long answers, reconstructing context, coordinating conversations, correcting forgotten decisions, and checking unsupported claims. Piarre aims to reduce that effort without hiding failures or weakening user control.

A typical conversation starts broadly. The user describes an idea or concern without first translating it into engineering tasks. Piarre retrieves relevant project context, checks its interpretation, identifies caveats, recommends an approach, and turns approved intent into visible work.

The product must understand where the project left off. A user should not need to repeat yesterday's decisions because the conversation ended. The user must also be able to inspect what Piarre remembers, what information influenced an answer, and how to correct that information.

These are product hypotheses to validate. Neither a quieter interface nor fewer messages establishes reduced fatigue by itself.

## 2. Decisions from this discussion

| Area | Current direction | Remaining qualification |
|---|---|---|
| Primary interaction | A conversational orchestrator, with concise explanations and recommendations. | Exact layout needs user testing. |
| Delivery | Build a coherent product for integrated human evaluation. | Keep internal implementation units and automated checks. |
| Initial input | Typing is the familiar default. | Voice can ship later as an optional toggle. |
| Initial output | Classic text responses, with detail available on demand. | Spoken output is optional and independently mutable. |
| Project context | Durable, inspectable, correctable memory per repository or project. | Approval rules for additions and changes need precision. |
| Trust | Expose sources, assumptions, actions, evidence, and uncertainty. | Explanations alone do not establish correctness. |
| Local inference | Prefer a local conversational system separate from coding workers. | Quality and responsiveness take precedence over an unproven memory target. |
| Memory budget | Aim for 6–8 GB for the voice system. | This is a goal, not a measured limit or whole-application budget. |
| Escalation | Consult a stronger model when needed. | Respect cost approval and data-sharing policy. |
| Product changes | Piarre may challenge requests and recommend deletion. | Humans approve product direction changes. |
| Parallel reasoning | Council reviews, swarms, and inspectable subagents are important capabilities. | First-release scope and concurrency limits remain open. |
| Parallel conversation | Support related or nested threads without losing the original context. | This does not authorize concurrent writers. |
| Reflection | Offer an optional brief reflection before a normal session closes. | Closing must remain possible without reflection. |
| Testing | Separate stable daily use from development testing. | Recordings and diagnostic capture require explicit controls. |
| Audience | Start with developers and make explanations understandable to less technical users. | This does not remove the need for qualified review of consequential code changes. |

The final discussion supersedes the earlier statement that voice must be in the first PoC. Voice remains a product goal, but typing first is now an acceptable delivery direction.

## 3. Design principles

### 3.1 Protect attention

Routine execution detail stays in the background. Piarre gives concise proactive updates at meaningful milestones, blockers, completed work, and transitions to the next activity, even when the user is silent. Consequential decisions, material failures, scope changes, and results ready for review remain visible. Related non-urgent updates are grouped. Outstanding decisions stay visible without repeated unchanged notifications.

A broad response communicates the main point, important caveats, and action items. It retains precise detail in inspectable records. Broad does not mean vague or unsupported.

### 3.2 Make the project durable

Goals, requirements, decisions, tasks, approvals, and evidence outlive conversations. Session summaries help navigation but do not replace canonical project records. Restart recovery restores durable state and reconciles uncertain external activity.

### 3.3 Make understanding inspectable

Users can inspect what Piarre believes, where that information came from, which assumptions remain unconfirmed, and which actions it actually performed. A correction changes the durable record and identifies affected work.

Piarre provides explanations and available execution traces. It must not present a generated explanation as a literal view of hidden model reasoning.

### 3.4 Let models recommend and code enforce

Prompts and skills guide behavior. Deterministic application code owns authorization, revisions, task transitions, scheduling boundaries, budgets, and evidence freshness. Model output is an untrusted proposal.

Repository content, transcripts, worker messages, and tool output cannot grant permissions or override application policy.

### 3.5 Preserve human product authority

Piarre challenges weak ideas, identifies unnecessary scope, and can recommend deleting features. It gives a reason and consequence. It does not silently turn a recommendation into an approved product change.

Approval need not occur for every internal step. Approved work proceeds within its scope. New spending, damaging actions, and material changes require the relevant approval.

### 3.6 Design for users before implementation convenience

Familiar controls, clear language, predictable behavior, and recoverable mistakes matter more than exposing the internal agent architecture. Progressive disclosure keeps technical detail available without forcing everyone to read it.

The Apple comparison expresses a preference for coherent, user-oriented design. It does not establish a specific visual style.

### 3.7 Adapt without silently redefining the user

Piarre adapts explanations and questions to the user's work, expertise, preferences, and current phase. Users can inspect and change that profile. Inferences about expertise remain tentative and must not suppress material risks.

### 3.8 Verify results independently

A worker saying that a task succeeded is not verification. Checks, diffs, previews, and artifacts belong to specific revisions. Relevant changes make earlier evidence stale.

### 3.9 Optimize only against observed quality

Smaller models, shorter prompts, retrieval changes, and fewer agent calls are useful only when they preserve the required results. Reduced resource use must not conceal worse recall, weaker recommendations, or missed defects.

### 3.10 Keep it simple

KISS, expressed by the user as "keep it stupid simple," is an explicit product and engineering principle. Favor familiar interactions, few necessary controls, direct explanations, and the smallest implementation that satisfies the actual need. Complexity must earn its place through user value or a required correctness boundary.

Piarre should draw on applicable pstack and Poteto principles rather than loading every skill into every prompt. The exact principle inventory and source versions need to be recorded before implementation. Each adopted principle needs an observable product behavior, engineering constraint, or evaluation case. Principles must resolve conflicts explicitly and cannot override user authority or application policy.

Relevant examples include investigating root causes, modeling domain state, separating concurrent writers, keeping operations idempotent, validating boundaries, proving actual results, and using small verifiable implementation units. Independent reviews and multiple prototypes are used when justified, not as mandatory ceremony for every exchange.

## 4. User experience and information architecture

### 4.1 Conversation and inspection

The proposed layout places the main conversational interaction on the left and inspectable project information on the right. The inspection area includes tasks, memory, plans, artifacts, review evidence, decisions, activity, and a council view.

These are logical views. They need not all be permanent panes or visible simultaneously. Exact VS Code placement, sizing, navigation, and responsiveness need prototypes.

Piarre can open an artifact to explain a recommendation. The user can inspect a diagram, plan, diff, preview, or other supporting artifact without reconstructing the conversation. Automatic navigation must not repeatedly steal focus while the user works.

Conversation and inspection refer to the same durable objects. Discussing a priority, proposing a priority change, and applying that change are visibly distinct.

### 4.2 Typed and direct interaction

Typing is the initial default. Users can edit a message before submission. Classic text responses remain available when speech is disabled.

The user also requested an ability to type and bypass the AI agent. Two meanings remain possible: typed conversation that bypasses speech processing, or direct deterministic controls that bypass model interpretation. The design preserves both needs through typed conversation and direct task, memory, approval, and stop controls. Whether an additional command interface is needed remains open.

### 4.3 Voice controls

Voice is an optional input toggle. Speech output has a separate mute control. Enabling microphone input does not require audible replies.

The existing distinctions remain mandatory:

- Mute microphone stops capture.
- Stop speaking interrupts Piarre's audio output.
- Stop task requests interruption of a worker and reconciles partial changes.
- Stop all work prevents new scheduling and reconciles active runs.

Push to talk and explicit session start remain available. No background microphone or wake phrase is required for the first product.

### 4.4 Question design experiments

The following interaction designs need comparison:

- Ask one question and accept a spoken or typed answer.
- Show suggested options, a recommendation, and a custom answer path.
- Present related questions together and let the user answer in a continuous response.
- Capture partial answers, show unresolved items, and allow the user to return to them.

Piarre should investigate facts it can observe before asking the user. Questions concern intent, preference, authority, or consequential uncertainty. Recommendations include their supporting basis.

Tests must examine correction effort, interruptions, missed answers, decision quality, and the user's ability to change their mind. No one question format is approved as universally best.

### 4.5 Conversational reference from this session

The user identified the live voice discussion on 2026-11-01 as inspiration for Piarre. They described it as easy to talk to and unforced. This is qualitative feedback about this conversation, not evidence that Piarre already achieves the same experience.

The intended experience lets users think aloud, hesitate, revise ideas, and add context without first structuring a prompt. Piarre responds naturally and briefly, preserves the evolving project context, and avoids turning every exchange into a questionnaire or a long explanation. Detailed records remain available visually.

Future interaction tests should ask whether the conversation feels similarly natural and whether users can finish their thoughts, correct an interpretation, and continue without unnecessary ceremony. Natural delivery must still distinguish a captured idea, a proposal, and an approved action.

### 4.6 Thoughtful pauses and turn-taking

Voice must distinguish a pause for thought from the end of a turn as well as practical constraints allow. Silence alone does not establish that the user has finished.

Candidate controls include explicit completion, push to talk, adjustable endpoint timing, and visible transcript continuation. These are experiments, not guaranteed intent detection.

Piarre must allow interruption and correction without losing the user's unfinished idea. Evaluation includes hesitation, self-correction, long pauses, background speech, and multiple ideas in one utterance.

### 4.7 Onboarding and calibration

Optional onboarding can ask what work the user does, their experience, preferred explanation depth, and interaction preferences. It should produce a useful first result without a long questionnaire.

Users can skip setup and change preferences later. Adaptation must distinguish a preference from an assumption. Less technical explanations still include consequential caveats and approval consequences.

### 4.8 Consistent documentation and artifact lifecycle

Piarre needs a consistent convention for temporary work artifacts and lasting project documentation. The user proposed `.artifacts` for work-specific materials such as implementation plans, diagrams, and other generated artifacts. The exact directory structure remains a design choice.

A plan can be useful for one execution while its purpose, intended outcome, decisions, and observed result remain useful for the life of the project. Piarre should preserve those lasting conclusions in `docs` or the appropriate canonical project record, with links back to the originating artifacts.

Some information can appear in both places to preserve context. This duplication must have a clear authority and lifecycle. A work artifact records what was proposed or observed at a particular revision. Lasting documentation records the current understanding and links to its historical basis. Neither copy silently overrides the other.

A proposed documentation contract includes:

- A consistent structure for an artifact's goal, scope, status, relevant revisions, and resulting evidence.
- Stable links between temporary plans and the lasting requirements, decisions, or explanations they support.
- A completion or reflection step that proposes which conclusions belong in lasting documentation.
- Documentation updates that distinguish planned outcomes from observed outcomes, including failed or abandoned plans.
- Explicit supersession and stale-content indicators when later work changes the recorded understanding.
- Human review under the applicable memory and documentation approval policy before confirmed knowledge changes.

The goal is to preserve why the work mattered without requiring users to read every old implementation plan. Piarre must not automatically copy entire plans into lasting documentation or treat a proposed plan as proof of the result.

### 4.9 Provisional preparation while the user thinks aloud

The user wants Piarre to begin useful preparation while an idea is still being expressed. If the intent remains consistent, a draft or investigation can be ready near the end of the turn. If the user changes direction, Piarre discards or revises the provisional work.

Preparation uses explicitly submitted text or an enabled stream such as a live transcript. Unsent keystroke monitoring is not implied. Provisional work is clearly distinct from canonical plans, approved memory, and authorized execution.

Safe preparation can include read-only context lookup and disposable drafts within existing privacy and cost permissions. Guessed intent cannot authorize paid calls, durable project changes, external messages, or damaging actions. Work that already caused an external effect cannot honestly be described as erased by discarding a draft.

Each draft or preparatory request belongs to an input revision. Revised intent cancels or supersedes old preparation. Late results cannot re-enter the current plan without revalidation. Tests must cover direction changes, cancellation, delayed results, wasted resource use, and the benefit to useful response latency.

### 4.10 Proactive progress without a new user prompt

Piarre provides brief factual updates while authorized work proceeds, including when the user is not speaking. Updates explain what just completed, its observed result, and the next meaningful activity when useful.

Completion statements must be backed by observed state. In-progress work, requested stops, and unknown results receive accurate labels. Piarre must not invent progress to fill silence.

The default favors milestone updates rather than every command. Repeated unchanged state and routine logs remain inspectable in Activity. Users can adjust update detail and spoken status, and focus mode can reduce nonessential speech. Progress updates must not interrupt an unfinished user turn.

## 5. Tasks, plans, and conversational triage

Piarre translates broad intent into goals, requirements, plans, dependencies, tasks, and acceptance checks. Users can inspect and edit those records directly.

AI triage can recommend priority, group related items, expose blockers, and identify deferred work. Applied triage changes have visible reasons and are reversible. Ordering an agenda does not approve execution or mark work accepted.

The existing B23 distinction remains useful. Canonical task priority differs from agenda disposition such as untriaged, cover now, or deferred. Filters keep deferred items discoverable.

Task and run state remain separate. A run can finish while the task still needs verification or review. Existing states include Proposed, Ready, Running, Blocked, Needs approval, Needs verification, Needs review, Accepted, and Cancelled.

The desired review unit is a meaningful outcome with a consolidated evidence package. Exact task-level acceptance rules need revision before implementation. Removing fragmented human walkthroughs does not remove internal checks.

## 6. Project memory and the Basis view

### 6.1 Memory contents

Project memory includes business knowledge, technical decisions, confirmed requirements, user preferences, unresolved assumptions, and relevant session outcomes. Execution authority, approvals, task state, and verification evidence remain application-owned records.

Each knowledge entry needs an identifier, content, source, confirmation state, revision history, and relationships to affected work. Useful states include observed, inferred, confirmed, disputed, superseded, and invalid.

Human-readable files and application-managed records are compatible presentation options. The final storage arrangement, including any `.piarre` knowledge and decision files, must preserve one clear authority for each kind of data.

### 6.2 Approval boundary

The user expressed two requirements that need an explicit distinction:

- Memory changes should require approval, especially contradictions and corrections to established knowledge.
- Additions based on observations and repeated interactions should usually happen automatically.

The proposed reconciliation is automatic capture of sourced observations as unconfirmed entries. Promoting an inference to an authoritative requirement, replacing confirmed knowledge, or resolving a contradiction requires user approval. This is a proposal, not a settled interpretation of all memory changes.

Repeated behavior alone does not prove a permanent preference. Piarre records uncertainty and lets the user reject or correct inferred preferences.

### 6.3 Contradictions and corrections

Piarre raises relevant contradictions with the conflicting sources and a recommended resolution. It does not silently overwrite confirmed knowledge. Superseded entries remain traceable.

A correction identifies affected plans, recommendations, tasks, and evidence. Relevant work becomes stale or requires review. Unrelated work remains intact.

Absent, invalid, disputed, and stale memory are explicit conditions. Retrieval failure must not look like proof that no prior decision exists.

### 6.4 Fast lookup

The user wants glossary-like lookup and mentioned B-tree-style access. Fast exact lookup and meaningful retrieval are requirements. A B-tree is a candidate implementation detail, not a complete solution to semantic recall or contradiction detection.

The design needs a bounded set of relevant records for each request, source links, and observable retrieval behavior. It must test retrieval latency and answer quality as project history grows.

### 6.5 Basis view

Important answers and recommendations offer an inspectable Basis view containing:

- The facts, requirements, preferences, and decisions used.
- Links to their sources and relevant revisions.
- Assumptions, uncertainty, and known contradictions.
- Alternatives considered and the stated reason for the recommendation.
- Proposed actions versus actions already applied.
- Correction controls and affected-work information.

The Basis view is an explanation backed by records. It is not a guarantee that the model used every source correctly or an exposure of hidden chain-of-thought.

### 6.6 Returning to a project

When asked where the project left off, Piarre briefly presents the main accomplishments from the previous session or requested day, upcoming work, and unresolved decisions. Sources remain available for inspection.

It also distinguishes recorded status from changes detected since that session. The user can correct the recap without repeating the whole project history.

## 7. Sessions, nested ideas, and parallel work

A user may introduce another idea while discussing or executing the current goal. Piarre can capture a related thread for investigation without discarding the current focus.

A nested or linked session records its parent, goal, relevant context, tasks, decisions, and return point. The user can switch between threads and see what continues in the background. A new thought can be captured without automatically starting expensive work.

Results return as proposed findings or changes. They do not silently modify the parent plan or confirmed memory. Conflicting conclusions remain visible until resolved.

Parallel conversations, read-only analysis, and simultaneous code writers are different capabilities. Existing one-writer protection remains until isolation and integration tests justify expansion. No two coding workers share a write root.

## 8. Council, swarms, and subagent visibility

Piarre should support independent reviews and parallel investigations when the task justifies them. Skills such as pstack and grillme inspire the behavior, but their names do not substitute for defined contracts.

The council view shows each agent's purpose, provider or model, state, assigned scope, parent task, available controls, and cost information. Users can open available messages, tool actions, artifacts, findings, and evidence.

The requested view into an agent's thought process is implemented as inspectable explanations and available traces. Piarre must not fabricate private reasoning or claim that an explanation reveals all internal computation.

Council synthesis identifies agreement, disagreement, supporting evidence, and the lead recommendation. Multiple agreeing models do not establish correctness by themselves. The runtime still enforces authorization, and independent observations still verify results.

Fan-out needs bounds on spending, concurrency, and context sharing. A council is not automatically invoked for every exchange. Its first-release scope remains open despite its importance to the full product.

## 9. Reflection and controlled self-improvement

At the end of a normal session, Piarre offers a brief optional reflection inspired by pstack's reflect workflow. It summarizes what went well, what caused friction, what it could do better, and proposed changes for next time.

Reflection uses observed events and user feedback. It separates successful outcomes from plausible self-assessment. The user can correct the assessment or decline reflection and close immediately.

A reflection can propose memory updates, preference changes, prompt or skill revisions, evaluation cases, and product tasks. Proposed changes follow their respective approval rules. Reflection does not silently rewrite operating policy or ship code.

Crashes and forced closure require durable capture and later recovery, rather than a promise to run a closing dialogue.

Piarre may eventually optimize model selection and prompts to achieve comparable results with smaller models. This requires versioned evaluations, quality comparisons, resource measurements, approved trials, and rollback. It must not judge its own improvement only from its own statements.

## 10. Models, local execution, and costs

### 10.1 Separate responsibilities

The conversational system handles dialogue, context retrieval, clarification, recommendations, and orchestration proposals. Coding workers implement bounded tasks through provider adapters. Speech recognition and speech synthesis are separate components even when packaged together.

Users may connect supported coding services. Local conversation does not make remote coding private or free. Provider terms, account eligibility, quotas, and supported authentication must be verified before promising an integration.

### 10.2 Local-first resource goal

The user prefers local conversation to reduce recurring provider expense and preserve product margins. The proposed 6–8 GB goal covers the voice system rather than the entire development environment. The exact components included in that measurement still need agreement.

Memory accounting must separately report model weights, context cache, speech recognition, speech synthesis, retrieval, and runtime overhead. Users also need resources for editors, browsers, local websites, and other workloads.

The project may begin above the target or use hosted conversation if local quality is insufficient. Neither route is selected yet. The plan is to establish quality first and work resource use downward without losing required behavior.

### 10.3 Stronger-model escalation

Piarre can recommend consulting a stronger model when local capability is inadequate. It explains the reason, data to be sent, expected cost or uncertainty, and what the response will be used for. Existing privacy and spending approval rules apply.

A connected account is not blanket permission to send all project context. Failure or refusal of escalation leaves an honest limitation visible.

### 10.4 Research and evaluation

Model and memory decisions should draw on relevant research papers and measured engineering practice. Candidate work includes retrieval, context selection, memory correction, model routing, structured tool use, quantization, and turn-taking.

No model or paper is selected by this document. Papers are leads for reproducible experiments, not proof of product suitability. Record sources, hardware, model versions, context sizes, quality failures, latency, and peak memory.

Large collections of prompts must be evaluated for conflict, context cost, and usefulness on the selected model. Skills cannot replace capability tests or deterministic controls.

### 10.5 Spending and commercial uncertainty

The user wants explicit approval and transparency for spending, even small amounts. A proposal might say that an action is estimated to cost $0.50. That number is an illustrative example, not a measured estimate or price claim.

The approval display includes expected cost, the basis of the estimate, uncertainty, provider, authorized scope, and consequences of failure. Unknown cost must remain unknown. The application must not promise an enforceable hard cap without the required provider controls.

Whether approval is per call, per task, per council, or per bounded session budget remains unresolved. Repeated micro-approvals could conflict with the attention objective. No blanket spending authorization is inferred here.

A future cost study must use current provider pricing and realistic session measurements. It should distinguish conversation, audio, worker usage, council fan-out, recording analysis, and hosting. Subscription allowances, user-paid usage, and Piarre-paid usage must remain separate. This document does not answer monthly cost or establish a revenue model.

## 11. Authorization, failure consequences, and recovery

Before a damaging action or newly paid operation, Piarre explains what it will do, the affected scope, likely consequences of failure, and a recovery or backup plan. It states when restoration cannot be guaranteed.

Approvals bind to concrete actions, scope, relevant revisions, and duration. Material changes invalidate affected approvals. Safe internal steps may proceed under existing authorization.

Stop requests are distinguished from confirmed stopping. Cancellation preserves partial work for inspection and does not imply rollback. After a failure or restart, unknown external activity is reconciled before new execution.

Manual edits remain protected. An old worker result cannot satisfy a revised requirement. Export, retention, redaction, and verified local deletion remain required capabilities, with provider-held data treated separately.

### Checkpoints and explicit restoration

The user wants to restore an earlier checkpoint when an output is unsatisfactory. Checkpoints need visible scope, creation time, repository revision, included artifacts, and known exclusions. A checkpoint is not a promise to reverse every external effect.

Before restoring, Piarre shows the proposed diff and consequences, checks for newer manual or agent changes, stops or reconciles relevant active writers, and obtains approval for destructive replacement. It preserves the current state through an appropriate recoverable snapshot before a supported restore. It must not silently discard untracked files or unrelated work.

A restore records a new auditable operation rather than erasing history. It invalidates affected verification evidence and reconciles task and run status. Restoring repository files does not automatically revoke approvals, rewrite confirmed memory, or roll back external services, messages, deployments, or provider charges. Any linked-state changes need an explicit supported contract.

Tests must cover partial failure, cancellation, repeated restore requests, restart during restore, newer manual edits, untracked files, and stale evidence. Unsupported restoration scope is disclosed before the action.

## 12. Stable releases and development testing

The daily working environment runs a stable production release delivered through CI/CD. Development testing occurs in a separate environment with a candidate Piarre build, often against another project.

Using Piarre to improve Piarre is the first intended real use case. Stable Piarre coordinates changes to the Piarre repository. A separate development instance exercises the candidate. Updating the running stable instance is not the default test mechanism.

Release automation, environment separation, artifact provenance, test evidence, and rollback need explicit implementation. Their inclusion here does not authorize unattended production deployment.

The earlier local-website workflow remains a useful bounded regression and an external-project test case. It no longer defines the entire product promise.

## 13. Recorded user testing

The user plans to simulate user testing personally, then give recordings and logs to Piarre, Codex, or another analysis tool to identify next actions.

A test bundle should connect recordings with diagnostic evidence:

- Audio and screen recordings when separately enabled.
- Partial and final transcripts, including corrections.
- Timestamped user actions, model requests, tool activity, and failures.
- Task, plan, approval, and memory revisions.
- Application, model, prompt, skill, and runtime versions.
- Repository revisions, diffs, checks, and resulting artifacts.
- User annotations and the resulting issue or proposed improvement.

Capture controls must show what is recorded. Local capture, storage, export, and remote analysis are distinct choices. Redaction and retention apply to logs as well as recordings. Test evidence should avoid collecting credentials or unrelated private content.

Recordings explain the experience. Synchronized logs help locate the cause of a failure. Neither replaces checking the actual resulting workspace.

## 14. Architecture retained from v0.2

The first target remains a VS Code extension with an editor-neutral core. A VS Code-derived standalone IDE, similar in form to Cursor, is a later option. A fork is not required for this design revision.

The retained architecture includes:

- A ProjectController that owns proposal validation, state transitions, policy, scheduling, reconciliation, and evidence freshness.
- Runtime-owned event writes, with SQLite events and rebuildable projections.
- Revision checks on mutations and revision-bound acceptance.
- Workspace adapters for files, diffs, previews, and observed commands.
- Worker adapters for capability detection, start, observation, steering, interruption, and inspection.
- Interpreter and voice adapters that use the same proposal boundary as typed input.

Persist durable events before acknowledging state changes. Replay must not duplicate external effects. Unsupported controls stay hidden or clearly unavailable. A mock does not prove live provider behavior.

The product model retains Project, Goal, Requirement, Plan, Task, Worker, Run, Approval, Budget, Decision, Evidence, Workflow, and Session. The revised design adds explicit knowledge entries, linked conversational threads, reflection proposals, council records, and test bundles as concepts requiring detailed contracts.

## 15. Integrated delivery and backlog relationship

The user wants to stop evaluating unfinished pieces story by story. The proposed approach delivers a coherent product for a substantial review, while engineering work still proceeds through small verifiable units.

The existing backlog remains an input and implementation history. Its IDs do not prove completion. This document does not republish GitHub issues, change Project 8, or provide a new effort estimate.

| Existing stories | Capabilities retained in the revised design |
|---|---|
| B00, B01 | Extension setup, durable projects, and replay. |
| B02, B23 | Reviewable proposals, task lists, and reversible triage. |
| B03–B07 | Bounded execution, verification, review, stop, and recovery. |
| B08, B09 | Voice routing and separate speech and work interruption. Voice delivery can now follow the typed product. |
| B10–B13 | Requirement changes, manual-edit protection, authority, costs, and local data controls. |
| B14, B15 | Integrated workflow and supervised-writer release evidence. The workflow needs expansion beyond a website. |
| B16–B19 | Read-only concurrency, isolated writers, dependency scheduling, and reviewed integration. |
| B20–B22 | Local interpretation, independent verification, and supervised-team release evidence. Local conversation scope now exceeds command classification. |

New or expanded work includes the primary conversational experience, memory and Basis views, nested sessions, council visibility, reflection, user calibration, recorded tests, stable and development releases, and model-quality experiments.

The exact first-release cut is unresolved. Calling every desired capability a bare minimum would recreate an unbounded build. A coherent typed experience is now acceptable, but this discussion has not approved dropping council, nested sessions, or reflection from that release.

Existing B15 and isolation gates remain safety constraints until a reviewed replacement defines equivalent or stronger evidence. Human review consolidation is not permission to skip recovery, conflicts, or provider validation.

## 16. Proposed integrated acceptance journey

This journey combines the discussion into one reviewable demonstration. It is a proposed acceptance contract rather than a claim that the product works today.

1. Open stable Piarre in the Piarre repository.
2. Ask where the project left off. Inspect brief accomplishments, upcoming work, unresolved decisions, and sources.
3. Describe an improvement broadly through typed conversation.
4. Receive a recommendation, a consequential clarification when needed, and an inspectable Basis view.
5. Inspect the proposed plan, tasks, priority, memory effects, and acceptance checks.
6. Approve the required product direction, scope, spending, and damaging operations.
7. Observe authorized work while continuing to ask questions and inspect artifacts.
8. Introduce a second idea. Capture or investigate it in a linked thread and return to the original goal.
9. Inspect council work if invoked, including disagreements and supporting evidence.
10. Correct an assumption and observe the affected plan or evidence becoming stale.
11. Inspect an integrated result with current diffs, automated checks, unresolved uncertainty, and a separate candidate environment.
12. Record a test against another project when enabled. Link observed friction to diagnostic events and proposed follow-up work.
13. Accept or redirect the result and optionally reflect before closing.
14. Restart and verify that context, pending decisions, and uncertain runs recover honestly.

A later voice version repeats this journey with transcript correction, turn-taking, muting, interruption, and typed equivalence.

## 17. Evaluation and release evidence

The existing regression scenarios remain required where the capability is advertised. They cover speech interruption, task stop, stop all, ambiguous stopping, requirement changes, stale completion, manual edits, build failure, provider disconnect, restart, lost acknowledgment, and export and deletion.

Additional evaluation must cover:

- Recall with missing, stale, contradictory, and corrected memory.
- Whether the Basis view identifies actual supporting records and unsupported assumptions.
- Broad goals that require investigation versus human preference decisions.
- Question formats, long pauses, self-correction, and interruption burden.
- Nested-thread switching, conflicting findings, and context leakage.
- Council disagreement, failed agents, bounded fan-out, and misleading consensus.
- Reflection refusal, incorrect self-assessment, and proposed policy changes.
- Responsiveness while a worker runs, not only while idle.
- Cost estimation uncertainty, approval boundaries, and denied escalation.
- Separation of stable and candidate releases and recovery after a bad candidate.
- Comparison of smaller models against the quality baseline.

Compare Piarre with the user's existing workflow on comparable tasks. Measure active supervision time, reading effort, interruptions, corrections, missed failures, and accepted results. Keep defect detection and review accuracy alongside fatigue measures.

Report actual latency distributions, peak memory, model versions, hardware, context size, failures, and sample counts. Numeric performance targets remain open until a baseline exists. A short acknowledgment does not prove fast useful reasoning or a responsive stop control.

Evidence must be revision-bound and labeled passed, failed, blocked, unsupported, or not tested. Historical A00 observations cannot satisfy current release claims.

## 18. Risks and open decisions

| Risk or unresolved decision | Required next evidence or decision |
|---|---|
| The first release includes every imagined feature. | Agree a bounded integrated acceptance journey and explicit deferred scope. |
| Automatic memory additions conflict with approval of changes. | Approve rules for observation capture, confirmation, replacement, and contradiction resolution. |
| Every small cost requires an interruption. | Choose a transparent approval unit without assuming blanket authorization. |
| The local model fits memory but cannot provide useful dialogue. | Compare realistic project sessions and escalation behavior before choosing a model. |
| The memory target excludes substantial overhead. | Define measurement boundaries and minimum supported hardware. |
| Piarre interrupts thoughtful pauses. | Compare turn-taking designs with recorded sessions. |
| Questions become another form of fatigue. | Compare formats and measure correction and decision effort. |
| Council agreement creates false confidence. | Verify outputs against independent artifacts and retain disagreement. |
| Reflection reinforces incorrect lessons. | Require evidence, user correction, and approval for consequential changes. |
| Nested work loses the original objective. | Test explicit parent relationships, return points, and conflict handling. |
| User calibration becomes intrusive or inaccurate. | Make setup optional and preferences inspectable and reversible. |
| Simpler language hides technical consequences. | Test comprehension of approvals, failures, and uncertainty. |
| Subscription integrations are assumed to be free or permitted. | Verify each supported integration and disclose actual limits and charging. |
| Self-improvement breaks the daily environment. | Prove stable and development separation and candidate rollback. |
| Recording captures private material. | Separate capture and upload consent, redact, and verify retention controls. |

## 19. Sources and precedence

This synthesis uses the product conversation on 2026-11-01 and the following repository documents:

- [Product PRD](01_PRODUCT_PRD.md).
- [Technical design](02_TECHNICAL_DESIGN.md).
- [Implementation backlog](03_IMPLEMENTATION_BACKLOG.md).
- [Testing and evaluation plan](04_TEST_EVALUATION.md).
- [Historical architecture rationale](https://github.com/sysung/piarre/blob/edd1d0bcf97787f1232e38605172304aa3805b1c/docs/architecture/plan-v0.2-rationale.md).

For revised product intent, this document supersedes the earlier conversation-secondary layout, voice-first delivery requirement, website-only first outcome, and deferral of inspectable project knowledge. It preserves their relevant safety and verification constraints.

The [C first integrated release plan](06_C_FIRST_RELEASE_PLAN.md) now records the proposed implementation route and published work packages. It requires reconciliation of the live code baseline and retained release evidence before the revised build begins. No new effort estimate is established. The older PRD delivery totals and backlog totals differ, so neither is a current estimate for this expanded direction.

The discussion included preliminary provider-documentation checks. Provider access rules and prices are not contractual facts in this document and must be checked again during integration and cost planning.
