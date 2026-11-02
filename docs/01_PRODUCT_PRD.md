# Piarre product requirements

Status: Product direction. Features below are requirements, not claims that they are implemented. GitHub issues and release evidence determine delivery status.

## Purpose and audience

Piarre is a conversational project partner inside VS Code. It helps users think through ideas, organize work, direct coding agents, and verify results. Project context survives individual conversations.

The first user is a developer who already uses coding agents. The first intended use is improving Piarre itself, with a separate development instance testing candidate changes against another project. Explanations should also be understandable to less technical users. Consequential code changes still require qualified review.

The business problem is AI fatigue. Users spend too much effort repeating context, reading long updates, coordinating agents, and checking unsupported claims. Piarre must reduce that burden while preserving control and review accuracy. Voice alone is not the differentiation.

Users should be able to ask where they left off and receive brief accomplishments, upcoming work, and unresolved decisions with inspectable sources.

## Product principles

- Understand the user's business and current goal before recommending technical work. Consult recorded intent instead of asking the user to repeat it.
- Answer the question asked. Give the useful answer first and detail only when needed. Natural dialogue must not become a lecture, questionnaire, or list of unrelated technical ideas.
- Adapt wording and explanation depth to the user's expertise and feedback. Recognize confusion and simplify rather than repeating the same explanation at greater length.
- Keep it simple. Every control, agent, abstraction, and notification must justify its cost to the user.
- Make memory, assumptions, recommendations, and actions inspectable and correctable.
- Models propose. Application code enforces authority and state. A convincing explanation is not verification.
- Preserve manual work. Make failures and recovery limits visible.
- Give factual updates at meaningful milestones, blockers, and transitions even when the user is silent. Keep routine logs available without narrating every command or interrupting unfinished thought.
- Apply relevant Poteto and pstack practices, including independent review and root-cause analysis, when they help. Do not load every skill or invoke a council for every request.
- Deliver one coherent candidate for concentrated human feedback. Keep internal implementation and automated verification incremental.

## Conversation and project inspection

Typed conversation is the familiar initial experience. Voice input and spoken output are later optional capabilities with independent controls. Typed and direct controls remain usable throughout.

