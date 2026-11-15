# Design

## Context

OpenSpec lists eight legacy main specs. Their files match the pre-reset commit. The open PoC change contains six removal-only deltas, two replacement deltas, and three addition-only deltas. A deletion-only trial passed strict validation but reported that the two replacement deltas would fail at archive time because their targets were missing.

## Goals / Non-Goals

Keep the active catalog aligned with delivered behavior and keep historical requirements recoverable. Scope is limited to spec retirement, the dependent PoC delta rebase, and navigation.

## Decisions

- Land retirement and the PoC rebase together. Deferral keeps obsolete requirements discoverable until an uncertain PoC outcome. Early PoC sync would publish behavior ahead of its delivery review.
- Delete the eight main files explicitly so capability discovery is empty. Preserve the retirement deltas as the requirement-by-requirement record. Archive the retirement change with `--skip-specs` after verifying the deletions, since their effects are already applied.
- Keep the two PoC capability IDs. Combine their requirement sections under one `ADDED Requirements` heading per file and add a PoC-specific Purpose to each. Preserve every existing requirement and scenario body and keep current references valid.
- Point current documentation to the active PoC. Link historical rows to the pinned recovery revision. Preserve the archive and the original M0 evidence. Add a dated note for this decision.

## Risks / Trade-offs

- Strict validation can succeed while archive reports an inapplicable delta. Rehearse a normal PoC archive in a disposable copy and inspect the resulting catalog.
- Legacy links can survive in historical records. Preserve those records and direct readers to the recovery revision for the matching historical tree. Check live documentation and issue-linked capability paths.
- A concurrent change can alter the retirement scope. Compare the exact files and requirement headings against the reviewed plan before removal. Preserve unrelated model and runtime inventory work.

## Migration Plan

1. Confirm the recovery branch resolves to the pinned revision and compare each of the eight main files to its copy there. Validate the retirement deltas while the old catalog is present.
2. Stage the exact eight main spec deletions with the PoC rebase and navigation updates in one PR. Retain the current PoC task progress and delivery gates.
3. Verify empty main-spec discovery and the five-capability archive result described below. Archive the completed retirement change with spec updates skipped. Recheck status and submit the combined change for review.
4. Revert the retirement PR as a unit if rollback is required. If later work has already synchronized PoC specs, review the intervening changes before reverting.

## Verification Plan

| Check | Expected result |
|---|---|
| Recovery and exact scope | The eight main files and 21 legacy requirement headings match the retirement deltas and pinned recovery tree. |
| Active catalog | `openspec list --specs` reports zero capabilities after retirement. |
| Active PoC | Strict validation passes without archive applicability warnings. Apply instructions still show the same 28 tasks and preserve their completion states. |
| Scratch archive rehearsal | A normal archive of the rebased PoC in a disposable copy creates exactly `inference-evaluation`, `isolated-local-inference`, `poc-delivery`, `result-review`, and `typed-discussion`. Compare all 19 proposed requirement and scenario bodies with the pre-rebase PoC. Validate the five resulting main specs. |
| Review scope | Current links resolve, pre-existing archive bytes and unrelated inventories are preserved, and the real PoC remains active. |
