## Purpose
Run a real local model with an isolated Linux container and an opt-in persistent workspace.

## ADDED Requirements

### Requirement: Use an explicitly configured local model
The application SHALL call the operator-configured local endpoint and model. The default Compose configuration and installer SHALL select MiniCPM5-2B; operators MAY override the model. It SHALL NOT silently download weights or fall back to a cloud provider.

#### Scenario: Model unavailable
- **WHEN** the configured model cannot load or the endpoint cannot be reached
- **THEN** the attempt reports the actual failure without substituting another provider

### Requirement: Keep agent work in a disposable container
The agent SHALL run in an isolated Linux container without credential mounts, SSH agent, Docker socket or privileged mode. Plain chat SHALL mount no host folders. The workspace Compose override SHALL mount only the selected existing host folder at `/workspace` for read-write access under OS permissions. The flag `--workspace DIRECTORY` SHALL select the file access root in that mount. Bounded temporary storage SHALL be the only other writable location.

#### Scenario: Start the default environment
- **WHEN** the user launches plain chat
- **THEN** no host workspace is mounted

#### Scenario: Select an existing host directory
- **WHEN** the user starts Compose with an existing host folder and selects `--workspace DIRECTORY`
- **THEN** the selected folder is mounted for the session and its files remain on the host after the container exits

### Requirement: Check the actual environment
The PoC SHALL use real model inference for end-to-end observations. Workspace and mount checks SHALL inspect the actual environment; a fake endpoint SHALL NOT be a prerequisite.

#### Scenario: Inspect the workspace
- **WHEN** the operator runs a bounded file trial against a selected fixture folder and exits the container
- **THEN** the resulting file changes are observable in the original host folder and in a new session using it

### Requirement: Permit model attempts without research admission
The operator SHALL be able to select a configured local model without benchmark, memory-score or cohort eligibility checks. Actual load and request failures SHALL remain visible.

#### Scenario: Model responds outside the former memory target
- **WHEN** a configured model can respond but has unknown or greater than 8 GB serving memory
- **THEN** the application does not reject it on that basis
