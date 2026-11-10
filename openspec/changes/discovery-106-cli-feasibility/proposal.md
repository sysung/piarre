# Proposal

## Why

An editor-independent workflow may reduce repeated explanation, but a new CLI also adds setup and inspection burden. Issue #106 asks whether a thin handoff helper earns further work after the validation-first pilot.

## What Changes

- Specify a source-map audit of editor-independent core behavior and VS Code-hosted services. Identify the smallest possible extraction without building it.
- Define one matched repository-to-handoff-to-resumption journey against plain Markdown and the same existing agent. First consider PR #101's existing export plus a small helper.
- Keep runtime connection, clarification, citations, approvals, interruption, and recovery visible as later journey requirements. Do not implement a CLI before #100/#91 evidence and an explicit sequencing decision.
- Track later verified launch/stop/reset, human effort, correctness, setup friction, latency, and total cost as pending evidence.
- Publish the plan, then wait for human review. No rewrite, runtime package, TUI, installer, automatic agent invocation, or VS Code deprecation is included.

## Capabilities

### New Capabilities

- `cli-feasibility`: A staged architecture audit and matched handoff evaluation that preserves explicit CLI sequencing authority.

### Modified Capabilities

None. These are proposed experiment requirements, not acceptance of a CLI product contract.

## Impact

The audit reads core, app-hosted services, and PR #101's handoff. A future artifact could live under `test/intent-pilot/cli-feasibility/`; it does not exist today. Any executable slice needs a new explicit decision after the pilot, even if this plan is approved. #94/#102 supply later reproducibility/accounting and #105 supplies optional model evidence. Refs #106.
