# Project State Specification

## Purpose

Durable project identity, revisions, and command receipts for the selected trusted Git repository.

Sources: [Product PRD](../../changes/archive/2026-11-13-legacy-documentation/sources/planning-head/docs/01_PRODUCT_PRD.md#work-and-user-authority), [technical design](../../changes/archive/2026-11-13-legacy-documentation/sources/planning-head/docs/02_TECHNICAL_DESIGN.md#ownership-and-data), and [project.test.ts](https://github.com/sysung/piarre/blob/a16447a9dbeac224d1ffc1c793fb1a14ea12576a/apps/vscode/test/suite/project.test.ts).

## Requirements

### Requirement: Restore project state

Piarre SHALL show the project name, ID, and revision in Work for the selected trusted Git repository. It SHALL store the event log in VS Code extension storage outside that repository and restore project identity, name, and revision on reload.

#### Scenario: Reopen a renamed project

- **WHEN** a user runs **Piarre: Rename Project** and reloads VS Code
- **THEN** Piarre restores the same project identity and recorded name

### Requirement: Reject stale writes and replay receipts

Piarre SHALL persist a durable change before acknowledging it and return the original receipt for a duplicate command.

#### Scenario: Retry after an intervening write

- **WHEN** a committed command is retried after the project advances
- **THEN** Piarre returns the original receipt without appending effects, and a distinct command using the stale revision is rejected
