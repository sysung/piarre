# Proposal

## Why

The original retrieval probes and later keyword research do not resolve how unchanged exact/FTS5 compares with bounded relationships on fresh rationale and dependency questions. Prepare that missing comparison without retuning on exposed holdouts.

## What Changes

- Keep an unchanged exact+FTS5 arm and one bounded source-derived reverse-module relationship arm at identical evidence limits. Preserve the original fixture and separate retrieval recall from generated-answer support, unsupported claims and abstention.
- Prepare the source-linked cases and failure controls in [verification.md](verification.md), reusing existing implementation and experiment owners.
- Publish this plan for human review. All Apply/TDD, model/human trials and archive work remain pending.

## Capabilities

### New Capabilities

- `heldout-retrieval-evaluation`: Observable, version-bound experiment behavior for this discovery, without production adoption.

### Modified Capabilities

None. No main capability exists in the current OpenSpec inventory.

## Impact

Actual answer generation requires #88/PR #89. #94/PR #95 owns the common manifest/results. #79 consumes the technical evidence; PR #97 historical keyword/dense experiments remain supporting exposed research, not a replacement comparison.

The proposed implementation targets are listed in [design.md](design.md). This PR changes only OpenSpec planning files and shared configuration. It does not implement the experiment, change runtime authority or complete [issue #93](https://github.com/sysung/piarre/issues/93).
