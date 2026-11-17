---
name: Work item
about: Describe a problem, its value, and an observable outcome
labels: needs-triage
---

## Why this matters

- **Problem:** <!-- Who is affected and what happens today? For a bug, include reproduction steps and actual behavior. -->
- **Expected value:** <!-- What improves for the user, operator, or contributor? Avoid unmeasured benefit claims. -->

## Expected User Experience

- <!-- Describe the intended experience with a concrete before/after example. For research, describe the decision this work enables. -->

## Acceptance Criteria

- [ ] <!-- Observable outcome. No numbered AC identifiers are needed. -->
<!-- Optionally link a child issue beside the outcome it delivers. A text link does not create a native sub-issue or dependency. Keep integrated acceptance separate from child closure. -->

## In Scope

- <!-- Included behavior or deliverables. Keep implementation details only where they constrain the work. -->

## Out of Scope

- <!-- Adjacent work intentionally excluded. “None identified” is acceptable. -->

## OpenSpec Contract

- **Source:** <!-- Link the spec/change and section. Say “Pending” with the unresolved question, or “Not applicable” with a short reason. Do not invent a contract. -->
- **Verification source:** <!-- Link the applicable OpenSpec verification section, if available. -->
<!-- Preserve explicit acceptance/authorization gates. Proposed requirements are not automatically adopted. Configure parent/children, dependencies, milestone, and project in GitHub; see docs/agents/issue-tracker.md. -->

## Verification

### Agent Verification Plan

- <!-- Name the acceptance outcome, exact action/command or linked procedure, and expected observation. Reuse existing checks; new tests or standalone verifiers require explicit authorization. -->
- **Results:** <!-- After execution, link observed evidence and relevant revision/configuration. Identify passed, failed, blocked, and unrun checks. A plan is not evidence. -->

### Human Verification Plan

<!-- Provide a short reproducible walkthrough, not “try it and see.” Include the starting state, exact inputs/commands or UI actions, and expected result for each step. Supply runnable details at handoff; mark unknown details pending rather than inventing them. For research, guide the reviewer to specific evidence and the decision needed. If no human check is required, state why; preserve existing human gates. -->
1. <!-- Setup: open/start the specified version and prepared sample. Include the exact path/link or command. -->
2. <!-- Action: enter this exact input or take this exact action. Expected: observable result. -->
3. <!-- Check: take the final action and state what to observe or decide. Explain where to report a mismatch. -->
