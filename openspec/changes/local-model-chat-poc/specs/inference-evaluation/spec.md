## Purpose
Make runtime and small-model choices from reproducible local measurements without overstating their scope.

## ADDED Requirements

### Requirement: Freeze comparison conditions
Each comparison SHALL record exact artifacts, runtime versions, quantization, templates, context, hardware, settings, workload, and measurement method before scoring. Runtime comparisons SHALL hold the model artifact fixed where supported; incompatible formats SHALL be labeled whole-stack comparisons.

#### Scenario: Different quantization formats
- **WHEN** two runtimes require different quantized artifacts
- **THEN** the report does not attribute the observed difference solely to runtime speed

### Requirement: Report complete outcomes
Reports SHALL include first-token latency, generation rate, peak memory, repetitions, warm/cold conditions, errors, exclusions, and model-quality results where applicable. Failed or incomplete runs SHALL NOT silently disappear.

#### Scenario: Candidate fails to load
- **WHEN** a candidate cannot complete the workload
- **THEN** its failure and reason appear alongside successful candidates

### Requirement: Bound evaluation claims
The PoC SHALL use model-level coding evaluation separately from runtime timing and human usability. It SHALL NOT claim repository-agent performance, training improvements, closed-model parity, or a universal fastest runtime from this chat-only experiment.

#### Scenario: Chat passes UAT
- **WHEN** the user accepts the chat PoC
- **THEN** the report establishes chat feasibility only, without claiming autonomous coding competence


### Requirement: Contain executable evaluation output
Generated code SHALL execute only in a qualified disposable evaluator with no host mounts, credentials, network, or Docker socket. Total CPU, memory, process count, elapsed time and output SHALL be bounded, and teardown verified. The trusted launcher SHALL NOT execute generated programs.

#### Scenario: Evaluator qualification fails
- **WHEN** a safe synthetic limit or access check fails
- **THEN** generated-code scoring remains blocked and the failure is recorded

### Requirement: Compare published configurations first
The initial model comparison SHALL use pinned published configurations and disclose known quantization layouts, conversion details and unknowns. Reports SHALL NOT attribute all observed differences to source-model quality. A common conversion pipeline SHALL require a separately reviewed follow-up tied to a concrete selection or comparison need.

#### Scenario: Matching quantization labels
- **WHEN** two artifacts share a Q4_K_M label but their precision layouts differ or remain unknown
- **THEN** the report identifies that limitation and does not claim equivalent quantization

#### Scenario: Conversion could resolve a selection problem
- **WHEN** a suitable published artifact is unavailable, a suspected conversion defect affects selection, or controlled source-model comparison becomes necessary
- **THEN** a separate conversion task is reviewed, beginning with one checkpoint before any cohort-wide expansion
