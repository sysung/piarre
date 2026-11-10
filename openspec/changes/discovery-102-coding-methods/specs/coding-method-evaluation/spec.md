# Spec Delta

## Purpose

Define comparable coding-method experiments whose acceptance, cost, and quality reports retain failures, missing telemetry, and human work.

## ADDED Requirements

### Requirement: Fair paired methods and direct evidence control

The protocol SHALL define direct coding, deterministic handoff, local preparation, and direct matched-evidence conditions. Inputs, executor, effort, tools, permissions, output limits, repository state, and acceptance criteria SHALL match except for the declared treatment.

#### Scenario: Direct agent receives selected excerpts

- **WHEN** the matched-evidence condition runs
- **THEN** the direct executor receives the identical bounded excerpts/handoff outside Piarre and the report separates selection benefit from orchestration benefit

### Requirement: Independent accepted tasks

An accepted task SHALL satisfy frozen required behavior, independent hidden tests, required build/type/lint/regression and security checks, and independent patch review. Development tasks SHALL remain distinct from fresh held-out tasks and repeated attempts.

#### Scenario: Plausible patch passes visible tests only

- **WHEN** the patch fails an independent hidden check or has a blocking review finding
- **THEN** it is not counted as accepted

### Requirement: All-attempt cost and route accounting

The report SHALL count failed attempts, retries, preparation, retrieval, local inference, routing, coordinators, workers, reviewers, and reconciliation. It SHALL distinguish billed API charges, subscription usage, estimates, local resources, setup, and scorer costs without invented charges.

#### Scenario: No task is accepted

- **WHEN** every attempted task fails or remains unaccepted
- **THEN** cost per accepted task is undefined and all attempted costs remain in the report

#### Scenario: Telemetry is cumulative or missing

- **WHEN** repeated cumulative usage or unavailable reasoning/cache fields occur
- **THEN** cumulative updates are deduplicated and missing values remain unknown rather than zero

### Requirement: Isolation and authority cannot be inferred from worktrees

The protocol SHALL require immutable task/source manifests, fresh isolated state, one writer per run, and enforced filesystem/process/network/credential boundaries before real execution. Hidden evaluator material SHALL remain outside agent-readable mounts. Uncertain stops SHALL block replacement execution.

#### Scenario: Worktree isolation fixture passes

- **WHEN** a mock verifies directory names and manifest separation
- **THEN** the report leaves actual sandbox enforcement unverified until tested on the approved executor

### Requirement: Controlled factors and gated conclusions

The protocol SHALL freeze task counts, repetition/order/cache/reset rules, primary metrics, noninferiority margins, savings targets, stop rules, and maximum spend before measurement. Separately controlled factors SHALL retain their owner and confounders. Model/human results SHALL remain not run until authorized.

#### Scenario: Token savings accompany worse review effort

- **WHEN** a method lowers usage but fails a frozen quality, security, success-rate, or review-effort gate
- **THEN** the report rejects an efficiency win and retains its regressions and uncertainty
