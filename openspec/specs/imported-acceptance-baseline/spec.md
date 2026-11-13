# Imported acceptance baseline

## Purpose

Preserve the four existing automated acceptance contracts from sysung/piarre test/acceptance/catalog.json at 8a8b7ab38d9cb0d272389ef89a089e5cee9b7832, without broadening them. Automated catalog classification is not evidence of a current test run. These imported contracts complement the narrower capability drafts. The original requirement text is verbatim below.

## Requirements

### Requirement: foundation-authority-and-recommendation

The acceptance contract MUST retain the following scope:

Proposal authority, original record revisions, compatibility, and visible unsupported capabilities.

Owner: C01

#### Scenario: foundation-authority-and-recommendation verification

- **WHEN** the existing behavioral tests execute against the selected code/documentation revisions
- **THEN** each named expectation below must pass before this contract is reported verified

- Recommendation keeps original proposal revisions through rename and restart
- a rename before a proposal does not invent an earlier source revision
- invalid direct dispatch cannot bypass the interpreter or append receipts
- corrupt stored provenance, authority, and graph envelopes are rejected
- pre-C01 receipts with alternate draft property order survive replay and retry
- Work exposes unapproved Recommendation and unavailable capabilities without running providers
- invalid provider configuration fails closed and does not expose credentials

### Requirement: billing-plan-estimates

The acceptance contract MUST retain the following scope:

API dollars or calibrated subscription-window consumption with explicit missing inputs and unverified billing context.

Owner: C01

#### Scenario: billing-plan-estimates verification

- **WHEN** the existing behavioral tests execute against the selected code/documentation revisions
- **THEN** each named expectation below must pass before this contract is reported verified

- API budget scenarios use configured rates and all proposed attempts
- subscription windows use same-model calibration rather than invented token quotas
- missing billing or calibration stays unknown instead of free
- calibration from another model or window is not reused
- invalid rates and usage samples fail closed without exposing credentials
- plan names are escaped and pricing never enables a provider
- subscription calibration is not reused after a plan or provider change
- legacy samples without billing context stay unknown instead of inheriting the selected plan
- provider edits refresh existing estimates without moving focus or reopening closed views

### Requirement: workspace-session-brief-shell

The acceptance contract MUST retain the following scope:

Design B planning shell: record-backed brief, visible split inspection, responsive reading order, and private unsent input preserved across refresh. This does not establish connected dialogue or sourced session resumption.

Owner: C02

#### Scenario: workspace-session-brief-shell verification

- **WHEN** the existing behavioral tests execute against the selected code/documentation revisions
- **THEN** each named expectation below must pass before this contract is reported verified

- session brief follows saved records through rename, deletion and replay
- real webview preserves unsent input on inspection updates and requires explicit save

### Requirement: context-proposal-boundaries

The acceptance contract MUST retain the following scope:

Preserve original statements and revisions, bind citations and correction targets to trusted inputs, and reject provider authority fields.

Owner: C01

#### Scenario: context-proposal-boundaries verification

- **WHEN** the existing behavioral tests execute against the selected code/documentation revisions
- **THEN** each named expectation below must pass before this contract is reported verified

- submitted context preserves original wording and rejects fabricated authority
- interpretations cite only supplied sources and remain inferred
- correction candidates retain the host-selected target and cannot confirm it
