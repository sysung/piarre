# Specification delta

## Purpose

Define the observable experimental contract for issue #93 so that results preserve scope, provenance and uncertainty before any adoption decision.

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

#### Scenario: Unchanged exact+FTS5 control versus bounded relationships
- **WHEN** the experiment exercises unchanged exact+FTS5 control versus bounded relationships
- **THEN** Same frozen source and evidence budget; compare required-source recall, precision/applicability and expansion regressions per case.

#### Scenario: Paraphrased rationale and multi-file dependency
- **WHEN** the experiment exercises paraphrased rationale and multi-file dependency
- **THEN** Cite verified supporting blobs/spans or record a miss; extra retrieved text alone is not a supported answer.

#### Scenario: Natural dynamic dependency, synthetic injected edge and unavailable trace
- **WHEN** the experiment exercises natural dynamic dependency, synthetic injected edge and unavailable trace
- **THEN** Label static, observed and injected evidence separately. Never present a static edge as observed execution or missing edge as proof of no dependency.

#### Scenario: Changed/conflicting decision, rename/deletion, revocation and wrong project
- **WHEN** the experiment exercises changed/conflicting decision, rename/deletion, revocation and wrong project
- **THEN** Reject stale/unauthorized evidence or report incomplete coverage, including after warm lookup.

#### Scenario: Unanswerable question and deliberately wrong scorer/key mutation
- **WHEN** the experiment exercises unanswerable question and deliberately wrong scorer/key mutation
- **THEN** Abstain or report missing evidence. The scorer must fail the known-wrong control and retain per-case failures.

#### Scenario: Holdout exposed by tuning
- **WHEN** the experiment exercises holdout exposed by tuning
- **THEN** Promote the failed case to a named regression and replace the affected holdout family before confirmation; deterministic repetitions are not independent questions.
