# Spec Delta

## Purpose

Define a targeted disagreement experiment that preserves accepted-intent authority and measures useful findings against their full review burden.

## ADDED Requirements

### Requirement: Independent expected behavior

The experiment SHALL preserve an immutable expected-behavior interpretation derived from frozen accepted intent before implementation, tests, and explanations are revealed. Its report SHALL identify evidence origin and dependence.

#### Scenario: Implementation changes the reviewer's understanding

- **WHEN** the reviewer revises an interpretation after seeing implementation
- **THEN** the initial interpretation remains available and the revision is recorded separately with its reason

### Requirement: Evidence-linked findings carry no acceptance authority

Each finding SHALL identify the claim, exact evidence, applicable intent identity/revision/hash, artifact revisions, conflict class, uncertainty, owning artifact, and proposed action. Findings SHALL NOT automatically change accepted intent or other artifacts.

#### Scenario: Code tests and documentation share a mistake

- **WHEN** those artifacts agree but conflict with applicable accepted intent
- **THEN** the finding identifies the conflict without using artifact majority as acceptance

#### Scenario: Evidence is missing

- **WHEN** the available links cannot establish a contradiction
- **THEN** the finding reports a coverage gap or cannot determine rather than demonstrated consistency or a defect

### Requirement: Risk determines proposed review depth

The comparison SHALL record tests-plus-ordinary-review and deterministic link/revision-check outcomes. Permissions, consequential contracts, data loss, recovery, or externally visible behavior SHALL trigger the proposed deeper-review condition. Each condition SHALL have a frozen time/token budget before measurement.

#### Scenario: Low-risk wording change

- **WHEN** a change has no consequential trigger
- **THEN** the experiment uses the cheap condition and records any incomplete impact coverage

#### Scenario: Recovery authority changes

- **WHEN** a case changes recovery authority
- **THEN** the experiment records the deeper condition's incremental findings, time, tokens, and budget exhaustion

### Requirement: Revision-bound repeat suppression

The experiment SHALL suppress repeated presentation of an unchanged finding bound to unchanged relevant artifact revisions. A changed relevant revision SHALL mark the old finding stale and require recheck. Suppression SHALL preserve the original finding and its history.

#### Scenario: Same finding appears again

- **WHEN** the same claim, scope, evidence, and relevant artifact revisions recur
- **THEN** the existing finding remains inspectable without creating another review demand

#### Scenario: Relevant revision changes

- **WHEN** a bound artifact changes
- **THEN** the old finding is stale and no longer counts as current evidence until rechecked

### Requirement: Incremental value includes missed defects and total attention

The report SHALL compare independently adjudicated findings by class, including false positives/negatives, false consistency claims, and missing coverage. It SHALL report incremental value and total reading, triage, investigation, correction, explanation, setup, and maintenance burden by review depth.

#### Scenario: More findings add no actionable value

- **WHEN** deeper review increases noise or burden without meeting frozen benefit thresholds
- **THEN** the report recommends narrowing to useful cheap checks or deferring rather than a mandatory gate
