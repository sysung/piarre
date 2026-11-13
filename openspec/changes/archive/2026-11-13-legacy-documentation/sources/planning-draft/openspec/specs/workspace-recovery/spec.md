# Workspace Recovery Specification

## Purpose

Reviewed integration and recovery that preserve newer and unrelated work.

Sources: [Product PRD](../../../docs/01_PRODUCT_PRD.md#work-and-user-authority), [technical design](../../../docs/02_TECHNICAL_DESIGN.md#recovery-and-checkpoints), and [workspace-integration.test.ts](../../../apps/vscode/test/suite/workspace-integration.test.ts).

## Requirements

### Requirement: Publish reviewed changes within scope

Piarre SHALL apply only the reviewed candidate changes and block publication when relevant source or candidate state has changed.

#### Scenario: Find a manual edit before integration

- **WHEN** a source file in scope changes after candidate review
- **THEN** integration is blocked and the manual edit is preserved

### Requirement: Preserve current work during restore

Piarre SHALL preserve current work recoverably before applying a reviewed restore and prevent a completed restore from replaying over subsequent edits.

#### Scenario: Restore a checkpoint after a newer edit

- **WHEN** the user reviews and approves a supported restore
- **THEN** the newer work remains recoverable and the restore has a separate recorded result
