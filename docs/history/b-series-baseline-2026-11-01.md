# B-series baseline before C planning

Captured from live GitHub on 2026-11-01. This is historical evidence, not the C execution queue.

| Issue | State | Project status |
|---|---|---|
| [[B00] Bootstrap a repeatable extension](https://github.com/sysung/piarre/issues/20) | CLOSED | Done |
| [[B01] Open a durable Piarre project](https://github.com/sysung/piarre/issues/21) | CLOSED | Done |
| [[B02] Turn text into a reviewable task](https://github.com/sysung/piarre/issues/22) | CLOSED | Done |
| [[B03] Run one bounded coding task](https://github.com/sysung/piarre/issues/23) | OPEN | In review |
| [[B04] Verify before review](https://github.com/sysung/piarre/issues/24) | OPEN | Backlog |
| [[B05] Review and accept current evidence](https://github.com/sysung/piarre/issues/25) | OPEN | Backlog |
| [[B06] Stop without pretending to roll back](https://github.com/sysung/piarre/issues/26) | OPEN | Backlog |
| [[B07] Recover after restart](https://github.com/sysung/piarre/issues/27) | OPEN | Backlog |
| [[B08] Speak and type through one command boundary](https://github.com/sysung/piarre/issues/28) | OPEN | Backlog |
| [[B09] Separate speech interruption from work interruption](https://github.com/sysung/piarre/issues/29) | OPEN | Backlog |
| [[B10] Change a requirement during work](https://github.com/sysung/piarre/issues/30) | OPEN | Backlog |
| [[B11] Protect manual edits](https://github.com/sysung/piarre/issues/31) | OPEN | Backlog |
| [[B12] Make authority and cost visible](https://github.com/sysung/piarre/issues/32) | OPEN | Backlog |
| [[B13] Control local data](https://github.com/sysung/piarre/issues/33) | OPEN | Backlog |
| [[B14] Build and verify a local website](https://github.com/sysung/piarre/issues/34) | OPEN | Backlog |
| [[B15] Pass the supervised-writer release gate](https://github.com/sysung/piarre/issues/35) | OPEN | Backlog |
| [[B16] Assign parallel read-only research](https://github.com/sysung/piarre/issues/36) | OPEN | Backlog |
| [[B17] Isolate every coding worker](https://github.com/sysung/piarre/issues/37) | OPEN | Backlog |
| [[B18] Schedule by dependency and capability](https://github.com/sysung/piarre/issues/38) | OPEN | Backlog |
| [[B19] Integrate through review](https://github.com/sysung/piarre/issues/39) | OPEN | Backlog |
| [[B20] Route commands through an optional local interpreter](https://github.com/sysung/piarre/issues/40) | OPEN | Backlog |
| [[B21] Verify with a different worker](https://github.com/sysung/piarre/issues/41) | OPEN | Backlog |
| [[B22] Pass the supervised-team release gate](https://github.com/sysung/piarre/issues/42) | OPEN | Backlog |
| [[B23] Track session task lists in a persistent pane](https://github.com/sysung/piarre/issues/48) | OPEN | Backlog |

The local work artifacts under `.artifacts/c-first-release/b-baseline` contain the full issue bodies, project fields, project items, and recent pull requests as JSON. That directory is ignored by Git. This tracked summary preserves the historical planning baseline and source links for future checkouts. Issue bodies can contain older planning status; actual issue state and project status are captured separately.

The reviewable-proposals change is merged. Bounded coding execution has an open pull request. This local checkout starts at the earlier durable-project implementation. Reconcile the live default branch and open work before implementing C.

B issues and the open pull request have not been closed or modified by this snapshot. C supersedes B as the proposed future delivery plan, while completed work and current work remain traceable.

## Subsequent backlog reconciliation

After this snapshot, twenty superseded B planning issues were closed as not planned, labeled `piarre-superseded`, and linked to C replacement or deferred-scope issues. Their cards and the three completed B cards were archived from Project 8. The existing bounded-execution review remains visible for reuse assessment. The active board now contains the C release epic, its eight work packages, and that preserved review. The C baseline work package is Ready. This retirement does not change the historical snapshot above or imply that C implementation is complete.

After the subsequent discussion, the bounded-execution pull request was also closed as superseded, its B issue was closed as not planned, and its project card was archived. The source branch was retained and verified available for C reuse assessment. The active board contains only the nine C items. Earlier paragraphs describe the historical state at each step.
