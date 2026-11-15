## Purpose
Run pinned local models with explicit provisioning, restricted access, and measurable resource use on a developer machine.

## ADDED Requirements

### Requirement: Separate provisioning from conversation
The system SHALL use an explicitly provisioned local model and endpoint. Chat SHALL NOT download models, select a remote provider, or enable cloud fallback.

#### Scenario: Missing local model
- **WHEN** the configured model is absent
- **THEN** chat stops with a provisioning instruction without downloading or contacting a remote model

### Requirement: Restrict harness access
The harness SHALL expose no execution tools, inherit no personal files or credentials, and use only approved inference connectivity and dedicated session storage. Isolation acceptance SHALL precede use of personal input.

#### Scenario: Model requests execution
- **WHEN** a reply requests a command, file access, or tool call
- **THEN** the reply remains inert text and no operation occurs

#### Scenario: Isolation is unverified
- **WHEN** approved containment checks cannot establish the required access limits
- **THEN** the environment remains unqualified and testing is restricted to synthetic data

### Requirement: Qualify total serving memory
A qualifying configuration SHALL remain below 8,000,000,000 bytes of attributed peak serving memory, including model weights, caches, runtime buffers, and serving processes. Missing accounting SHALL produce an unknown result, not a pass. Build and test memory SHALL be separate.

#### Scenario: Peak exceeds limit
- **WHEN** a declared workload reaches or exceeds the limit
- **THEN** the configuration is ineligible and its measurements remain in the report


### Requirement: Qualify the actual execution path
A surrogate check SHALL qualify only its probe environment. Each actual runtime/client route SHALL pass containment checks before measurement, and the final harness image SHALL pass before personal chat. Configuration changes SHALL invalidate the affected qualification.

#### Scenario: Runtime changes after preparation
- **WHEN** a different native server or client route is selected
- **THEN** prior surrogate evidence cannot qualify it and synthetic containment checks precede use
