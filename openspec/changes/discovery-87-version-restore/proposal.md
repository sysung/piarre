# Proposal

## Why

Restoring a useful earlier skill should preserve unrelated work and current permissions. A disposable history-and-restore experiment can test those boundaries before any real skill is changed.

## What Changes

- Prototype history, exact diff and reviewed restore for one copied synthetic skill and explicitly enumerated local assets. Full immutable snapshots create a new monotonic revision linked to the current head and historical content.
- Prepare the source-linked cases and failure controls in [verification.md](verification.md), reusing existing implementation and experiment owners.
- Publish this plan for human review. All Apply/TDD, model/human trials and archive work remain pending.

## Capabilities

### New Capabilities

- `skill-restore-experiment`: Observable, version-bound experiment behavior for this discovery, without production adoption.

### Modified Capabilities

None. No main capability exists in the current OpenSpec inventory.

## Impact

#83 supplies manifest terminology and #91 the accepted-scope example. Neither requires building a template platform or migrating the authoritative runtime event log.

The proposed implementation targets are listed in [design.md](design.md). This PR changes only OpenSpec planning files and shared configuration. It does not implement the experiment, change runtime authority or complete [issue #87](https://github.com/sysung/piarre/issues/87).
