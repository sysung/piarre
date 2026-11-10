# Spec Delta

## Purpose

Support a bounded local-orchestrator decision with source-labeled eligibility, matched task evidence, and retained uncertainty before any candidate can be considered for production adoption.

## ADDED Requirements

### Requirement: Account for the full candidate queue
The report SHALL include pinned Qwen3.5 4B Q6_K, Qwen3.5 9B, Ministral 3 8B, Gemma 4 12B-it, Nemotron 3 Nano 4B, Bonsai 27B 1-bit, and research-only Nemotron-Orchestrator/ToolOrchestra. Each row SHALL distinguish issue-sourced claims, verified eligibility, exclusions, and actual results.

#### Scenario: Research rights remain unresolved
- **WHEN** Nemotron-Orchestrator/ToolOrchestra rights have not been separately resolved
- **THEN** the report excludes it from production selection and treats whole-system expert results as research evidence only

### Requirement: Admit only reviewed trial cells
The experiment SHALL retain the required Qwen control and admit at most one challenger after reviewed eligibility. Exact artifact/license, runtime, device, template/parser, thinking, cancellation, private endpoint, and resource fields SHALL be resolved before any actual trial. A complete manifest alone SHALL not establish compatibility.

#### Scenario: Parser behavior is unknown
- **WHEN** an artifact has complete descriptive metadata but no supported response/parser behavior
- **THEN** eligibility remains unresolved and no trial or default switch occurs

### Requirement: Evaluate grounded orchestration behavior
The protocol SHALL separately cover consequential clarification, grounding/abstention, tools/routing, correction/recovery, and efficiency/usefulness accounting with independently known outcomes. Recorded tool fixtures SHALL check argument meaning independently of JSON validity and SHALL execute no external actions.

#### Scenario: Valid JSON requests the wrong action
- **WHEN** a recorded request conforms to the tool schema but uses the wrong project or semantic arguments
- **THEN** the case fails even if the JSON parser accepts it

### Requirement: Preserve optional clarification skip
A skipped clarification SHALL retain visible editable provisional assumptions. Skipping SHALL never waive permission-critical checks or let model text authorize tools, adopt intent, or invoke hosted experts.

#### Scenario: The user continues with assumptions
- **WHEN** the user skips a noncritical clarifying question
- **THEN** the handoff labels the assumption provisional and retains any unresolved authorization requirement

### Requirement: Preserve matched and independent evidence
Any later comparison SHALL freeze equivalent tasks, sources, evidence, permissions, budgets, and retrieval, preserve failed attempts, and separate thinking/runtime cells. Fresh holdouts SHALL be independent of exposed development examples, with keys hidden and human adjudication retained for consequential judgments.

#### Scenario: A holdout is exposed during tuning
- **WHEN** candidate changes use a held-out answer
- **THEN** the case becomes development evidence and cannot support a fresh holdout claim

### Requirement: Veto unsafe promotion and retain unknowns
Any critical authority/isolation failure SHALL block promotion regardless of average scores. Finite zero failures SHALL not prove universal safety. Actual trial results, resource/cost fields, and human effort SHALL remain not run or unknown until measured under separately approved scope after #100/#91 review.

#### Scenario: Fixtures pass without inference
- **WHEN** recorded-tool and scorer checks pass
- **THEN** only deterministic contract evidence is reported and retain Qwen, defer, or insufficient evidence remain valid decisions
