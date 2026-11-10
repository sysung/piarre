# Specification delta

## Purpose

Define the observable experimental contract for issue #91 so that results preserve scope, provenance and uncertainty before any adoption decision.

## ADDED Requirements

### Requirement: Reviewed and bounded preparation
The experiment SHALL run only the review-approved offline preparation under its declared source, data and authority boundaries. It SHALL require separate authorization for model downloads, inference, paid calls, human trials or consequential actions.

#### Scenario: Plan is published before approval
- **WHEN** this planning change is opened for review
- **THEN** implementation tasks remain pending and neither Apply nor Archive is reported complete

### Requirement: Version-bound evidence and honest outcomes
The experiment SHALL bind inputs and outcomes to immutable source, fixture and configuration identities. It SHALL preserve failed, blocked, unsupported and not-run cases and distinguish unknown telemetry from zero.

#### Scenario: Required evidence has not been collected
- **WHEN** model, resource or human evidence is required but unavailable
- **THEN** the result remains explicitly not run or blocked rather than becoming a passing mock result or a completed discovery

### Requirement: Story-specific behavior and failure controls
The experiment SHALL satisfy the following observable case outcomes without granting authority from source text, generated content or historical approval.

#### Scenario: Original wording, negation, quantities, scope and unknowns
- **WHEN** the experiment exercises original wording, negation, quantities, scope and unknowns
- **THEN** Human and agent views reference the same accepted identity/revision without strengthening the statement or hiding uncertainty.

#### Scenario: Dirty direct edit, old branch, rename/deletion and divergent accepted edits
- **WHEN** the experiment exercises dirty direct edit, old branch, rename/deletion and divergent accepted edits
- **THEN** Keep pending, accepted, disputed and unavailable states separate. Copied labels and saves do not confer adoption.

#### Scenario: Changed bytes during review, interrupted adoption, duplicate retry and reopen
- **WHEN** the experiment exercises changed bytes during review, interrupted adoption, duplicate retry and reopen
- **THEN** Accept only the exact reviewed version with one durable receipt, or refuse/reconcile explicitly.

#### Scenario: Tampered or missing accepted snapshot
- **WHEN** the experiment exercises tampered or missing accepted snapshot
- **THEN** Block a supposedly current handoff rather than substitute newer working bytes.

#### Scenario: Material correction, metadata-only import and missing impact links
- **WHEN** the experiment exercises material correction, metadata-only import and missing impact links
- **THEN** Stale explicitly bound work correctly, preserve unrelated records and historical provenance, and disclose incomplete coverage instead of claiming full impact.
