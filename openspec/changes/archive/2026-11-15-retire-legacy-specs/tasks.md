# Tasks

See the [verification plan](design.md#verification-plan) for expected results.

## 1. Verify the retirement baseline

- [x] 1.1 Check the recovery branch against the pinned commit and compare the exact eight tracked files and 21 requirement headings with the retirement deltas. Run strict validation before deleting the main specs.

## 2. Retire the catalog and rebase the PoC together

- [x] 2.1 Remove the eight main specs named by this change. Verify the deletion diff matches the reviewed paths and OpenSpec lists zero main capabilities.
- [x] 2.2 Drop the six removal-only PoC deltas. Convert `result-review` and `typed-discussion` to additions with PoC-specific Purpose sections. Compare all 19 proposed requirement and scenario bodies with their originals and strictly validate the rebased change.
- [x] 2.3 Update the PoC proposal, design, scope map, and any affected task notes. Update README and workflow and domain navigation. Append a retirement note referencing the pinned history. Check current links and verify all 28 PoC task states are preserved.

## 3. Verify the combined result

- [x] 3.1 Rehearse ordinary PoC archive in a disposable copy. Verify the five expected capability IDs, preserved proposed requirements, and strict validation of the resulting main specs.
- [x] 3.2 Review the complete diff against the retirement scope. Verify the pre-existing archive and unrelated inventories are preserved and the real PoC still appears in the active change list.

## Workflow follow-up

- Track implementation under an issue-linked branch. Keep the retirement and rebase in the same PR.
- After verifying the applied deletions, archive this completed retirement change with `--skip-specs` to preserve its deltas without reapplying them. Verify the archived record and empty main catalog. Keep the real PoC open until its existing delivery gates are satisfied.
