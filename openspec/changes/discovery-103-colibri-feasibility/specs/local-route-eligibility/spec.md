# Spec Delta

## Purpose

Define evidence-linked eligibility reports for local inference routes so documented compatibility and fixture accounting do not become unsupported device or performance claims.

## ADDED Requirements

### Requirement: Source and deployment identity

The eligibility report SHALL pin source revision, model artifact, license, backend, API, template, generation settings, and target-device evidence. Every claim SHALL distinguish upstream documentation, arithmetic, recorded fixture behavior, and local measurement. Missing eligibility fields SHALL remain unresolved.

#### Scenario: File size is supplied without runtime evidence

- **WHEN** the report has a model size but lacks exact backend or artifact support
- **THEN** it does not declare the route compatible or able to fit

### Requirement: Resource phases and cache states remain distinct

The report SHALL separate queue, load, prefill/first useful response, decode, total request, cancellation acknowledgment, RAM/swap, and storage observations. Missing values SHALL remain unknown and overlapping phases SHALL NOT be added twice. Cache observations SHALL identify their layer and condition.

#### Scenario: Resident weights omit peak memory

- **WHEN** an upstream claim reports resident dense weights only
- **THEN** the report keeps peak total memory, KV state, runtime buffers, page cache, and storage requirements separately unresolved

### Requirement: Admission and stop preserve existing authority

The compatibility assessment SHALL retain local-only routing, exact model identity, bounded prompts/output/deadlines, sourced reply validation, and no automatic retries or hosted fallback. Client cancellation SHALL NOT count as observed server termination.

#### Scenario: Recorded HTTP cancellation succeeds locally

- **WHEN** a recorded fixture shows that the client aborts delivery
- **THEN** the report preserves unconfirmed server activity and leaves actual retention/privacy behavior unproven

### Requirement: Arithmetic and tiny controls cannot establish suitability

The report SHALL label arithmetic illustrations and any tiny-model transport control separately from target-model results. It SHALL distinguish starts, fits, responds correctly, and meets latency criteria. Runtime-only comparisons SHALL require matched weights/template; other comparisons SHALL be labeled deployment comparisons.

#### Scenario: One hundred tokens are estimated from upstream rates

- **WHEN** the report uses 0.05 to 0.1 decoded tokens per second
- **THEN** it labels roughly 17 to 33 minutes as arithmetic excluding overhead and makes no target-device forecast

### Requirement: Lessons and backend trials have separate gates

The report SHALL evaluate at most two specific measurement/control lessons before proposing a backend trial. Downloads, runtime changes, and inference SHALL remain gated on reviewed compatibility, target resources, scope, limits, budget, and separate execution authorization.

#### Scenario: Recorded fixtures satisfy the report schema

- **WHEN** all offline compatibility fixtures pass
- **THEN** the report leaves target-device resource fit, interactive quality/latency, and actual privacy/retention not run and retains the current route
