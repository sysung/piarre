# Goal Proposals Specification

## Purpose

Reviewable drafts and saved proposals for submitted goals.

Sources: [Product PRD](../../changes/archive/2026-11-13-legacy-documentation/sources/planning-head/docs/01_PRODUCT_PRD.md#work-and-user-authority), [technical design](../../changes/archive/2026-11-13-legacy-documentation/sources/planning-head/docs/02_TECHNICAL_DESIGN.md#execution-and-approval), and [workspace.test.ts](https://github.com/sysung/piarre/blob/a16447a9dbeac224d1ffc1c793fb1a14ea12576a/apps/vscode/test/suite/workspace.test.ts).

## Requirements

### Requirement: Preview and save separately

Piarre SHALL preserve the submitted goal and require explicit save before persisting an unapproved proposal.

#### Scenario: Review a typed goal

- **WHEN** a user selects **Review goal** for their typed goal
- **THEN** Piarre prepares a deterministic draft and leaves project history and repository files unchanged
- **AND** selecting **Save proposal** records the proposal without starting work

### Requirement: Invalidate outdated previews

Piarre SHALL reject a preview if its input or project revision has changed or the user discards it. Unsent text SHALL stay in the panel and be discarded when the panel closes.

#### Scenario: Edit a goal during preview

- **WHEN** a user edits the goal before a delayed preview completes
- **THEN** the old preview cannot be saved

### Requirement: Inspect saved proposals

Piarre SHALL show saved goals newest first in compact cards and let the user inspect a proposal in a reusable pane beside Work.

#### Scenario: Open a saved proposal

- **WHEN** a user selects **Open proposal** on a saved goal
- **THEN** Piarre opens the proposal for inspection without saving, approving, or running it

### Requirement: Remove a saved goal

Piarre SHALL require confirmation before deleting a saved goal and its proposed tasks.

#### Scenario: Delete one goal

- **WHEN** a user selects **Delete goal** or **Delete goal and proposal** and confirms
- **THEN** the goal and its proposed tasks are removed from the active view while unrelated goals, repository files, and prior project history remain
