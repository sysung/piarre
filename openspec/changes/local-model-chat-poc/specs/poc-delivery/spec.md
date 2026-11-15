## Purpose
Deliver the local-model PoC through recoverable cleanup, reviewable work planning, and evidence-based milestone acceptance.

## ADDED Requirements

### Requirement: Reset with verified recovery
Legacy removal SHALL follow a verified recovery reference and human approval of an exact tracked-path deletion manifest. Git history, unrelated work, credentials, legacy user data, and retained planning infrastructure SHALL be preserved.

#### Scenario: Manifest no longer matches
- **WHEN** tracked files or unrelated work change after manifest review
- **THEN** cleanup stops for a refreshed diff rather than expanding the approved deletion scope

### Requirement: Plan all milestones in preparation
M0 SHALL provide tasks for M0–M3 with descriptions, user value, human verification, native blockers, milestone assignment, and user-story parentage. Provisional tasks SHALL identify unresolved inputs. GitHub publication SHALL require review of the proposed records.

#### Scenario: Runtime choice changes
- **WHEN** research invalidates a later task assumption
- **THEN** its scope and dependencies are revised while affected work remains unready

### Requirement: Preserve milestone gates
M0 SHALL require environment and plan agreement; M1 SHALL require qualified inference evidence; M2 SHALL require a working chat route; M3 SHALL require explicit user acceptance. Automation SHALL NOT substitute code completion for PoC acceptance.

#### Scenario: Implementation is merged
- **WHEN** chat implementation completes before human UAT
- **THEN** the PoC acceptance item remains open and unapproved


### Requirement: Require positive evidence for progression
Closing a prerequisite SHALL NOT substitute for a qualifying outcome. M2 SHALL require a positive selected-configuration record; M3 SHALL require a qualified harness build. A rejected experiment SHALL remain distinguishable from accepted UAT even when its issue is closed.

#### Scenario: Selection ends with no qualifying model
- **WHEN** M1 records no-go and closes its research ticket
- **THEN** M2 remains blocked until a separately reviewed positive qualification exists
