## Purpose

Bind local-model PoC evidence to the configuration reviewed and record explicit human acceptance.

## ADDED Requirements

### Requirement: Bind checks to reviewed results
PoC notes SHALL identify the application revision, model/runtime and observed steps where available. Unknown values SHALL remain unknown. Recheck behavior affected by a configuration change; unrelated edits do not invalidate observations.

#### Scenario: Change the candidate after a passing check
- **WHEN** the model, runtime, harness, or isolation configuration changes
- **THEN** the notes identify the new setup and the behavior that needs another observation

### Requirement: Require user acceptance
Piarre SHALL distinguish implementation completion, observed results, and explicit human PoC acceptance.

#### Scenario: Complete a run with passing checks
- **WHEN** the implementation and manual checks succeed
- **THEN** the PoC remains unaccepted until the user records a decision after UAT

