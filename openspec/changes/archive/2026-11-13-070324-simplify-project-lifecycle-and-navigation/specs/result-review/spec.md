# Spec Delta

## MODIFIED Requirements

### Requirement: Require user acceptance

Piarre SHALL distinguish run completion, criterion verification, and user acceptance. A successfully recovered integration SHALL remain unreviewed until explicit acceptance. Acceptance of that integration SHALL verify the reviewed result and current source, candidate and check evidence without publishing source changes again.

#### Scenario: Complete a run with passing checks
- **WHEN** a run produces current evidence that satisfies its criteria
- **THEN** the result remains available for review until the user explicitly accepts it

#### Scenario: Accept a recovered integration
- **WHEN** restart establishes that the reviewed integration completed and the user confirms acceptance of the still-current result
- **THEN** Piarre records acceptance without another source publication
- **AND** repeated acceptance cannot create duplicate effects

#### Scenario: Evidence changes while acceptance is reviewed
- **WHEN** source contents, candidate contents, result identity, or applicable check evidence changes before acceptance commits
- **THEN** acceptance is refused and current files remain unchanged

#### Scenario: Cancel acceptance after recovery
- **WHEN** the user cancels review of a recovered integration
- **THEN** its acceptance remains unreviewed and no publication starts

## ADDED Requirements

### Requirement: Bind detail review controls to the current record

Piarre SHALL reject result-detail actions from a replaced project, selected result, or rendered document before confirmation or dispatch. Valid reading state SHALL survive same-record refreshes and SHALL NOT transfer to another record. Host validation SHALL remain authoritative even for a current document.

#### Scenario: A reused pane receives an old result action
- **WHEN** a detail pane switches from run A to run B and an action from A's old document arrives
- **THEN** neither run is mutated and no confirmation for B is opened

#### Scenario: A current document requests an unrelated action
- **WHEN** a current detail document requests a command or target not represented by its authorized controls
- **THEN** Piarre rejects the request without changing project state

#### Scenario: Refresh current review evidence
- **WHEN** a result detail refreshes for the same record
- **THEN** valid disclosure, scroll and focus state remains available while messages from the replaced document are ignored
