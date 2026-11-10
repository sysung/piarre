# Specification delta

## Purpose

Define the observable experimental contract for issue #87 so that results preserve scope, provenance and uncertainty before any adoption decision.

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

#### Scenario: Two edits then restore first content, including same-bytes control
- **WHEN** the experiment exercises two edits then restore first content, including same-bytes control
- **THEN** Reopen and verify a new monotonic revision/provenance. Identical bytes do not restore old permission or passing evidence.

#### Scenario: Restore selected skill only
- **WHEN** the experiment exercises restore selected skill only
- **THEN** Unrelated skills, memory, workspace files and other template copies retain identical hashes.

#### Scenario: Manual edit after preview, missing/forgotten content, rename/deletion or revoked scope
- **WHEN** the experiment exercises manual edit after preview, missing/forgotten content, rename/deletion or revoked scope
- **THEN** Refuse stale or unavailable targets with an inspectable outcome, without recovering forgotten data from a hidden copy.

#### Scenario: Symlink/path escape, missing asset and override conflict
- **WHEN** the experiment exercises symlink/path escape, missing asset and override conflict
- **THEN** Refuse an incomplete or out-of-scope restore; distinguish imported copy from linked original and repository from global override.

#### Scenario: Duplicate receipt, changed-payload retry, lost acknowledgment and crash checkpoints
- **WHEN** the experiment exercises duplicate receipt, changed-payload retry, lost acknowledgment and crash checkpoints
- **THEN** Use durable operation identity and reconcile after restart without duplicate restore or silent partial success.

#### Scenario: Queued launch, active/unknown writer and pinned session
- **WHEN** the experiment exercises queued launch, active/unknown writer and pinned session
- **THEN** Revalidate current dependency/authority at queued launch, keep running versions pinned, and block conflicting unknown writers. Historical verification remains historical.
