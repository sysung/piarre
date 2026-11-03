# Post-PoC product research backlog

Recorded on 2026-11-02 from the product owner's design notes.

These are hypotheses and deferred discovery topics. They are outside the PoC and have no implementation commitment, priority, estimate, or release milestone. P0 still has one supervised coding writer. Research may inform PoC observations without expanding its scope. A feature, a smaller variation, or no feature may be the outcome of each study.

## Product intent

The long-term vision is a product form of p-stack. Piarre adapts to the developer's workflows through focused skills, grounded memory, and visible coordination. Harness^2 is the proposed experimentation approach for prompts, routing, and skill evaluation. Its integration and concrete procedures remain undefined.

The central problem is human-computer interaction. Token costs, unclear messages, misinformation, repeated corrections, and lost context increase AI fatigue. Communication should help humans and agents resolve misunderstandings with less friction. More autonomous work is useful only when the developer can understand and direct it.

## R01. Visible agent sessions and individual control

Explore a Slack-like room where several agents participate in visible work. The container might be a post or an existing session. Naming and the need for a new container remain open.

The view would expose each agent's task, current activity, outputs, agent-to-agent messages, agreements, unresolved disagreements, and handoffs. A developer could steer a specific agent and see which instruction it received. Pause, resume, and redirection semantics need investigation against provider capabilities and existing authorization rules.

Visibility must not require always-on model activity. Explore rendering recorded execution events without a model call, then selectively delivering relevant messages to agents. A visible message need not be broadcast into every agent's context. Rendering may avoid inference, but coordination, summaries, and context delivery can still consume tokens. Zero additional token cost is a goal to test, not a guarantee.

Compare the current work view, a session activity timeline, and a room-like view on the same coordination task. Measure whether developers identify ownership, agreements, handoffs, and blocked work correctly. Record model calls, token usage, and the effect of steering. Keep the simpler view if a room adds noise without improving supervision.

## R02. Conversation grounded in prior work

Explore a more natural, human-sounding coding conversation that refers accurately to shared work and remembered decisions. Prompt experiments through Harness^2 are a candidate starting point. Tone alone cannot establish reliable memory.

Compare prompts on tasks with relevant prior work, irrelevant history, corrected decisions, and missing evidence. Check whether references point to actual records and whether the agent admits uncertainty. Evaluate conversational clarity, correction burden, retrieval accuracy, and token cost together.

## R03. An inbox that preserves intent during credit limits

Explore a durable inbox for messages captured after credits run out or a rate limit is reached. The developer can preserve their train of thought and leave actionable next steps for later triage. Capture should remain available without a model call.

After availability returns, Piarre could triage messages into focused tasks defined by `SKILL.md` contracts. Each contract would describe the task, necessary context, expected output, and verification. Test whether this permits smaller, focused agents with repeatable results. A skill file alone does not prove an agent's reliability.

When no focused skill fits, explore a generic model fallback. Ambiguous intent must return to the human before dependent execution. Provider availability, retry behavior, duplicate prevention, stale instructions, and whether processing resumes automatically or requires a user action remain open decisions. Queued messages do not themselves approve execution.

This differs from B23's existing session agenda and triage design. Research how an inbox could feed that agenda without creating competing task state. Evaluate capture and recovery across restarts, routing accuracy, preserved intent, and the effort needed to resolve ambiguity.

## R04. Global and repository-specific skills

Explore a global `.piarre` skill collection alongside repository-specific skills, analogous to the user's `.codex` and `.claude` setup. Directory layout and precedence are not yet contracts.

Similar p-stack workflows may need different prompts and context in different repositories. Test whether selecting a small relevant skill and repository context improves consistency while reducing tokens. Shared context does not automatically imply lower provider billing.

Resolve how global defaults and repository overrides interact, how versions are identified, and which source is authoritative when instructions conflict. Repository content remains subject to trust and authorization boundaries. Compare generic, global, and repository-specific prompts on repeated tasks before choosing a structure.

## R05. Optional skill self-improvement

