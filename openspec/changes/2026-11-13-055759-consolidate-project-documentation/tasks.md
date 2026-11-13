# Tasks

Use the canonical [verification plan](design.md#verification-plan). Evidence identifies one Piarre revision containing code and documentation. Completed baseline work is retained. Destination-dependent tasks are reopened because their staged outputs must be integrated and checked in Piarre; this does not discard the existing snapshots, guides or test work.

## 1. Preserve the baseline and existing work

- [x] 1.1 Preserve the original dirty checkout, verify the remote target and establish issue #121 and isolated branch `codex/121-consolidate-documentation`; verify preserved bytes and record target `8a8b7ab38d9cb0d272389ef89a089e5cee9b7832`.
- [x] 1.2 Inventory legacy passages, draft specs, acceptance scenarios and historical sources; verify 26 snapshot hashes, all 255 nonblank target lines, 21 catalog rows and the historical Git objects with the captured manifest and disposition map (V01, V05).

## 2. Integrate consolidated documentation in Piarre

- [x] 2.1 Copy the staged guides and complete OpenSpec corpus into the isolated Piarre checkout, preserving this revised plan over older staged copies; verify snapshot hashes, inventory equality and local root/child CLI context without a registered Store (V01, V02).
- [x] 2.2 Keep README usage instructions and `docs/overview.md`, `docs/workflow.md`, dated research and `docs/USER_DESIGN_PRINCIPLE.md`; update local navigation and verify the requested principles rename plus first-use, candidate, diagnostic and reflection coverage (V09).
- [x] 2.3 Retain the staged authority policy, passage dispositions, four imported automated contracts and 17 pending criteria; verify exact wording/ownership/status and the user-resolution rule for issue/spec conflicts, leaving memory capture explicitly open (V01, V10).

## 3. Adapt source validation with TDD

- [x] 3.1 Adapt the staged resolver to the local Piarre root and a single revision, removing the external lock/checkout dependency; use focused red/green cases for clean acceptance, missing/inaccessible files, unavailable revisions, dirty acceptance, changed source and explicitly unverified preview (V03).
- [x] 3.2 Retain exact requirement/scenario identity and path-containment checks, migrate live catalog references, and verify missing headings, unrelated identities and escaping paths fail with the scenario ID; compare every unchanged acceptance field against the baseline (V04).
- [x] 3.3 Integrate the same resolver into acceptance reporting and the contract suite; verify reports bind sources to the code revision, detect changes during collection and never promote preview to passed acceptance (V03, V04, V08).
- [x] 3.4 Retain original principles and retrieval revision/path/hash tuples and missing-history diagnostics; verify both historical PRD hashes, all ten retrieval inputs and byte-identical fixture inventories (V05).
- [x] 3.5 Adapt CI and contributor instructions to one checkout with sufficient Git history; remove staged second-checkout, lock and deploy-key use, then verify a fresh clone can run the documented checks without external docs access (V02, V03, V05).

## 4. Retain history and canonical verification

- [x] 4.1 Integrate the staged UTC ID and lifecycle-history guidance into local docs; reuse and rerun chronology/collision fixtures as needed, verifying stable archived IDs and distinct creation, acceptance and archive order (V07, V08).
- [x] 4.2 Integrate the byte-preserved legacy archive and abandoned-discovery procedure; verify archive skip-sync behavior retains main-spec bytes, snapshots, explicit outcomes and truthful unfinished tasks in the local layout (V01, V06).
- [x] 4.3 Link workflow guidance and issue #121 to the single canonical verification plan; verify task/decision traceability and that failed or unverified outcomes remain incomplete (V11).

## 5. Finish local consumers and publication

- [x] 5.1 Replace the exact-four-documents test with local entry-point and reference contracts using red/green tests; retire the legacy live index/PRD/design only after snapshots and replacement consumers pass, then verify all local links (V04, V09).
- [x] 5.2 Keep repository-local OpenSpec configuration and supported generated integrations; verify root/child context/list/doctor identify Piarre and that no Store pointer or documentation lock remains in the delivered branch (V02).
- [x] 5.3 Publish one implementation PR referencing issue #121 and the change, record originating/implementation links and single-revision evidence, and verify remote readback while leaving unmerged/unknown events pending (V08).

## 6. Verify the integrated migration

- [x] 6.1 Execute V01–V12 against the final Piarre revision, including contract tests, applicable project quality checks and strict selected OpenSpec validation; deliver outcomes, commands and evidence with any historical exceptions or accepted limitations explicitly identified.
- [x] 6.2 Exercise rollback in an isolated fixture and review navigation, authority and semantic coverage; verify the prior paths and source checks are restored, preserved history survives and failed criteria are not reported complete (V09–V12).

## Workflow follow-up

- Present the single implementation PR and verification evidence for final review.
- Archive after implementation, applicable verification and review are complete; verify the archived ID, location and history links.
- Retain the obsolete external setup as recorded history. The private docs repository, deploy key and Actions secret are not dependencies of this design. Any remote deletion or credential revocation requires a separately scoped cleanup decision.

## Superseded work retained

Earlier task 1.3 created the private repository and read-only CI access; earlier task 2.1 tested Store registration. Those tasks are removed from required progress because the user superseded that architecture. Staged consolidation, provenance and archive tests remain reusable. Earlier checked destination-dependent tasks are reopened above for the single-repository integration instead of being counted as already delivered.
