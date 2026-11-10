# Proposal

## Why

Bonsai's compressed weights make a comparison plausible, but article anecdotes and vendor benchmarks do not establish Piarre response quality or device fit. Issue #104 needs an eligibility decision before any runtime trial can be considered.

## What Changes

- Specify a text-only Bonsai eligibility row, a separate source/claim matrix, and a pinned Qwen control using the shared #94 comparison contract.
- Specify recorded-response negative controls and a later matched, independently scored comparison through #94/#102, with retrieval and thinking mode held fixed.
- Preserve retain Qwen, bounded Bonsai prototype, and defer as possible recommendations. Track actual hardware, runtime, quality, effort, and maintenance evidence as pending.
- Publish this plan, then wait for human review. No model download, installation, inference, adapter change, or default switch is authorized.

## Capabilities

### New Capabilities

- `bonsai-eligibility`: Evidence-labeled eligibility and bounded comparison decisions for a text-only Bonsai challenger.

### Modified Capabilities

None. There are no accepted main OpenSpec specs. These are proposed experiment requirements, not declarations of current product behavior.

## Impact

The later offline slice would extend #94's PR #95 files with eligibility fixtures shared with #105. PR #89 supplies the unmerged Qwen adapter reference; #102 owns accounting. #100/#91 remains first, and any actual trial needs a separately approved route and resource protocol. This plan changes only OpenSpec text. Refs #104.
