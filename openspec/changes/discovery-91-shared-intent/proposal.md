# Proposal

## Why

The reviewed-intent prototype works technically, but it has not shown that maintaining accepted project understanding reduces human effort. Continue the existing pilot instead of building a second source-of-truth system.

## What Changes

- Reuse PR #101 and extend only uncovered branch/divergence and pilot cases. Compare ordinary Markdown, OpenSpec and the existing reviewed-snapshot/adoption-event candidate, without implementing another storage architecture.
- Prepare the source-linked cases and failure controls in [verification.md](verification.md), reusing existing implementation and experiment owners.
- Publish this plan for human review. All Apply/TDD, model/human trials and archive work remain pending.

## Capabilities

### New Capabilities

- `accepted-intent-evaluation`: Observable, version-bound experiment behavior for this discovery, without production adoption.

### Modified Capabilities

None. No main capability exists in the current OpenSpec inventory.

## Impact

This plan depends logically on PR #101 for later implementation, not on PR #89/#99. #87 supplies a restore-scope example; #92 can reuse accepted identities. #67 consumes findings without a second feedback ceremony. The plain-Markdown pilot remains the immediate product priority.

The proposed implementation targets are listed in [design.md](design.md). This PR changes only OpenSpec planning files and shared configuration. It does not implement the experiment, change runtime authority or complete [issue #91](https://github.com/sysung/piarre/issues/91).
