# Project Knowledge Specification

## Purpose

Inspectable knowledge with source history and reviewed corrections.

Sources: [Product PRD](../../changes/archive/2026-11-13-legacy-documentation/sources/planning-head/docs/01_PRODUCT_PRD.md#memory-and-the-recommendation-view), [technical design](../../changes/archive/2026-11-13-legacy-documentation/sources/planning-head/docs/02_TECHNICAL_DESIGN.md#memory-and-recommendations), and [knowledge.test.ts](https://github.com/sysung/piarre/blob/a16447a9dbeac224d1ffc1c793fb1a14ea12576a/apps/vscode/test/suite/knowledge.test.ts).

## Requirements

### Requirement: Preserve observation provenance

Piarre SHALL retain the exact submitted wording and source for observations and require human confirmation to promote them.

#### Scenario: Record an observation

- **WHEN** Piarre records a submitted statement
- **THEN** the original wording remains inspectable and the observation stays unconfirmed

### Requirement: Invalidate affected work on correction

Piarre SHALL record confirmed corrections as new revisions and invalidate affected work while preserving unrelated work.

#### Scenario: Correct a task premise

- **WHEN** a user confirms a correction linked to an existing task
- **THEN** the affected work reflects the correction and its earlier evidence remains historical
