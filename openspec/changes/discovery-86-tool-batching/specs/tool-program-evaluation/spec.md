# Spec Delta

## Purpose

Define observable comparison records for bounded tool programs without confusing offline control fixtures with real sandbox or provider evidence.

## ADDED Requirements

### Requirement: Comparable programs and evidence

The experiment SHALL compare sequential and bounded-program arms on identical tasks, tools, data, permissions, source revisions, and task acceptance criteria. Every result SHALL retain its evidence references and declared limits.

#### Scenario: Filtering removes required evidence

- **WHEN** a program summary omits evidence required by the frozen task
- **THEN** the task fails source-support acceptance even if the summary is shorter or faster

### Requirement: Per-call authority and visibility

The experiment SHALL record task/run identity, current activity, progress, decisions, stop state, and each inner call's authority, revisions, result, and evidence. Outer approval SHALL NOT authorize a denied or stale inner call.

#### Scenario: Correction between dependent calls

- **WHEN** a revision or permission changes after one call and before a dependent call
- **THEN** the dependent call is blocked pending current authority and the completed call remains visible

### Requirement: Bounded execution and adaptive fallback

The offline experiment SHALL enforce declared call, output, concurrency, and simulated resource limits. Tasks requiring interpretation or new authority SHALL pause or use the sequential baseline without repeating effects of uncertain completion.

#### Scenario: Adaptive result requires a decision

- **WHEN** a fixture result requires interpretation outside the declared program
- **THEN** execution pauses with its evidence and pending decision visible

#### Scenario: Output exceeds the frozen cap

- **WHEN** a tool response exceeds the declared output limit
- **THEN** the outcome records truncation or rejection and cannot pass by concealing lost evidence

### Requirement: Uncertain effects survive interruption

The experiment SHALL preserve per-call partial completion, stable synthetic effect identities, and unknown outcomes across stop, timeout, lost acknowledgment, and restart. Cancellation SHALL NOT imply rollback or server termination.

#### Scenario: Acknowledgment is lost after a synthetic effect

- **WHEN** an effect receipt is missing and the run restarts
- **THEN** the run remains uncertain until reconciliation and no replacement repeats the effect

### Requirement: Separate fixture and live conclusions

The report SHALL label fixed-program results as offline contract evidence. A sandboxed programmatic arm and real provider performance/control results SHALL remain pending until separately authorized and measured with frozen thresholds and all-attempt accounting.

#### Scenario: Fixed program passes all control cases

- **WHEN** offline fixture comparison succeeds
- **THEN** the report leaves containment, real latency/cost, and human control claims unproven and retains the baseline
