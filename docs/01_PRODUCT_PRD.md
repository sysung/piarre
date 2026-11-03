# Piarre product requirements

Status: Product direction. Features below are requirements, not claims that they are implemented. GitHub issues and release evidence determine delivery status.

## Purpose and audience

Piarre is a centralized AI orchestrator inside VS Code. Its primary experience makes agent work visible: who owns each task, what is happening, what is blocked, what evidence exists, and what needs the user’s decision. Project context survives individual agent sessions.

The first user is a developer who already uses coding agents. The first intended use is improving Piarre itself, with a separate development instance testing candidate changes against another project. Explanations should also be understandable to less technical users. Consequential code changes still require qualified review.

The business problem is AI fatigue. Users spend too much effort repeating context, reading long updates, coordinating agents, and checking unsupported claims. Piarre must reduce that burden while preserving control and review accuracy. Agent visibility, coordination, and trustworthy review are the priorities. Voice is deferred.

Opening Piarre should show where work stands without requiring a chat exchange: meaningful progress, upcoming work, unresolved decisions, and inspectable sources.

## Product principles

- Understand the user's business and current goal before recommending technical work. Consult recorded intent instead of asking the user to repeat it.
- Lead with visible agent and task state. Users should not need to ask for routine status or reconstruct ownership from transcripts.
- Answer the question asked. Give the useful answer first and detail only when needed. Supporting discussion must stay concise and relevant to the current task or decision.
- Adapt wording and explanation depth to the user's expertise and feedback. Recognize confusion and simplify rather than repeating the same explanation at greater length.
- Keep it simple. Every control, agent, abstraction, and notification must justify its cost to the user.
- Make memory, assumptions, recommendations, and actions inspectable and correctable.
- Models propose. Application code enforces authority and state. A convincing explanation is not verification.
- Preserve manual work. Make failures and recovery limits visible.
- Give factual updates at meaningful milestones, blockers, and transitions even when the user is silent. Keep routine logs available without narrating every command or interrupting unfinished thought.
- Apply relevant Poteto and pstack practices, including independent review and root-cause analysis, when they help. Do not load every skill or invoke a council for every request.
- Deliver one coherent candidate for concentrated human feedback. Keep internal implementation and automated verification incremental.

## Agent visibility and project inspection

The primary surface is an agent and work overview with direct controls. For each managed or explicitly attached agent, show its identity and role, provider or session, assigned task and scope, latest observed activity, progress or blocker, pending decision, and available controls. Link outputs, checks, and results to the responsible assignment and relevant revisions. Group parallel work under its parent objective so ownership remains understandable.

Separate agent connection or session state from task, run, verification, and acceptance state. Show last observation and uncertainty when a session disconnects or cannot be inspected. Coverage must be explicit: Piarre cannot imply that it observes unsupported or unattached sessions in another application. Available controls reflect observed adapter capabilities.

