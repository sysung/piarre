## Purpose

Bind local-model PoC evidence to the configuration reviewed and record explicit human acceptance.

## ADDED Requirements

### Requirement: Bind checks to reviewed results
PoC evidence SHALL identify the evaluated source revision, model artifact, runtime, configuration, and verification steps. Configuration changes SHALL make prior evidence historical rather than current.

#### Scenario: Change the candidate after a passing check
- **WHEN** the model, runtime, harness, or isolation configuration changes
- **THEN** prior acceptance evidence cannot qualify the changed setup without applicable rechecks

### Requirement: Require user acceptance
Piarre SHALL distinguish implementation completion, measured results, and explicit human PoC acceptance.

#### Scenario: Complete a run with passing checks
- **WHEN** all implementation and measurement checks pass
- **THEN** the PoC remains unaccepted until the user records a decision after UAT

