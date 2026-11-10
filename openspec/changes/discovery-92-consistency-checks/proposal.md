# Proposal

## Why

Refs #92. Tests, code, and documentation can repeat the same mistake while agreeing with one another. A targeted experiment should determine whether source-linked disagreement checks find useful defects beyond ordinary review at acceptable human attention cost.

## What Changes

- Propose a small #94 experiment slice over two changed behaviors and independently adjudicated seeded/control cases.
- Preserve expected behavior derived from accepted intent before exposing implementation. Findings identify artifact revisions, uncertainty, an owning artifact, and a proposed action.
- Compare tests plus ordinary review, cheap link/revision checks, and risk-triggered deeper review. Propose explicit budgets and suppression of unchanged repeated findings for plan review.
- Report incremental benefit, false positives/negatives, missing coverage, false consistency claims, and total attention by depth. No finding automatically changes accepted intent, tests, code, or docs.

## Capabilities

### New Capabilities

- `consistency-evaluation`: Revision-bound disagreement evaluation with independent expectations and proportionate review accounting.

### Modified Capabilities

None. There are no existing main specs in this planning root. The new requirements describe a proposed experiment, not a mandatory product gate.

## Impact

Future offline fixtures reuse #91's accepted-intent identities from open PR #101 and #94's benchmark from open PR #95. #54/#52 retain knowledge/traceability authority, #55 verification, #56 investigation, and #57 documentation proposals. #67/#59 own human-effort comparison. This plan introduces no competing truth store or repository-wide scanner. Publish the plan, then wait for human review before Apply. Human/model trials and final thresholds require later explicit agreement.
