# Design

## Context

See [proposal.md](proposal.md) for motivation. The source base is `0b36edc6c2ead6b7094518d9d98747cd79c98b6e`. Existing `packages/core/src/knowledge.ts` exposes `currentKnowledge` and `knowledgeConflicts`; their checks do not prove general semantic consistency. Reuse existing record references and revision freshness boundaries rather than add another truth store.

Accepted-intent documents and exact-byte adoption exist only in open PR #101 at `25c8fa5e6fca8c14082df3f808e1ee4070244d27`, including `packages/core/src/intent-document.ts`, `apps/vscode/src/intent-documents.ts`, and `intent-commands.ts`. #91 owns acceptance/reconciliation. Issue #94's benchmark exists only in open PR #95 at `d12cc75fdcca5532e180c8371b1b766df1155b08`, with `scripts/iteration-benchmark.mjs` and `test/iteration-benchmark/metrics.mjs`. Neither unmerged implementation is part of this text-only plan branch.

## Goals / Non-Goals

Evaluate the smallest change-focused check and its incremental burden. Preserve one accepted account of intent with evidence views. Do not add a mandatory repository gate, a semantic whole-repository scan, or automatic document/test/intent correction. A missing link cannot establish complete impact coverage.

## Decisions

### Use one small benchmark slice with explicit evidence origin

Select Candidate B's proposed new `test/iteration-benchmark/consistency-cases.json`, `consistency.mjs`, and `consistency.test.mjs`. Graft Candidate A's immutable initial interpretation and owning-artifact proposal. Both candidates omitted required depth triggers/budgets and repeat suppression; those repairs are specified below. A separate intent-consistency framework would duplicate #94. See [arena.md](arena.md).

Propose twelve independently adjudicated seeded/control cases across two bounded behaviors: a low-risk explanatory change and a consequential authority/recovery change. Reuse the corrected refund-policy journey where its frozen records fit. The twelve cases cover consistency, paraphrase, equivalent refactor, code defect, wrong assertion, stale documentation, missing coverage, intentional unaccepted change, ambiguous intent, correlated code/test/doc error, stale revision, and missing evidence link. Freeze each case's risk and expected classification independently before implementation is shown. Label seeded and naturally observed defects separately.

For each finding, retain the claim, exact source/test/doc spans, intent ID/revision/hash, relevant artifact hashes, evidence origin/applicability, uncertainty, conflict class, owning artifact, and proposed next action. Accepted requirement documents and derived explanations have distinct authority. A defect, assertion error, doc error, ambiguity, pending change, stale evidence, gap, false alarm, and cannot-determine result stay distinguishable. A proposal carries no write or acceptance authority.

### Compare risk-based depth with ordinary review

Condition A is existing tests plus ordinary review. B adds deterministic link/revision/applicability checks. C adds bounded independent semantic review only for consequential cases. The deeper trigger is a changed permission, consequential contract, data-loss/recovery behavior, or externally visible promise. Uncertain impact is recorded as incomplete coverage and escalated for human classification, not assumed low risk.

Proposed review caps are five active minutes per low-risk case and fifteen per consequential case. Proposed semantic-model caps are zero calls/tokens for low-risk cases and, only after separate authorization, one call with at most 4,096 input and 1,024 output tokens per consequential case. Offline fixtures replay recorded interpretations with zero model calls. These caps are proposed for review; freeze final values and budget-exhaustion handling before any trial. Exhaustion yields incomplete review, never a consistency pass.

An independent reviewer derives expected behavior and edge cases from accepted intent before seeing implementation, tests, or explanation. Hash and preserve that initial interpretation. Later corrections are append-only with reasons. Separate workers or configured Sol/Astra alone do not prove independence when they share the same summary or assumptions.

Measure class-level false positives/negatives, missed coverage, false claims of consistency, and actionable findings added beyond A. Report incremental value and actual total burden for each depth, including reading, triage, investigation, correction, repeated explanation, maintenance, setup, elapsed time, and model/token cost. Reuse #67/#59's existing effort workflow; no new mandatory human ceremony is added.

### Suppress unchanged findings without erasing them

Key a finding by claim/scope/class, relevant evidence identities, accepted-intent identity, and relevant artifact revisions. An exact repeat updates its occurrence record without presenting another review demand. Keep the original finding, disposition, and timestamps inspectable. A relevant change marks it stale and schedules recheck. Unrelated revisions neither dismiss it nor silently validate it. Missing links mean impact coverage is unknown. This avoids maintaining three manual copies of each requirement.

## Risks / Trade-offs

- Correlated artifacts can agree wrongly. Independently adjudicated expectations and the correlated-error negative control counter false confidence.
- Deeper review can add noise. Freeze benefit/effort thresholds and compare depth-specific deltas, not raw finding counts.
- Twelve cases cannot support broad defect-rate claims. Report feasibility and class failures without population inference.
- Identity contracts are unmerged. Resolve #101/#95 integration explicitly after review and preserve event authority.

## Migration Plan

After human plan/test-boundary agreement and explicit Apply, add offline recorded fixtures through red, minimum green, and refactor checks. Run independent configured Sol+Astra Interrogate and concrete Blast Radius probes, resolve findings, and reverify. Human timed comparison and model-assisted review require separate authorization and frozen thresholds. Keep ordinary review as the default unless results justify the smallest useful addition.

## Review requested

Confirm behavior/case coverage, consequential triggers, suppression semantics, and proposed time/token caps. Before measurement, agree adjudication, independent sample counts, order/reset rules, actionable incremental-benefit margins, false-alarm/false-consistency tolerances, attention limits, and continue/narrow/defer rules. Human/model trials remain pending. Publish, then wait for human review before Apply.
