# User design principles

These principles record the product owner's goals for how Piarre should support human-agent collaboration. They guide product decisions alongside the [PRD](01_PRODUCT_PRD.md). GitHub issues and Project 8 remain authoritative for implementation scope, acceptance criteria, priority, and delivery.

The long-term vision is a product form of p-stack that evolves with the developer's workflows. The central aim is to reduce token costs, repeated corrections, unclear communication, misinformation, and AI fatigue while preserving human understanding and control. Specific interfaces and claimed benefits require experiments. These principles do not add features to the current release or defer requirements already accepted there.

## P01. Keep delegated work visible and individually steerable

Developers should be able to identify each agent's task, activity, outputs, blockers, and pending decisions. Visibility should include agent-to-agent interactions, agreements, disagreements, and handoffs. A developer should be able to direct a specific agent and inspect whether that instruction was received and acted on.

A Slack-like room, post, or session is a candidate interaction. The container and naming remain open. Compare a room with the existing work view and a session timeline. Test whether users understand ownership and intervene correctly without reading every message. Controls must reflect actual provider capabilities and authorization boundaries.

## P02. Make visibility economical

Displaying progress should not require always-on model activity. Explore rendering recorded events without inference and delivering only relevant context to each agent. A visible message need not enter every agent's context.

Coordination, summaries, and context delivery can still consume tokens. Measure calls, usage, and task quality before claiming savings. Keep the simpler interaction when additional agent communication increases cost or reading burden without improving supervision.

Anthropic's [tool-design guidance](https://www.anthropic.com/research/writing-tools-for-agents) suggests bounded, relevant responses with filtering, pagination, and optional detail. For Piarre, test concise agent-facing results while retaining inspectable evidence. Never truncate away material uncertainty, failures, or information needed for the next action. Compare task success and total tokens, not response length alone.

## P03. Ground natural conversation in shared work

Piarre should communicate naturally and refer accurately to prior work, decisions, and corrections. Useful continuity requires inspectable records and honest uncertainty. Human-sounding language alone does not establish reliable memory.

Harness^2 is a proposed approach for prompt and retrieval experiments; its integration remains undefined. Compare relevant history, irrelevant history, corrected decisions, and missing evidence. Evaluate clarity, grounded references, correction burden, and token cost together.

## P04. Preserve intent when execution is unavailable

A developer should be able to capture next steps when credits run out or a rate limit blocks work. Explore a durable inbox that accepts messages without a model call and supports later triage without losing the developer's train of thought.

Capture, triage, and execution need distinct states. Queuing a message does not approve its execution. Investigate restart recovery, duplicate prevention, stale instructions, provider availability, and user control over resumption. Integrate with canonical task state rather than creating a competing agenda.

## P05. Use focused skills that fit the repository

Route concrete tasks to focused `SKILL.md` procedures with necessary context, expected outputs, and meaningful verification. Explore global `.piarre` skills with repository-specific versions when local differences affect the work. Directory layout, precedence, versioning, and conflict resolution remain open.

A skill file does not prove reliability or make a smaller model sufficient. Compare generic, global, and repository-specific procedures on repeatable tasks. Measure quality and token use. A generic model may formulate a proposal when no focused skill fits; ambiguous intent still requires human clarification before dependent execution. Repository skills remain subject to trust and authorization boundaries.

