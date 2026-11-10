# Specification delta

## Purpose

Define the observable experimental contract for issue #83 so that results preserve scope, provenance and uncertainty before any adoption decision.

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

#### Scenario: Start fresh, Skip for now and import later
- **WHEN** the experiment exercises start fresh, Skip for now and import later
- **THEN** The user can continue without import and later select a source, preview conflicts, select mappings and save a copied proposal; the source stays unchanged.

#### Scenario: Duplicate names, repeated import, changed source and missing assets
- **WHEN** the experiment exercises duplicate names, repeated import, changed source and missing assets
- **THEN** Expose stable identity, scope, mapping/conflict and unsupported-format information; never silently convert unknown fields or overwrite sources.

#### Scenario: Template, session copy, skills, principles and enforced permissions
- **WHEN** the experiment exercises template, session copy, skills, principles and enforced permissions
- **THEN** Show these as distinct concepts. Distinguish skill availability, loading, invocation and unknown coverage; passive instructions do not enforce permissions.

#### Scenario: Queued copy after template/dependency edit, active copy and unknown writer
- **WHEN** the experiment exercises queued copy after template/dependency edit, active copy and unknown writer
- **THEN** Revalidate exact revisions, current authority and workspace-wide writer contention before launch; active copies stay pinned. Lost stop acknowledgment remains uncertain.

#### Scenario: Composition, criterion evidence and aggregate budgets
- **WHEN** the experiment exercises composition, criterion evidence and aggregate budgets
- **THEN** Bind immutable reviewer input and criterion pass/fail/untested/needs-human-judgment to dependency/model/provider/evaluator hashes. Detect dropped constraints even when individual skills pass.

#### Scenario: Optional test after saving
- **WHEN** the user saves the copied proposal and chooses to test it or skip
- **THEN** only an approved offline verification fixture can record criterion outcomes, and skipping keeps behavioral coverage untested without granting launch authority