Keep the selected [Design B, Session brief](https://www.figma.com/design/I7CeHDqFJEvoEdmslfKrNp?node-id=7-2) structure: a compact project brief above the work area and contextual inspection. The current direction replaces conversation as the primary region with agent activity, task ownership, and the next decisions. Supporting details open on demand. Narrow panes stack these regions in reading order. Use VS Code theme and font settings rather than the prototype’s fixed palette. The historical Figma conversation-first arrangement is not the current priority.

Tasks, plans, memory, artifacts, decisions, activity, and council work share canonical records. The brief, agent overview, and inspector reflect the same current state. Keep stop and scheduling controls accessible while inspecting supporting records. Preserve keyboard focus and any unsent input during updates. A planning-only or disconnected view must remain honest about unavailable agents, execution, and evidence.

Typed instructions and focused discussion are supporting tools. Users can create or revise work, clarify consequential intent, and inspect a proposed interpretation without making extended conversation the main workflow. Direct task, memory, approval, and stop controls bypass model interpretation. Broad dialogue quality, think-aloud interaction, and voice are not prerequisites for the agent-visibility candidate.

Voice input, speech output, background listening, and voice-specific interaction tuning are deferred. No microphone controls, speech services, or voice memory targets are required for this release. Existing typed discussion may remain available without dominating the workspace.

## Translation and shared understanding

Piarre bridges differences in terminology, expertise, assumptions, and background knowledge between people and coding agents. Translation preserves meaning and connects technical findings to the user's goal. It does not assume that every model needs terse input or every person needs a longer answer.

An AI-facing layer provides explicit goals, constraints, relevant knowledge, sources, uncertainty, and action state. A human-facing translation layer explains what those records mean, why they matter, and what decision is needed. Both refer to the same records. Users can inspect the original evidence and correct an interpretation. Neither representation is hidden model reasoning.

Human explanations start with the useful answer and offer additional context, definitions, examples, and technical detail as needed. Adapt depth to the user's knowledge and feedback. Preserve material caveats, quantities, negation, and distinctions between proposed, observed, verified, and accepted work. A simpler explanation must not imply stronger evidence or broader approval.

Translation also works from human intent toward agent instructions. Preserve the original statement alongside its proposed interpretation. Investigate observable facts and ask focused questions when materially different interpretations would change scope or acceptance. A paraphrase or fluent reply does not establish user agreement, confirm knowledge, or authorize work.

## Memory and the Recommendation view

Project memory contains business knowledge, technical decisions, requirements, preferences, observations, and unresolved assumptions. Users can inspect sources, confirmation state, changes, and affected work.

Important recommendations offer a Recommendation view showing supporting records, assumptions, alternatives, contradictions, and proposed versus completed actions. This is an explanation backed by evidence, not access to hidden model reasoning.

The user wants automatic observation capture and approval of memory changes. The proposed boundary is automatic capture as unconfirmed observations, with approval before replacing confirmed knowledge, promoting inferences to requirements, or resolving contradictions. This policy still needs explicit resolution before dependent behavior ships.

Corrections must update durable records and identify affected plans or evidence. Missing, invalid, disputed, and stale knowledge remain distinct. Repeated behavior alone does not establish a permanent preference. Fast lookup is required; a particular index structure is not a product requirement.

Project lookup must connect business knowledge and technical decisions to code symbols, modules, infrastructure declarations, requirements, and verification evidence. It should answer both where behavior is implemented and why a decision was made. Code alone does not establish business rationale, and an infrastructure declaration does not prove the deployed state.

Evaluate a knowledge graph alongside exact search, semantic retrieval, and compiler-derived code indexes. Relationships must retain sources, revisions, extraction method, and confirmation state. Model-inferred links remain distinguishable from source-derived or confirmed links. Retrieval must expose stale indexes, incomplete coverage, contradictions, and unsupported answers rather than presenting plausible matches as facts.

Choose storage and retrieval methods through representative lookup and change-impact evaluations. A dedicated graph database is a candidate, not a committed dependency. Retrieval indexes must not become competing authorities for project knowledge, approvals, or evidence.

## Work and user authority

Piarre turns broad intent into reviewable goals, requirements, plans, dependencies, tasks, and acceptance checks. AI triage can recommend priorities and defer work with visible, reversible changes. Triage does not authorize execution.

Piarre may challenge requested features and recommend deleting unnecessary scope. Humans approve changes to product direction. Routine steps can proceed inside an approved scope without asking for every subtask.

Paid operations and potentially damaging actions require applicable approval and transparency, including cost uncertainty, data sharing, failure consequences, and a recovery plan. Approval granularity remains open; no blanket spending permission is inferred. Unsupported hard cost caps must not be promised.

One coding writer is the initial boundary. Results need current checks and user review. Checkpoints let users preview and restore supported earlier state while preserving newer work. Restoration does not imply reversal of external services or provider charges.

## Parallel ideas, council, and preparation

A new idea can become a linked thread with a parent, scoped context, and return point. Capturing an idea does not automatically schedule paid work. Findings cannot silently alter the original plan.

A bounded council supports independent read-only investigation or review. Users can inspect purpose, provider, state, available actions and traces, findings, disagreements, and costs. Agreement among agents does not prove correctness. Multiple writers require separate isolation and integration evidence.

Piarre can prepare disposable drafts or retrieve context from submitted instructions. Explicitly streamed input is a later opt-in capability. Changed intent cancels or supersedes preparation. Guessed intent cannot authorize spending, confirmed-memory changes, workspace edits, or external actions. Unsent keystroke monitoring is not implied.

## Reflection and adaptation

Offer a brief optional reflection at session close, based on observed successes, friction, and user feedback. Users can decline and close immediately. Reflection proposes improvements rather than silently changing memory, policy, prompts, or code.

Optional onboarding can ask about work, experience, and explanation preferences. Users can skip it and correct the profile later. Adaptation must not hide material risks or assume that the user's needs never change.

Self-optimization toward smaller models is a future capability requiring measured quality comparisons, approval, versioned evaluations, and rollback.

## Models and business constraints

Prioritize supported agent connections, visible orchestration, grounded state, and controllable spending. Use existing coding accounts through explicit supported integrations. Local conversational-model selection, speech services, and the former 6–8 GB voice-system target are deferred; they do not gate this candidate. Stronger-model consultation still requires applicable spending and data-sharing approval.

Cost estimates follow the user's actual billing route. API-token usage shows estimated dollar charges. Claude Code or Codex subscription usage shows estimated token use and five-hour or weekly allowance consumption where applicable. Use observed calibration or provider estimates for percentages; tokens alone do not establish subscription quotas. Show unknown estimates explicitly, separate current usage from predicted task consumption, and disclose extra-usage charges.

Connected coding accounts may supply workers through supported integrations. They are not automatically free, unlimited, or permitted for arbitrary credential reuse. Provider eligibility and prices need current verification. The revenue model and realistic per-session costs remain unresolved.

Use research papers and engineering practice to select experiments, then test actual recall, agent-state accuracy, control responsiveness, resource use, and failure behavior. No particular model is selected here.

## Testing experience and success

Daily work uses a stable release. Candidate testing uses a separate environment with independent state. CI packaging alone does not authorize production promotion.

User tests can link optional screen recordings with logs, agent activity, submitted instructions, relevant revisions, checks, and annotations. Capture, retention, export, and remote analysis are separate choices. Recordings show the experience; synchronized diagnostics help explain failures.

The first integrated candidate should demonstrate an agent overview, task ownership, meaningful progress and blockers, pending decisions, sourced resumption, Recommendation, corrected memory, triage, approved execution, bounded agent coordination, checkpoint recovery, and result review. Linked ideas and reflection are supporting features. Voice, broad conversational polish, and local conversational-model tuning are deferred. Multiwriter execution, an IDE fork, shared cloud collaboration, autonomous deployment, and background listening are outside the initial scope.

Test whether users can identify agent ownership, activity, blockers, required decisions, and evidence without asking for status. Compare supervision time, reading burden, repeated context, interruptions, corrections, missed defects, and accepted results with the user's existing workflow. A first feedback round establishes improvement targets rather than proof of productivity. Rough edges may become follow-up work; unauthorized actions, silent data loss, and false verification block release.

Evaluate translation by whether users understand consequences and choose appropriately, with source meaning and uncertainty preserved. Evaluate retrieval with known answers and unanswerable questions, including renamed code, changed decisions, conflicting sources, and stale infrastructure information. Measure evidence support, missed dependencies, freshness, latency, and indexing cost. Fluent explanations and a connected graph do not establish correctness.

## Research direction

Piarre aims to preserve the developer's understanding of delegated work through collaborative intent correction, evidence-backed explanations, informed review, and support for later maintenance. The [user design principles](03_USER_DESIGN_PRINCIPLES.md) describe experiments for these aims, grounded conversation, inbox triage, scoped skills, optional skill evolution, workflow diagrams, and evolving memory. Their unvalidated variations do not expand the current release or override accepted requirements. Token savings and reduced AI fatigue require evidence.