Explore a user setting that allows Piarre to propose or automatically update skills through Harness^2 experiments. Whether proposals or automatic application are appropriate remains open. Automatic updates would require explicit opt-in for a defined scope.

Candidates need a reviewable diff, a recorded reason, evaluation evidence, version history, and a way to restore the previous version. Test whether gains persist on held-out tasks and whether improvements in one repository cause regressions elsewhere. Skill updates cannot expand the agent's authority or bypass human clarification of ambiguous requests.

## R06. Skill stages and review before execution

Explore a flow diagram that shows a multi-step skill's intended stages and the agent's current stage. Before execution, the developer could inspect the proposed actions and verify that the workflow matches their intent.

Investigate the boundary between model proposals and deterministic execution. A diagram must distinguish planned steps, observed execution, waits for approval, failures, and unknown state. It must not imply that a free-form skill file guarantees a deterministic workflow. The representation of branches and deviations remains open.

Compare a diagram with a plain step list. Test whether users can predict the next action, identify an unintended action, and understand a deviation. Measure comprehension and review effort before adopting the visual treatment.

## R07. Memory that evolves without losing authority

Explore knowledge graphs and alternative retrieval-augmented generation methods for prior experiments, technical contracts, and business decisions. The retrieval structure and database choice remain open. A graph is one candidate, not a requirement.

Distinguish historical evidence, tentative conclusions, current decisions, superseded decisions, and authoritative constraints. Record provenance and when a conclusion was valid. Age alone must not decide authority. The policy for durable source-of-truth records, explicit corrections, and user-authorized changes needs testing.

Compare text search, vector retrieval, and graph-assisted retrieval on realistic questions with conflicting and stale records. Evaluate answer grounding, handling of corrections, retrieval cost, and the developer's ability to inspect why a record was used. This research does not establish a new runtime memory contract.

## R08. Route broad requests into verifiable tasks

Explore how Piarre turns informal intent into a structured task with an output that can be checked. A focused skill should be selected when its contract fits. A generic fallback may help formulate a proposal when no skill fits, but unresolved ambiguity requires human input.

For example, "Optimize this data pipeline" suggests preserving its observable output while improving an agreed metric. Piarre could inspect available tests and measurements, then propose the invariant, metric, baseline, constraints, and verification procedure. It must clarify whether cost, speed, memory use, or another outcome matters when the request and available context do not settle that choice. It must not silently choose the objective.

Use Harness^2 experiments to test routing accuracy, missed ambiguity, output preservation, measured improvement, and token use. A structured command is useful only if its verification can detect a failed outcome.

## R09. Reduce rubber-stamping and AI fatigue

Investigate why developers accept changes without understanding their consequences. Piarre aims to make review informed without increasing interruptions until users ignore them. This extends the PRD's AI-fatigue objective and requires user testing.

Compare review presentations using realistic changes with seeded material errors. Measure whether users explain the change, notice the errors, and choose an appropriate action. Also record unnecessary corrections, review time, interruptions, perceived workload, and token cost. Faster acceptance or fewer messages alone cannot establish improvement.

## Continuation. Preserve understanding throughout delegation

