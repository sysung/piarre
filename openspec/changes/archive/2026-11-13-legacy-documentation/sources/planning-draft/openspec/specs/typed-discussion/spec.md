# Typed Discussion Specification

## Purpose

An explicitly connected Codex conversation tied to durable project context.

Sources: [Product PRD](../../../docs/01_PRODUCT_PRD.md#translation-and-shared-understanding), [technical design](../../../docs/02_TECHNICAL_DESIGN.md#ui-and-interaction), and [conversation-controller.test.ts](../../../apps/vscode/test/suite/conversation-controller.test.ts).

## Requirements

### Requirement: Preserve submitted context

Piarre SHALL retain the original submitted statement and keep provider interpretations distinct from confirmed knowledge and approvals.

#### Scenario: Receive an inference claiming approval

- **WHEN** a provider reply interprets a statement as permission to act
- **THEN** the reply cannot grant approval or create tasks or proposals

### Requirement: Represent uncertain turns

Piarre SHALL record a pending turn as unknown when its outcome cannot be established after restart or disconnect.

#### Scenario: Restart with a pending turn

- **WHEN** VS Code restarts before the provider reports a terminal state
- **THEN** Piarre records uncertainty without automatically reconnecting or retrying the turn
