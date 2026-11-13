# Proposal

## Why

Repository navigation exposes generated output and duplicate historical text, while project opening, result acceptance and reused detail panes spread identity and ownership rules across callers. Source inspection found failure paths worth reproducing before refactoring; this change makes those rules explicit while preserving documentation and recovery authority.

## What Changes

- Hide generated output through reversible workspace editor settings and exclude only archived source snapshots from routine search. Preserve archive indexes, active specs, skill discovery, tests and Git tracking.
- Remove two redundant empty OpenSpec placeholders, remove inactive config examples, and shorten the initial README view with collapsible detail sections. Preserve commands, recovery/privacy qualifications, source snapshots and all acceptance mappings. Keep overview and workflow. Add a compact principles index; retain the dated research note intact rather than introduce a second summary to maintain.
- Make failed and superseded project openings release their own resources without leaving a closed repository selected or publishing obsolete controllers and errors.
- Let a user explicitly accept a successfully recovered integration without starting another source publication. Recheck the reviewed result and current evidence before accepting it.
- Bind detail-pane documents, cached rendering and messages to the selected record. Share only genuinely duplicated document mechanics; preserve pane-specific behavior and unsent Work text.
- Evaluate narrow private publication deduplication and removal of test-only coordinator restore entry points after equivalent production-path coverage exists. Do not change persisted events or journal formats.
- Use behavioral TDD for correctness changes, followed by focused Host verification and documentation-preservation checks. Keep independent stages independently reviewable.

## Capabilities

### New Capabilities

None. Editor visibility and documentation organization are contributor tooling covered by the design verification plan.

### Modified Capabilities

- `project-state`: failed, superseded and disposed opening attempts cannot leave or replace the selected project with invalid resources.
- `result-review`: recovered integrations remain unreviewed until explicit, current acceptance; acceptance does not republish files.
- `goal-proposals`: reused detail panes isolate record state and reject messages from obsolete documents before confirmation or dispatch.

## Impact

Primary files are `apps/vscode/src/extension.ts`, `execution-coordinator.ts`, `execution-ui.ts`, `execution-view.ts`, and `work-view.ts`, plus focused Host tests. Contributor changes affect `.vscode/settings.json`, README, the principles index, OpenSpec template comments and empty placeholders. No dependency, database, journal, provider-consent or package-format change is planned.

## History

- Created: 2026-11-13T07:03:24Z.
- Outcome: implemented as an unmerged four-PR stack. Local integrated verification, independent review, and hosted CI passed. Native keyboard-focus verification also passed after desktop access was restored; all 23 implementation tasks are complete. Human acceptance remains pending.
- Origin: repository cleanup exploration and three-worker source review in this conversation.
- Planning home: the original Piarre checkout resolved by OpenSpec. It is older than the audited implementation and contains unrelated untracked planning material.
- Audited code baseline: `0119a55cccc2b4cc199222351e4cfb5e7bf5daf2`, branch `codex/121-archive-documentation`, following documentation migration PR #122 and archive PR #123.
- Delivery: [issue #124](https://github.com/sysung/piarre/issues/124) and stacked PRs [#125](https://github.com/sysung/piarre/pull/125), [#126](https://github.com/sysung/piarre/pull/126), [#127](https://github.com/sysung/piarre/pull/127), and [#128](https://github.com/sysung/piarre/pull/128). The [verification index](verification/index.md) records exact reviewed commits, CI, and V01–V12 outcomes. Migration issue #121 was not reused.
- Prerequisite: apply against a clean checkout containing the consolidated documentation and archive; revalidate source findings if code has advanced.
- Implementation commits published: 2026-11-13. Human acceptance, merge, and archive: pending. The 17 retained pending product criteria remain pending.
