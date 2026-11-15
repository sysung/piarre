# Spec Delta

## MODIFIED Requirements

### Requirement: Inspect saved proposals

Piarre SHALL show saved goals newest first in compact cards and let the user inspect a proposal in a reusable pane beside Work. Reading state SHALL remain attached to the selected proposal across refreshes and SHALL NOT transfer to a different proposal, including one with identical displayed content.

#### Scenario: Open a saved proposal
- **WHEN** a user selects **Open proposal** on a saved goal
- **THEN** Piarre opens the proposal for inspection without saving, approving, or running it

#### Scenario: Refresh the same proposal
- **WHEN** a selected proposal refreshes without changing its identity
- **THEN** its valid disclosure, scroll and focus state remains available

#### Scenario: Select an identical-looking proposal
- **WHEN** the reused pane switches to another proposal with identical displayed content
- **THEN** the pane's identity and reading state belong to the newly selected proposal

### Requirement: Remove a saved goal

Piarre SHALL require confirmation before deleting a saved goal and its proposed tasks. Detail-pane deletion requests SHALL identify the current proposal and document; obsolete requests SHALL be rejected before confirmation. Confirmation SHALL remain bound to that proposal and the reviewed project state.

#### Scenario: Delete one goal
- **WHEN** a user selects **Delete goal** or **Delete goal and proposal** and confirms
- **THEN** the goal and its proposed tasks are removed from the active view while unrelated goals, repository files, and prior project history remain

#### Scenario: Receive a delayed request after selection changes
- **WHEN** a previous detail document sends a delete request after another proposal or document becomes current
- **THEN** Piarre ignores it without prompting for or deleting the new selection

#### Scenario: State changes during confirmation
- **WHEN** the project or proposal selection changes while deletion confirmation is open
- **THEN** confirming the old dialog cannot delete a different proposal or mutate an unreviewed project revision