Focused skills also need usable tools. Anthropic recommends distinct purposes, clear names and schemas, helpful errors, and workflow-oriented operations rather than exposing every API endpoint. For Piarre, compare a small task-relevant tool set with a broad catalog. Any combined operation must preserve approval boundaries and disclose partial failures. A skill describes a procedure; a tool executes an operation. Evaluate both together. [Source](https://www.anthropic.com/research/writing-tools-for-agents).

## P06. Make adaptation optional and demonstrable

Piarre should adapt to the developer without silently changing the rules they rely on. Explore a setting for proposing or automatically updating skills through Harness^2. Automatic application requires explicit opt-in for a defined scope; whether it is appropriate remains open.

Skill changes need a reviewable diff, reason, evaluation evidence, version history, and restoration path. Test the corrected failure and held-out cases, including regressions across repositories. Changes cannot expand authority or bypass clarification of ambiguous intent.

Extend adaptation experiments to tool descriptions and response formats. Anthropic recommends realistic tasks, verifiable outcomes, held-out cases, and tracking errors, calls, latency, and tokens. Piarre should accept valid alternative strategies rather than require one exact tool sequence. These evaluations inform proposed changes; they do not authorize automatic deployment. [Source](https://www.anthropic.com/research/writing-tools-for-agents).

## P07. Make planned steps and actual execution distinguishable

A developer should be able to inspect a multi-step skill before execution and understand its current stage during work. A flow diagram or plain step list could show planned actions, observed execution, approval waits, failures, deviations, and unknown state.

Models can propose actions while deterministic code owns authorization and execution state. A free-form skill file does not guarantee deterministic behavior. Compare diagrams with lists by testing whether users predict the next action, notice an unintended action, and understand deviations.

## P08. Let memory evolve while preserving provenance and authority

Retrieve knowledge according to relevance, applicability, and authority. Use recency and usage to improve selection without redefining what is true. An older accepted business decision can remain current; a new agent proposal cannot silently replace it. Distinguish when a claim applied from when Piarre recorded it. Keep confirmed, inferred, disputed, superseded, stale, and unavailable records distinct.

Keep business knowledge and technical decisions as sourced, versioned records. Keep code grounded in the current worktree, including uncommitted edits. Infrastructure declarations describe intent; current deployed-state claims need appropriately scoped, authorized live observations. Historical questions deliberately retrieve historical versions. Conflicting accepted sources remain visible until resolved through the existing approval process.

Start with exact identifiers and SQLite full-text search. Route code questions to current files and compiler references where available; use bounded sourced relationships for impact questions. Retrieve applicable constraints alongside direct matches, then expand evidence only to resolve a specific gap. Preserve original passages, qualifiers, source revisions, and coverage limits within a bounded context budget.

Treat indexes, summaries, and caches as replaceable derivatives. Cache retrieval work before generated final answers. Validate source changes, additions, deletion, permission changes, and collection membership. An unchanged old hit can still miss a newly accepted constraint. Keep evidence consistent across revisions and distinguish no match from partial, failed, stale, or conflicting lookup. Incomplete constraint coverage cannot establish policy compliance. Bound total calls, bytes, retries, model work, and elapsed time separately from final evidence tokens.

Usage may warm relevant caches and reveal retrieval misses. Frequency must not promote authority or turn inferred preferences into confirmed knowledge. Respect retention, deletion, project isolation, and approved spending. Retrieved prose remains untrusted data rather than instructions.

Anthropic's [Contextual Retrieval](https://www.anthropic.com/research/contextual-retrieval) is a candidate for restoring meaning lost when documents are split into chunks. Test deterministic source headers first. Add lexical-plus-semantic retrieval for demonstrated paraphrase misses, generated contextualization for missing chunk meaning, and reranking for noisy candidates. Graph-assisted synthesis and bounded whole-document context serve different question types; no graph database or model is mandated. Generated context remains separate from source evidence and cannot confirm a decision.

Use [controlled retrieval comparisons, issue #79](https://github.com/sysung/piarre/issues/79), to select additions. Compare identical versioned tasks and source snapshots, preserving an untouched baseline and changing one component at a time. Measure grounded correctness, evidence recall, stale or unauthorized admissions, user effort, end-to-end latency, and total ingestion/update/query cost separately. Keep held-out cases for temporal updates, conflicts, missing evidence, and abstention. A benchmark gain elsewhere does not establish Piarre gains; retaining the simpler baseline is a valid result.

## P09. Turn requests into verifiable outcomes and repair misunderstandings

Preserve the original request alongside a proposed interpretation that states the outcome, preserved behavior, scope exclusions, success measure, and unresolved questions. Use available evidence to reduce unnecessary questions. Material ambiguity about intent requires human clarification before dependent execution.

For "Optimize this data pipeline", propose output invariants, a baseline, constraints, and a verification procedure. Clarify whether cost, speed, memory, or another measure is the objective when context does not settle it. Do not silently choose the goal.

When a user corrects the task, show what changed in the shared understanding and identify stale plans or evidence. The developer should not need to rewrite the specification after every correction. Test routing, scope drift, repeated explanations, output preservation, and whether verification detects a failed outcome.

## P10. Explain consequential actions with evidence

Help developers connect requests and constraints to consequential actions, changed artifacts, and observed results. Provide concise explanations linked to exact evidence, with detailed activity available for investigation. Visibility concerns observable actions and useful explanations, not private model reasoning.

Distinguish observations, assumptions, and inference. A generated explanation is not proof that an action occurred. Test whether a developer can locate the first observed deviation without reading the full transcript.

## P11. Reduce review fatigue without encouraging rubber-stamping

Review should help developers understand what changed, why it matters, what was checked, what failed, and what remains unknown. Fluent language, agent confidence, and another agent's agreement cannot substitute for evidence.

Explore checkpoints at meaningful changes in scope, authority, or risk. Compare them with review at every step. More checkpoints can increase interruption burden and blind acceptance. Use realistic changes with seeded material errors to measure comprehension, missed defects, corrections, review time, perceived workload, and token cost. Faster acceptance and fewer messages alone do not establish success.

## P12. Preserve the developer's ability to own and maintain the result

Delegation should preserve enough understanding for a developer to direct, review, maintain, and recover the resulting system. Explore optional explanations of affected components, data flow, constraints, and tradeoffs linked to current code and decisions. Match detail to user preference and prior knowledge without forcing a tutorial into every task.

Evaluate the full collaboration. Start with imperfect intent, form a verifiable proposal, execute within authority, accept a correction, review, and return after an interruption. After a delay, ask the developer to explain the change and make a related modification or diagnose a seeded failure. Compare correctness, assistance needed, total effort, and cost with the existing workflow. Faster initial delivery does not establish improvement if later maintenance becomes harder.

## Inspirational Sources

The following references preserve the owner's research trail. They are inspiration, not proof of Piarre's benefits or implementation requirements.

- [HyperAgent](https://www.hyperagent.com/) describes transparent execution, agent management, and Slack integration. It inspires the principle of visible, controllable delegation. The owner rejects an always-on design for Piarre because of token-cost concerns. The site does not establish the cost of Piarre's proposed design.
- [Reddit discussion supplied by the owner](https://www.reddit.com/r/Airtable/comments/1sz89wp/comment/olnnyoq/) prompted concerns about coordination overhead. The comment could not be fetched on 2026-11-02, so its specific claims remain unverified.
- [The End of Software Engineering, arXiv 2606.05608v1](https://arxiv.org/html/2606.05608v1) discusses agent memory, coordination, human oversight, and skill evolution. The owner associates skill diagrams, knowledge graphs, and rubber-stamping with their reading and discussion of this paper. The fetched HTML did not establish those specific attributions or the phrase "Deterministic-Stochastic Boundary Architecture". Retain these as the owner's research leads pending a precise source, rather than verified paper claims.
- [Owner's Gemini discussion](https://share.gemini.google/iDLzyQdkc3bV) provides the stated background for the HCI concerns. It was inaccessible on 2026-11-02, and its contents were not independently reviewed.
- [Continuation conversation](https://share.gemini.google/jzNCPNajfGba), titled "Essential AI and Engineering Principles", was accessible in the browser on 2026-11-02. It supplies the HCI discussion summarized above. "Deterministic-Stochastic Boundary Architecture" and "rubber-stamping" appear in Gemini's responses there. This establishes their presence in the conversation, not their attribution to the arXiv paper or the validity of Gemini's general claims. The linked earlier conversation within that page was not reviewed.

- [Writing effective tools for agents, Anthropic](https://www.anthropic.com/research/writing-tools-for-agents). Informs P02, P05, and P06.
- [Introducing Contextual Retrieval, Anthropic](https://www.anthropic.com/research/contextual-retrieval). Informs P08.

- [LongMemEval](https://arxiv.org/abs/2410.10813). Informs temporal updates and abstention evaluation in P08.
- [GraphRAG query overview](https://microsoft.github.io/graphrag/query/overview/). Informs question-specific graph retrieval in P08.
- [Zep facts documentation](https://help.getzep.com/v4/facts). Informs the distinction between validity time, recording time, and truth in P08.
