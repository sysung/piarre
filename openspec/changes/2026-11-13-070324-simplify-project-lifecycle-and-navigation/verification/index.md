# Lifecycle and navigation verification

The change is implemented in four unmerged PRs for [issue #124](https://github.com/sysung/piarre/issues/124). Native keyboard-focus verification passed after desktop access was restored and the isolated test editor was activated. All 23 tasks are complete. Automated checks do not establish human acceptance or satisfy the 17 retained pending product criteria.

## Delivery revisions

| Stage | PR and base | Reviewed revision | CI |
| --- | --- | --- | --- |
| Contributor navigation | [#125](https://github.com/sysung/piarre/pull/125) targets `master` | `24d13e78955c380541fba41b33011f24006bf1e4` | [Passed, attempt 2](https://github.com/sysung/piarre/actions/runs/43386540305/attempts/2) |
| Project lifetime | [#126](https://github.com/sysung/piarre/pull/126) targets Stage 1 | `ecde976e0447d59b8928c9f47e0c0a98aefd1b95` | [Passed](https://github.com/sysung/piarre/actions/runs/43390920973) |
| Result acceptance | [#127](https://github.com/sysung/piarre/pull/127) targets Stage 2 | `b33f06473e71c077a0c8f7c4af86564d9c59151c` | [Passed](https://github.com/sysung/piarre/actions/runs/43392955535) |
| Detail identity | [#128](https://github.com/sysung/piarre/pull/128) targets Stage 3 | Runtime `e78f5bd7de87d4688839c5e541a366a62915ae65`; final test revision `7d0d9bb93af4ecbfa0230588a5240016bc536f95` | [Passed](https://github.com/sysung/piarre/actions/runs/43396944960) |

Root verified that remote `master` remains `c6640f9cd9c6ed6144e6855b7e682327e8aef3d9`. The original user checkout and its unrelated planning files remain untouched. Project 8 attachment was blocked because the available token lacked `read:project`; authentication was not changed. None of the PRs was merged, and the OpenSpec change was not archived.

## Evidence index

| ID | Status | Evidence and limit |
| --- | --- | --- |
| V01 | Passed | [Stage 1 baseline](stage-1.md#baseline-verification) records the clean consolidated tree and caller inventory. |
| V02 | Passed | [Stage 1 preservation](stage-1.md#documentation-preservation) proves wrapper-stripped equality and rendered links. [Stage 4 receipts](stage-4.md#verification-receipts) repeat archive checks and compare the preserved files to Stage 1. All 26 snapshots and 21 catalog mappings remain unchanged. |
| V03 | Passed | [Stage 1 editor checks](stage-1.md#editor-verification) use actual Explorer and Search, including reversible historical search. |
| V04 | Passed | [Stage 2 behavior](stage-2.md#behavioral-evidence) proves partial-open cleanup and immediate retry in the Host. |
| V05 | Passed | [Stage 2 continuations](stage-2.md#continuation-inventory) and Host cases cover stale completion, repository replacement, throwing cleanup, native prompts, and retired visits. |
| V06 | Passed | [Stage 2 behavior](stage-2.md#behavioral-evidence) preserves Stop, unknown ownership, late provider settlement, and journal exclusion. |
| V07 | Passed | [Stage 3 acceptance](stage-3.md#behavioral-evidence) proves explicit recovered acceptance with one publication, checkpoint, and acceptance event, plus effect-free exact replay. |
| V08 | Passed | [Stage 3 evidence binding](stage-3.md#behavioral-evidence) covers source, candidate, dirty buffers, result, plan, applicable checks, and concurrent confirmations. |
| V09 | Passed | [Stage 3 recovery](stage-3.md#shape-and-cleanup-decisions) removes the unused restore API after production-path proof, preserving historical journal and receipt behavior. |
| V10 | Passed | [Stage 4 authority](stage-4.md#behavior-and-authority) uses actual rendered clicks, captured envelopes, selection changes, native prompts, durable revisions, and positive paths. |
| V11 | Passed | [Stage 4 reading state](stage-4.md#reading-state-and-its-limits) verifies browser DOM mechanics, repeated controls, different-record reset, Work draft privacy, responsive Stop, and proposal-marker clearing. The native-focus mode passed 67 trusted and one restricted tests at `20edee5954542ce23b26a9fe2dddc5773ddd6639`, requiring real focus before and after refresh. Styles including reduced motion are byte-preserved. |
| V12 | Passed | [Stage 4 receipts](stage-4.md#verification-receipts) record passing package, contracts, preservation, and strict validation. The independent final-head Host run passed 365 trusted and one restricted test. Independent architecture, comments, final test coverage, and index review passed. Hosted CI passed on the exact final test revision, including package installation. |

Native prompt tests inspect the production API call and supply controlled answers. They do not claim pixel interaction with OS dialogs. Deterministic provider fixtures make no external request and incur no spend. Human product acceptance remains separate from every automated result above.
