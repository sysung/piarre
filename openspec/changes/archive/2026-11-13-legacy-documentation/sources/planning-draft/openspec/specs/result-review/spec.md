# Result Review Specification

## Purpose

Current verification evidence and separate user acceptance.

Sources: [Product PRD](../../../docs/01_PRODUCT_PRD.md#work-and-user-authority), [technical design](../../../docs/02_TECHNICAL_DESIGN.md#verification-requirements), and [execution-coordinator.test.ts](../../../apps/vscode/test/suite/execution-coordinator.test.ts).

## Requirements

### Requirement: Bind checks to reviewed results

Piarre SHALL associate check evidence with the reviewed plan, candidate contents, and applicable criteria.

#### Scenario: Change the candidate after a passing check

- **WHEN** candidate contents change after verification
- **THEN** the earlier evidence becomes historical and cannot authorize integration of the changed candidate

### Requirement: Require user acceptance

Piarre SHALL distinguish run completion, criterion verification, and user acceptance.

#### Scenario: Complete a run with passing checks

- **WHEN** a run produces current evidence that satisfies its criteria
- **THEN** the result remains available for review until the user explicitly accepts it
