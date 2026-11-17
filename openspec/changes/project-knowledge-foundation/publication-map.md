# GitHub publication map

Published planning only. No product code or implementation tasks were completed. All new issues use `enhancement` and `needs-triage`; they are scheduled for Project 8 Backlog.

## Milestones and parents

| Stage | Milestone | Parent tracker |
| --- | --- | --- |
| K1 | [M4 — Project knowledge foundation](https://github.com/sysung/piarre/milestone/5) | [#185](https://github.com/sysung/piarre/issues/185) |
| K2 | [M5 — Useful memory across sessions](https://github.com/sysung/piarre/milestone/6) | [#186](https://github.com/sysung/piarre/issues/186) |
| K3 | [M6 — Adaptive workflow and specifications](https://github.com/sysung/piarre/milestone/7) | [#187](https://github.com/sysung/piarre/issues/187) |
| K4 | [M7 — Collaboration assistance](https://github.com/sysung/piarre/milestone/8) | [#188](https://github.com/sysung/piarre/issues/188) |
| K5 | [M8 — Configurable capabilities](https://github.com/sysung/piarre/milestone/9) | [#189](https://github.com/sysung/piarre/issues/189) |
| K6 | [M9 — Context efficiency evaluation](https://github.com/sysung/piarre/milestone/10) | [#190](https://github.com/sysung/piarre/issues/190) |

## First-change issues

| Draft ID | Issue | Blocked by |
| --- | --- | --- |
| T0 | [#191](https://github.com/sysung/piarre/issues/191) | [#138](https://github.com/sysung/piarre/issues/138), [#165](https://github.com/sysung/piarre/issues/165) |
| T1 | [#192](https://github.com/sysung/piarre/issues/192) | [#138](https://github.com/sysung/piarre/issues/138), [#165](https://github.com/sysung/piarre/issues/165) |
| T2 | [#193](https://github.com/sysung/piarre/issues/193) | [#191](https://github.com/sysung/piarre/issues/191), [#192](https://github.com/sysung/piarre/issues/192) |
| T3 | [#194](https://github.com/sysung/piarre/issues/194) | [#193](https://github.com/sysung/piarre/issues/193) |
| T4 | [#195](https://github.com/sysung/piarre/issues/195) | [#194](https://github.com/sysung/piarre/issues/194) |
| T5 | [#196](https://github.com/sysung/piarre/issues/196) | [#195](https://github.com/sysung/piarre/issues/195) |
| T6 | [#197](https://github.com/sysung/piarre/issues/197) | [#195](https://github.com/sysung/piarre/issues/195) |
| T7 | [#198](https://github.com/sysung/piarre/issues/198) | [#196](https://github.com/sysung/piarre/issues/196), [#197](https://github.com/sysung/piarre/issues/197) |

## M3 UAT gate

The first task T0 (#191) and T1 (#192) both depend on #138, the M3 UAT parent, and #165, the explicit PoC acceptance record. The foundation parent #185 has the same gates. Closing either with rejection does not establish acceptance. No follow-up work starts before successful M3 UAT and recorded acceptance.

P1-P6 dependencies follow the triage plan: #186 is blocked by #185; #187 by #186; #188 by #187; #189 by #188; #190 by #186. Context evaluation is scheduled later without a false dependency on integrations.

## Source and verification

Issue bodies link to planning commit `89c045e` on `codex/pkm-adaptive-workflow-explore`. The publication revision adds this map without changing implementation status. Readback verified all 14 issue bodies, exact native blockers, eight parent/sub-issue relations, category/state labels, milestone assignments, and all 14 Project 8 Backlog entries. Strict OpenSpec validation passed; all 28 implementation tasks remain unchecked. No product code changed.
