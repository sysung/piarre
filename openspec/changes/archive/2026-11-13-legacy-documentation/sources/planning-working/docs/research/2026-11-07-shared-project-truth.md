# Shared project truth for humans and AI: continue, narrow, or stop?

Research date: 2026-11-07. This is a product-research assessment, not an approved change to the PRD, proof of product readiness, or a claim of willingness to pay. Scope is software-development workflows. Public discussion cannot establish a population-wide consensus.

## Recommendation

Continue investigating the underlying problem, narrow the initial job, and pause further local-model optimization as the main product objective. The useful goal is to help a person and their coding agent recover current requirements and accepted decisions, understand their sources, and notice when changed evidence or intent requires review. A shared documentation store alone has direct existing competition.

The current PRD already defines the business problem as AI fatigue: repeating context, reading updates, coordinating agents, and checking unsupported claims. It describes human and AI views over the same records and explicitly says a retrieval index must not become another authority. Those are requirements, not delivered capabilities. See [product requirements](../01_PRODUCT_PRD.md) and [design principles](../03_USER_DESIGN_PRINCIPLES.md). The local-model comparison tested a mechanism; it did not measure that business outcome.

## Evidence that people experience the problem

Stack Overflow's 2026 context-barriers question has 12,374 respondents. They report incomplete information (63.2%), knowledge held in people's heads (60.9%), outdated information (56.5%), and fragmentation across tools (53.4%). More specific authority and AI-context complaints are less common: hard-to-find decisions 26.1%, divergent team versions 25.4%, unclear authoritative source 18.4%, and wrong context used by AI 16.8%. This supports a broad knowledge-maintenance problem; it does not establish that a dedicated authority product is the highest-priority purchase. [Primary results](https://survey.stackoverflow.co/2026/knowledge/data)

The survey is self-selected through Stack Overflow's site, blog and opted-in email audience. These percentages describe responding developers, not the general public or every developer. Self-reported friction is not observed time saved by Piarre. [Methodology](https://survey.stackoverflow.co/2026/methodology)

A 2021 ExperiencedDevs thread describes a roughly 50-engineer startup losing design rationale across documents, tickets, GitHub and chat. Participants describe both similar problems and the difficulty of paying the maintenance cost. This predates current coding agents, so AI did not create the entire problem. It is firsthand anecdotal evidence, not a representative survey. [Thread](https://www.reddit.com/r/ExperiencedDevs/comments/pwgyek/what_to_do_about_fragmented_and_stale_internal/)

A 2026 thread reports onboarding harm from stale setup instructions; comments stress ownership, incentives, selective documentation and integrating updates into work. A recent Hacker News discussion on agent documentation is divided: some report context pollution from stale files; others describe necessary project constraints that code alone cannot supply. These sources show disagreement about solutions, not disagreement that stale context can be costly. Neither votes nor comment volume measures prevalence. [ExperiencedDevs](https://www.reddit.com/r/ExperiencedDevs/comments/1qejexx/documentation_is_three_years_out_of_date_and/), [Hacker News](https://news.ycombinator.com/item?id=49945933)

## Evidence against assuming documentation improves agents

The September 2026 revision of *Evaluating AGENTS.md* reports that context files did not generally improve task-success rates in its tested settings and increased average inference cost by more than 20%. It identifies non-standard project practices as a useful instruction case. This is evidence against automatically writing large repository overviews and treating them as a performance feature; it is not evidence that humans do not need decisions or requirements. [Paper v3](https://arxiv.org/html/2602.11988v3)

A separate March 2026 paper studies 10 repositories and 124 PRs and reports lower median runtime and output-token consumption with AGENTS.md, with comparable completion behavior. Another October 2026 workshop paper examines 17 tasks, 3 repositories and 288 runs with two frontier agents and finds no measurable correctness improvement from context strategy. The settings and outcomes differ. There is no justified universal claim that more context helps or that all context files are useless. [Efficiency study](https://arxiv.org/abs/2601.20404v2), [Two-agent ablation](https://aclanthology.org/2026.realm-1.5/)

## Existing alternatives

Official documentation establishes substantial competition, not independent evidence of each product's effectiveness.

- AGENTS.md supplies an open Markdown convention for agent instructions. Claude Code and Cursor document versioned project context, scoped loading and maintenance guidance. Claude's current memory docs also describe reviewable initialization and instruction auditing; generic instruction freshness is not an unoccupied feature.
- OpenSpec documents readable proposals, requirements, design and tasks. Its Stores feature, explicitly beta, places shared planning in a Git repository for teams and agents across codebases. This overlaps directly with the shared-source-of-truth pitch.
- Kiro documents a workflow for updating requirements, then design, then synchronizing tasks. Requirement-change propagation is already a competitive area.

[AGENTS.md](https://agents.md/), [Claude Code memory](https://code.claude.com/docs/en/memory), [Cursor rules](https://cursor.com/docs/rules), [OpenSpec](https://github.com/Fission-AI/OpenSpec), [Kiro](https://kiro.dev/docs/specs/best-practices/)

These pages do not prove any competitor lacks detailed approval invalidation or evidence lineage. Comparative hands-on testing is still required. Plain Markdown, Git review and an existing coding agent are the baseline; they may be sufficient for some teams.

## A useful meaning of source of truth

A document can record an accepted intention. Current code shows implementation. Scoped tests and runtime observations supply evidence about behavior. A ticket records work state. Those can disagree without one magically becoming the answer to every question. Piarre should expose their relationship and disagreement rather than generate a single confident account.

The candidate experience is a small set of human-owned records with the decision or requirement, original source, status, owner, applicable scope and version. AI can propose updates; an inferred statement must not silently become an approved requirement. An old accepted decision may remain current, and a newly edited document may still be wrong. Provenance and a timestamp help inspection but do not prove correctness.

Illustrative scenario, not a delivered feature: a team changes a refund window from 30 to 45 days. A tool identifies the accepted revision, marks linked plans and evidence as needing review, and tells the next person or agent which requirement is current. It must distinguish explicitly linked effects from model-inferred possible effects. Automatically rewriting every document would risk hiding conflicts.

## Candidate initial jobs

| Job hypothesis | Why it may help | What would establish value |
| --- | --- | --- |
| Resume a project or switch coding agents | Current decisions and unresolved questions are scattered across chats | Less reconstruction and repeated explanation, with no missed current constraint |
| Review the consequences of a changed requirement | Prior plans and claims can remain attached to an obsolete assumption | Correct affected items found with less review time and tolerable false alarms |
| Explain why a design exists during onboarding or review | Code reveals behavior more readily than stakeholder intent | Faster source-backed answers and fewer repeated expert interruptions |
| Check completion claims against recorded requirements and evidence | A fluent summary can confuse intended, implemented and checked behavior | Fewer unsupported done claims without increasing total review burden |

These are product hypotheses, not demonstrated demand for Piarre. Initial user segment to test: developers and small teams already using coding agents who can show recurring, consequential context-reconstruction or stale-decision incidents. Enterprise search and general documentation generation are broader, crowded expansion areas.

## Bounded validation and decision rule

1. Interview 5–8 target developers about their most recent incident, not their opinion of the concept. Ask to see the changed requirement, stale record, repeated explanation or disputed completion claim, and how they fixed it. Establish frequency, consequences, ownership and existing workaround. This is a proposed discovery sample, not a statistically representative survey.
2. Prototype one workflow on one real repository using current tools. Capture a decision as a reviewable record; change it; resume in a fresh agent session. Include an unsupported question that should remain unanswered. Keep manual review and portable records.
3. Compare ordinary Git Markdown plus the user's existing agent against OpenSpec or Kiro and the candidate Piarre workflow. Use comparable tasks and alternate order. Measure source-backed correctness, current-constraint coverage, false stale alerts, maintenance time, total reading/review time and actual reuse. Do not substitute token counts or answer fluency for benefit.
4. A proposed continue gate is recurring observed pain plus repeated voluntary reuse and a useful reduction in total maintenance/review effort. Stop or integrate into an existing tool if basic Git Markdown solves the job, the underlying decisions are not owned, or users will not review proposed updates. A few interviews do not establish willingness to pay; a paid pilot or equivalent real commitment would be stronger evidence.

Do not expand into custom models, general autonomous orchestration, or a large knowledge graph before one of these jobs demonstrates value. Use existing model/retrieval components when they help the selected task.

## Confidence and gaps

Confidence is high that software developers report fragmented and stale context, and that shared AI documentation is crowded. Confidence is moderate that change-aware decision records are a useful narrower hypothesis. There is no present evidence that Piarre is better than existing approaches, that users will maintain its records, or that customers will pay. No prospective-user interviews, competitor product trials or product analytics were performed for this research. Sources were checked online on 2026-11-07; features and pages may change.