The [Gemini conversation about engineering principles and HCI](https://share.gemini.google/jzNCPNajfGba) was read through its public browser view on 2026-11-02. The owner asks to continue that discussion in Piarre's design. The following aims are proposed interpretations for investigation, not settled interface choices or additions to PoC scope.

The conversation identifies opaque execution, auditing fatigue, intent drift, automation bias, and loss of the developer's mental model. Its scenarios are illustrative, and its empirical claims have not been independently checked. The product question is how developers can delegate implementation while retaining enough understanding to direct, review, maintain, and recover the resulting system.

### Explain consequential actions through inspectable evidence

Piarre should help a developer connect the request, agreed constraints, consequential actions, changed artifacts, and observed results. Explore short explanations linked to execution records and exact evidence. Visibility means observable actions and useful decision explanations, not access to private model reasoning. A generated explanation is not itself proof that an action occurred or a result is correct.

For R01 and R06, test whether a developer can locate the first observed deviation without reading an entire transcript. Keep raw activity available for investigation while showing consequential changes by default.

### Repair intent collaboratively

For R08, explore a task proposal that states the intended outcome, preserved behavior, scope exclusions, success measure, and unresolved questions. Piarre should use available evidence to reduce unnecessary questions. Ambiguous intent still requires human clarification before dependent execution.

When a correction changes the task, explore showing what changed in the shared understanding and which plan or evidence is now stale. The developer should not have to rewrite a complete specification after each correction. Test this with an ambiguous request such as "clean up the caching layer" followed by a mid-task correction. Observe scope drift, repeated explanations, and whether execution follows the corrected intent.

### Support informed review and appropriate trust

For R09, explore presenting what changed, why it matters, what was checked, what failed, and what remains unknown. Distinguish observed results from model inference and assumptions. Fluent language and an agent's confidence must not substitute for evidence.

Compare review at meaningful changes in scope, authority, or risk with review at every workflow step. More checkpoints may increase fatigue and rubber-stamping. Test comprehension and detection of material errors alongside interruption burden. A second agent's agreement is another review input, not automatic proof of correctness or independent verification.

### Preserve the developer's ability to maintain the code

Extend R02, R07, and R09 to examine whether developers understand the system after accepting agent work. Explore an optional explanation of affected components, data flow, important constraints, and tradeoffs, linked to the current code and decisions. Use prior knowledge and user preference to choose detail without forcing a tutorial into every task.

After a delay, ask the developer to explain the change, locate a relevant component, and make a small related modification or diagnose a seeded failure. Record assistance needed and correctness. Faster initial delivery alone does not establish lower total effort if later maintenance becomes harder.

### Evaluate the whole collaboration

Use one bounded scenario across these studies. Start with imperfect intent, form a verifiable proposal, execute within authority, accept a correction, review the result, then return after an interruption. Compare against the developer's existing workflow. Record token cost, task outcome, review accuracy, unnecessary corrections, interruption burden, and later maintenance effort. Prototype the smallest interaction that addresses an observed failure before adding rooms, diagrams, or new agents.

## Inspiration and source limits

The following references preserve the owner's research trail. They are inspiration, not proof of Piarre's benefits or implementation requirements.

- [HyperAgent](https://www.hyperagent.com/) describes transparent execution, agent management, and Slack integration. It inspires R01's visibility study. The owner rejects an always-on design for Piarre because of token-cost concerns. The site does not establish the cost of Piarre's proposed design.
- [Reddit discussion supplied by the owner](https://www.reddit.com/r/Airtable/comments/1sz89wp/comment/olnnyoq/) prompted concerns about coordination overhead. The comment could not be fetched on 2026-11-02, so its specific claims remain unverified.
- [The End of Software Engineering, arXiv 2606.05608v1](https://arxiv.org/html/2606.05608v1) discusses agent memory, coordination, human oversight, and skill evolution. The owner associates skill diagrams, knowledge graphs, and rubber-stamping with their reading and discussion of this paper. The fetched HTML did not establish those specific attributions or the phrase "Deterministic-Stochastic Boundary Architecture". Retain these as the owner's research leads pending a precise source, rather than verified paper claims.
- [Owner's Gemini discussion](https://share.gemini.google/iDLzyQdkc3bV) provides the stated background for the HCI concerns. It was inaccessible on 2026-11-02, and its contents were not independently reviewed.
- [Continuation conversation](https://share.gemini.google/jzNCPNajfGba), titled "Essential AI and Engineering Principles", was accessible in the browser on 2026-11-02. It supplies the HCI discussion summarized above. "Deterministic-Stochastic Boundary Architecture" and "rubber-stamping" appear in Gemini's responses there. This establishes their presence in the conversation, not their attribution to the arXiv paper or the validity of Gemini's general claims. The linked earlier conversation within that page was not reviewed.

## Promotion into delivery work

These R-series entries are an unestimated discovery backlog, separate from the B-series implementation sequence. Before promotion, identify the user problem, compare simpler alternatives, record evidence, and define acceptance criteria and authorization boundaries. A promoted implementation story must update the implementation backlog and Project 8 through the existing publication process.
