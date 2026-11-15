# Proposal

## Why

The VS Code application has been removed from master, but OpenSpec still lists its 21 requirements as current. Retire them now so the active catalog reflects the clean baseline even if the PoC ends without a qualifying model.

## What Changes

- **BREAKING** for spec consumers: remove all eight legacy main capability files in a single reviewable change. Link to the exact recovery revision and preserve the existing archive.
- Rebase the active `local-model-chat-poc` proposal in the same PR. Drop its six removal-only deltas and convert the two replacement deltas into additions with the same capability names, requirements, and scenarios.
- Update the docs to direct contributors to the open PoC change during delivery. The proposed PoC capabilities enter the main catalog at the existing delivery and acceptance boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `approved-execution`: retire execution approval and ownership requirements.
- `goal-proposals`: retire legacy goal review and saving.
- `imported-acceptance-baseline`: retire the imported legacy acceptance contract.
- `project-knowledge`: retire legacy knowledge and correction requirements.
- `project-state`: retire legacy state restoration and replay requirements.
- `result-review`: retire the legacy result review and acceptance requirements.
- `typed-discussion`: retire the legacy discussion and context requirements.
- `workspace-recovery`: retire legacy publication and workspace restoration.

## Impact

The change affects the main spec catalog, the active PoC's deltas and retirement notes, and contributor navigation. No runtime work is in scope. The original contracts are recoverable at [the pinned pre-reset revision](https://github.com/sysung/piarre/tree/3205f75e82ac7f1d82d9db961638252881cf7e88/openspec/specs).