The selected UI direction is [Design B, Session brief](https://www.figma.com/design/I7CeHDqFJEvoEdmslfKrNp?node-id=7-2). A compact brief shows accomplishments or saved work, the next decision, and unresolved questions above conversation on the left and contextual project inspection on the right. Supporting details open on demand. Narrow panes stack these regions in reading order. The implementation follows VS Code theme and font settings rather than the prototype’s fixed palette.

Tasks, plans, memory, artifacts, decisions, activity, and council work share canonical records. The brief and inspector reflect the same current state. Preserve unsent input and keyboard focus during external updates. Available controls must reflect implemented capabilities: a planning-only slice shows saved unapproved proposals without simulated conversation, approval, completion, or verification. Further state and question-format prototypes refine this direction without adding a permanent pane for every record type.

Piarre can open supporting artifacts to explain an idea without repeatedly stealing focus. Discussing an action, proposing it, and applying it must look different.

Users can think aloud, hesitate, revise an idea, or introduce a side topic. Piarre preserves context and responds briefly. The natural, unforced voice conversation in which this design was discussed is a qualitative interaction reference, not proof of product capability.

Question formats need testing: one question at a time, suggested options with a custom response, or related questions answered together. Piarre investigates observable facts itself and asks about consequential intent or preferences with a recommendation. Silence alone must not be treated as proof that a speaker has finished.

Direct task, memory, approval, and stop controls bypass model interpretation. Whether an additional typed command interface is useful remains open.

## Memory and the Basis view

Project memory contains business knowledge, technical decisions, requirements, preferences, observations, and unresolved assumptions. Users can inspect sources, confirmation state, changes, and affected work.

Important recommendations offer a Basis view showing supporting records, assumptions, alternatives, contradictions, and proposed versus completed actions. This is an explanation backed by evidence, not access to hidden model reasoning.

The user wants automatic observation capture and approval of memory changes. The proposed boundary is automatic capture as unconfirmed observations, with approval before replacing confirmed knowledge, promoting inferences to requirements, or resolving contradictions. This policy still needs explicit resolution before dependent behavior ships.

Corrections must update durable records and identify affected plans or evidence. Missing, invalid, disputed, and stale knowledge remain distinct. Repeated behavior alone does not establish a permanent preference. Fast lookup is required; a particular index structure is not a product requirement.

## Work and user authority

Piarre turns broad intent into reviewable goals, requirements, plans, dependencies, tasks, and acceptance checks. AI triage can recommend priorities and defer work with visible, reversible changes. Triage does not authorize execution.

Piarre may challenge requested features and recommend deleting unnecessary scope. Humans approve changes to product direction. Routine steps can proceed inside an approved scope without asking for every subtask.

Paid operations and potentially damaging actions require applicable approval and transparency, including cost uncertainty, data sharing, failure consequences, and a recovery plan. Approval granularity remains open; no blanket spending permission is inferred. Unsupported hard cost caps must not be promised.

One coding writer is the initial boundary. Results need current checks and user review. Checkpoints let users preview and restore supported earlier state while preserving newer work. Restoration does not imply reversal of external services or provider charges.

## Parallel ideas, council, and preparation

A new idea can become a linked thread with a parent, scoped context, and return point. Capturing an idea does not automatically schedule paid work. Findings cannot silently alter the original plan.

A bounded council supports independent read-only investigation or review. Users can inspect purpose, provider, state, available actions and traces, findings, disagreements, and costs. Agreement among agents does not prove correctness. Multiple writers require separate isolation and integration evidence.

Piarre can prepare disposable drafts or retrieve context while explicitly streamed input develops. Changed intent cancels or supersedes preparation. Guessed intent cannot authorize spending, confirmed-memory changes, workspace edits, or external actions. Unsent keystroke monitoring is not implied.

## Reflection and adaptation

Offer a brief optional reflection at session close, based on observed successes, friction, and user feedback. Users can decline and close immediately. Reflection proposes improvements rather than silently changing memory, policy, prompts, or code.

Optional onboarding can ask about work, experience, and explanation preferences. Users can skip it and correct the profile later. Adaptation must not hide material risks or assume that the user's needs never change.

Self-optimization toward smaller models is a future capability requiring measured quality comparisons, approval, versioned evaluations, and rollback.

## Models and business constraints

Prefer a local conversational system to limit recurring provider costs. Keep conversation, speech processing, and coding workers separate. Stronger-model consultation is allowed under the relevant spending and data-sharing approval.

The 6–8 GB voice-system target is an unmeasured goal, not a guaranteed application footprint. Higher memory use or hosted conversation can establish a quality baseline before optimization. Users still need resources for their development tools.

Cost estimates follow the user's actual billing route. API-token usage shows estimated dollar charges. Claude Code or Codex subscription usage shows estimated token use and five-hour or weekly allowance consumption where applicable. Use observed calibration or provider estimates for percentages; tokens alone do not establish subscription quotas. Show unknown estimates explicitly, separate current usage from predicted task consumption, and disclose extra-usage charges.

Connected coding accounts may supply workers through supported integrations. They are not automatically free, unlimited, or permitted for arbitrary credential reuse. Provider eligibility and prices need current verification. The revenue model and realistic per-session costs remain unresolved.

Use research papers and engineering practice to select experiments, then test actual recall, dialogue, latency, resource use, and failure behavior. No particular model is selected here.

## Testing experience and success

Daily work uses a stable release. Candidate testing uses a separate environment with independent state. CI packaging alone does not authorize production promotion.

User tests can link optional voice and screen recordings with logs, transcripts, relevant revisions, checks, and annotations. Capture, retention, export, and remote analysis are separate choices. Recordings show the experience; synchronized diagnostics help explain failures.

The first integrated candidate should demonstrate resumption, broad discussion, Basis, corrected memory, triage, approved execution, linked ideas, bounded council, checkpoint recovery, result review, and optional reflection. Voice and local-model tuning may follow. Multiwriter execution, an IDE fork, shared cloud collaboration, autonomous deployment, and background listening are outside the initial scope.

Compare supervision time, reading burden, repeated context, interruptions, corrections, missed defects, and accepted results with the user's existing workflow. A first feedback round establishes improvement targets rather than proof of productivity. Rough edges may become follow-up work; unauthorized actions, silent data loss, and false verification block release.
