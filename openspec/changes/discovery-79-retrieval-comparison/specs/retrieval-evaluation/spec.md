# Specification delta

## Purpose

Define the observable experimental contract for issue #79 so that results preserve scope, provenance and uncertainty before any adoption decision.

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

#### Scenario: Unchanged control and exact symbols
- **WHEN** the experiment exercises unchanged control and exact symbols
- **THEN** Both arms return the expected source spans without baseline behavior drift.

#### Scenario: Paraphrase and incomplete dynamic relationship
- **WHEN** the experiment exercises paraphrase and incomplete dynamic relationship
- **THEN** Record a supported hit or an explicit miss/incomplete-coverage result; a missing edge does not prove no dependency.

#### Scenario: Accepted old decision versus new proposal, late history and conflict
- **WHEN** the experiment exercises accepted old decision versus new proposal, late history and conflict
- **THEN** Keep provenance and acceptance separate. Newer or more-used text never grants authority.

#### Scenario: Warm cache then source deletion, permission revocation or prohibition
- **WHEN** the experiment exercises warm cache then source deletion, permission revocation or prohibition
- **THEN** Refuse revoked/stale evidence and invalidate its derived cache entry.

#### Scenario: Dirty/renamed source, source changed during retrieval and project/environment collision
- **WHEN** the experiment exercises dirty/renamed source, source changed during retrieval and project/environment collision
- **THEN** Reject or report unavailable evidence with correct scope, never silently substitute another project or revision.

#### Scenario: Overflow, high fan-out, slow provider and stop
- **WHEN** the experiment exercises overflow, high fan-out, slow provider and stop
- **THEN** Honor request work/output limits, preserve partial constraint coverage, and distinguish cancellation request from observed completion.
