# Spec Delta

## Purpose

Give reviewers an evidence-labeled basis for deciding whether a text-only Bonsai comparison is eligible without treating compressed file size or vendor claims as demonstrated Piarre behavior.

## ADDED Requirements

### Requirement: Separate claims from reproduced evidence
The experiment report SHALL distinguish article anecdotes, vendor measurements, inspected Piarre contracts, calculations, and untested hypotheses, with source identity and verification status for each claim.

#### Scenario: A vendor resource number is supplied
- **WHEN** the matrix records published weight size, memory, throughput, or benchmark retention
- **THEN** the report labels it external evidence and leaves actual target-device fit and Piarre quality untested

### Requirement: Block unresolved eligibility
The eligibility report SHALL record exact artifact digest, weight type, runtime/kernel version, license, template/tokenizer, private route, thinking mode, context/KV limits, and actual device status. Missing or unsupported fields SHALL prevent trial eligibility.

#### Scenario: GGUF exists but kernel support is unknown
- **WHEN** a Bonsai row has a GGUF location but no verified Q1_0_g128 kernel/runtime support
- **THEN** the row reports unresolved eligibility and does not infer Docker Model Runner compatibility

#### Scenario: Optional components are present upstream
- **WHEN** the repository offers vision or speculative-draft components
- **THEN** the first comparison excludes them and identifies only the text artifact under review

### Requirement: Preserve matched comparison cells
Any later authorized comparison SHALL keep tasks, sources, evidence, retrieval, permissions, prompt contract, and output/time budgets matched to pinned Qwen. Thinking-on and retrieval changes SHALL have separate cells. Different runtimes SHALL be labeled deployment comparisons.

#### Scenario: A candidate needs another backend
- **WHEN** Bonsai cannot use the baseline backend but another supported private route is proposed
- **THEN** the protocol records the backend difference and forbids a pure model-only attribution

### Requirement: Retain incomplete and adverse results
The report SHALL retain every failure, timeout, truncation, unknown usage field, and unconfirmed stop. Missing actual model or human evidence SHALL remain not run or blocked rather than inferred from recorded fixtures.

#### Scenario: Recorded responses pass
- **WHEN** deterministic contract fixtures pass without executing a model
- **THEN** the report records bookkeeping/response-contract evidence only and leaves model quality, privacy, latency, resource fit, and effort pending

### Requirement: Gate trial and adoption authority
Actual trials SHALL require a separately approved execution route, hardware, frozen thresholds, and resource budget after #100/#91 sequencing review. Promotion SHALL be vetoed by any critical authority/isolation failure; finite zero failures SHALL not be reported as safety proof. Adoption SHALL require a separate scoped change.

#### Scenario: Average quality improves after a critical failure
- **WHEN** an authorized comparison observes a critical authority or cross-project isolation failure
- **THEN** promotion is blocked regardless of the mean score and the report retains Qwen or defers
