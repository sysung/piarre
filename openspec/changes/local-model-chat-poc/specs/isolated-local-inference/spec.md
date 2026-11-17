## Purpose
Run a real local model while keeping agent file operations inside a disposable Linux workspace.

## ADDED Requirements

### Requirement: Use an explicitly configured local model
The application SHALL call the operator-configured local endpoint and model. The default Compose configuration and installer SHALL select MiniCPM5-2B; operators MAY override the model. It SHALL NOT silently download weights or fall back to a cloud provider.

#### Scenario: Model unavailable
- **WHEN** the configured model cannot load or the endpoint cannot be reached
- **THEN** the attempt reports the actual failure without substituting another provider

### Requirement: Keep agent work in a disposable container
The agent and its writable workspace SHALL run in the same disposable Linux container without personal host mounts, credentials, SSH agent, Docker socket or privileged mode. Only the designated workspace and bounded temporary storage SHALL be writable by the agent.

#### Scenario: Start the default environment
- **WHEN** the user launches the documented environment
- **THEN** the agent has a temporary workspace and no mounted Mac project or home directory

### Requirement: Check the actual environment
The PoC SHALL use real model inference for end-to-end observations. Workspace and mount checks SHALL inspect the actual environment; a fake endpoint SHALL NOT be a prerequisite.

#### Scenario: Inspect the workspace
- **WHEN** the operator checks the running container and performs a bounded file trial
- **THEN** changes are visible inside its workspace and teardown discards them

### Requirement: Permit model attempts without research admission
The operator SHALL be able to select a configured local model without benchmark, memory-score or cohort eligibility checks. Actual load and request failures SHALL remain visible.

#### Scenario: Model responds outside the former memory target
- **WHEN** a configured model can respond but has unknown or greater than 8 GB serving memory
- **THEN** the application does not reject it on that basis
