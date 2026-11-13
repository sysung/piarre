# Approved Execution Specification

## Purpose

Bounded coding runs with explicit consent and ownership across failures.

Sources: [Product PRD](../../changes/archive/2026-11-13-legacy-documentation/sources/planning-head/docs/01_PRODUCT_PRD.md#work-and-user-authority), [technical design](../../changes/archive/2026-11-13-legacy-documentation/sources/planning-head/docs/02_TECHNICAL_DESIGN.md#execution-and-approval), [execution state tests](https://github.com/sysung/piarre/blob/a16447a9dbeac224d1ffc1c793fb1a14ea12576a/apps/vscode/test/suite/execution-state.test.ts), and [cost tests](https://github.com/sysung/piarre/blob/a16447a9dbeac224d1ffc1c793fb1a14ea12576a/apps/vscode/test/suite/costs.test.ts).

## Requirements

### Requirement: Bind approval to reviewed scope

Piarre SHALL bind generation approval to the reviewed plan, provider context, forecast, and attempt.

#### Scenario: Change provider context before generation

- **WHEN** the selected provider account or configuration changes after review
- **THEN** the earlier approval cannot start generation under the changed context

### Requirement: Keep uncertain ownership

Piarre SHALL retain exclusive run ownership until reconciliation establishes that replacement execution is safe.

#### Scenario: Lose a provider acknowledgment

- **WHEN** the provider has not established a terminal outcome and Piarre restarts
- **THEN** the uncertain run remains visible and replacement execution is blocked

### Requirement: Disclose missing estimates

Piarre SHALL distinguish API estimates from subscription usage projections and report unknown costs or usage when required inputs are missing.

#### Scenario: Estimate without matching calibration

- **WHEN** the selected subscription has no matching calibration or applicable estimate
- **THEN** the projection remains unknown
