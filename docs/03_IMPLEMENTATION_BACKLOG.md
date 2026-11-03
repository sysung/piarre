# Implementation backlog

This document is the source of truth for the v0.2 implementation sequence.

The separate [post-PoC product research backlog](05_RESEARCH_BACKLOG.md) contains unestimated discovery topics. Its R-series entries do not change the B-series sequence, milestones, or estimates. Promotion into implementation requires the publication process below.

## Estimate basis

Focused engineering hours for one experienced TypeScript developer, including automated tests and a short evidence note. Product studies, review latency, and unknown provider defects are excluded.

P0 totals **196 hours**. P1 totals **84 hours**. The combined planning sum is **280 hours**. These are arithmetic sums, not measured delivery time. Re-estimate after B07, B15, B22.

## Milestones

- **M0 Honest control loop.** A typed command can propose, approve, run, verify, review, and recover one bounded task.
- **M1 Voice control.** Voice reaches the same command boundary with explicit capture and correct interruption semantics.
- **M2 Trustworthy supervision.** Requirements, conflicts, approvals, budgets, privacy, and failure recovery behave correctly.
- **M3 Supervised writer release.** The website workflow and regression suite prove the P0 claim.
- **M4 Supervised team.** Read-only work, isolated writers, scheduling, integration, and local interpretation pass the P1 gate.

## Stories

| ID | Priority | Milestone | Size | Estimate | Dependencies | Story |
|---|---|---|---|---:|---|---|
| B00 | P0 | M0 | M | 6h | None | Bootstrap a repeatable extension |
| B01 | P0 | M0 | M | 12h | B00 | Open a durable Piarre project |
| B02 | P0 | M0 | M | 12h | B01 | Turn text into a reviewable task |
| B23 | P0 | M0 | M | 12h | B01, B02 | Track session task lists in a persistent pane ([#48](https://github.com/sysung/piarre/issues/48)) |
| B03 | P0 | M0 | L | 16h | B02 | Run one bounded coding task |
| B04 | P0 | M0 | M | 14h | B03 | Verify before review |
| B05 | P0 | M0 | M | 10h | B04 | Review and accept current evidence |
| B06 | P0 | M0 | M | 12h | B03 | Stop without pretending to roll back |
| B07 | P0 | M0 | M | 12h | B04, B06 | Recover after restart |
| B08 | P0 | M1 | M | 10h | B02 | Speak and type through one command boundary |
| B09 | P0 | M1 | M | 10h | B08 | Separate speech interruption from work interruption |
| B10 | P0 | M2 | L | 14h | B05, B09 | Change a requirement during work |
| B11 | P0 | M2 | M | 10h | B03, B10 | Protect manual edits |
| B12 | P0 | M2 | M | 12h | B03 | Make authority and cost visible |
| B13 | P0 | M2 | M | 10h | B01, B08 | Control local data |
| B14 | P0 | M3 | M | 12h | B05, B07, B10, B11, B12, B13, B23 | Build and verify a local website |
| B15 | P0 | M3 | M | 12h | B14 | Pass the supervised-writer release gate |
| B16 | P1 | M4 | M | 10h | B15 | Assign parallel read-only research |
| B17 | P1 | M4 | L | 14h | B15 | Isolate every coding worker |
| B18 | P1 | M4 | M | 12h | B16, B17 | Schedule by dependency and capability |
| B19 | P1 | M4 | L | 14h | B18 | Integrate through review |
| B20 | P1 | M4 | M | 10h | B18 | Route commands through an optional local interpreter |
| B21 | P1 | M4 | M | 12h | B19, B20 | Verify with a different worker |
| B22 | P1 | M4 | M | 12h | B21 | Pass the supervised-team release gate |

## Publication contract

B23 adds one durable current agenda per repository, rendered in a native Session tasks sidebar. Lists reference canonical goal/proposal groups and tasks from B02. Piarre-created proposals enter the agenda automatically without approval or execution. Agenda edits change membership and order only. B03 through B05 extend canonical status display as those features arrive. B14 verifies the complete journey. Issue #48 contains the architecture, acceptance criteria, and evidence contract. Session archives and external/private checklist import are deferred.

Each published GitHub issue carries the marker `piarre-backlog:<ID>:v0.2`. A backlog change must update this document and Project 8. Read back issue markers, fields, estimates, and native dependency edges after publication.

B23 also includes task triage. Canonical task priority is separate from the agenda's untriaged, cover now, or deferred disposition. Individual and atomic batch edits support priority, order, and optional reasons. Triage persists through the same event and revision boundary, remains reversible, and never grants approval or changes execution, verification, or acceptance state. Filters keep deferred work discoverable.

## Delivery rule

P0 permits one supervised writer. B15 is the release gate. P1 work is invalid unless it transitively depends on B15. P1 introduces a read-only worker before isolated coding writers. No coding workers share a write root.
