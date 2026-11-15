# Spec Delta

## ADDED Requirements

### Requirement: Recover from failed project opening

Piarre SHALL leave no unusable selected project after opening fails. The user SHALL be able to retry opening or select another trusted repository without reloading the extension. Failed opening SHALL preserve recorded project data and uncertain execution ownership.

#### Scenario: Reconciliation fails during opening
- **WHEN** opening fails after allocating project resources because a persisted execution capture is unavailable
- **THEN** no command or visible control continues using the failed selection
- **AND** a later opening attempt can succeed after the cause is resolved or another repository is selected
- **AND** the failure does not erase execution history or grant replacement execution

### Requirement: Ignore obsolete project opening completions

Piarre SHALL prevent an opening attempt superseded by repository selection or extension disposal from changing current controls, delivering results to the new selection, or showing obsolete errors. Retired resources SHALL be released without disrupting the current selection.

#### Scenario: Switch repositories during delayed recovery
- **WHEN** opening repository A is delayed and repository B becomes the current selection before A completes
- **THEN** A's completion or error cannot replace B's controls or route a command through A

#### Scenario: Dispose during opening
- **WHEN** the extension is disposed before an opening attempt completes
- **THEN** that attempt cannot create or republish controls after disposal
