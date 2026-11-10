# Proposal

## Why

Piarre has exact and full-text retrieval, but a research score does not show that people can find applicable evidence with less work. Prepare a fair comparison before choosing a retrieval change.

## What Changes

- Prepare an unchanged exact/FTS5 baseline and one bounded, source-derived relationship challenger. Preserve the existing exact, fts5, fts5-relations and compiler methods and the original fixture.
- Prepare the source-linked cases and failure controls in [verification.md](verification.md), reusing existing implementation and experiment owners.
- Publish this plan for human review. All Apply/TDD, model/human trials and archive work remain pending.

## Capabilities

### New Capabilities

- `retrieval-evaluation`: Observable, version-bound experiment behavior for this discovery, without production adoption.

### Modified Capabilities

None. No main capability exists in the current OpenSpec inventory.

## Impact

#93 supplies technical cases and #94 supplies reporting. #58 supplies isolation; #88/PR #89 supplies any later local answer route. PR #97 at ba752455 is historical context-selection evidence, not completion of this comparison.

The proposed implementation targets are listed in [design.md](design.md). This PR changes only OpenSpec planning files and shared configuration. It does not implement the experiment, change runtime authority or complete [issue #79](https://github.com/sysung/piarre/issues/79).
