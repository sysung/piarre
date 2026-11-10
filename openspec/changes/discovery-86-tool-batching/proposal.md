# Proposal

## Why

Refs #86. Repeated model/tool round trips may add avoidable latency, but batching can hide partial work and weaken control. A controlled experiment must establish whether any benefit survives task-quality, authority, visibility, interruption, and recovery requirements.

## What Changes

- Propose a small #94 experiment slice comparing sequential calls with bounded fixed call programs over identical read-only tools and data.
- Preserve each call's authority, revisions, evidence, progress, and outcome. Use synthetic effects for recovery fault cases.
- Specify a later sandboxed programmatic comparison and actual latency/cost measurements as separate, gated completion work. Fixed fixtures establish accounting and control contracts only.
- Retain the sequential baseline and adaptive fallback. No vendor, arbitrary-code executor, production integration, or performance winner is selected.

## Capabilities

### New Capabilities

- `tool-program-evaluation`: Reproducible comparison records for bounded tool programs, including per-call control and incomplete execution.

### Modified Capabilities

None. The initialized planning root has no existing main specs. These are proposed experiment requirements, not accepted production behavior.

## Impact

Future offline implementation extends issue #94's benchmark, implemented only in open PR #95, after human plan and test-boundary agreement. #55 owns execution adoption, #58 isolation, #75 visibility, and #102 downstream coding comparisons. Current PRs remain unmerged dependencies. This PR contains planning text only. Publish the plan, then wait for human review before Apply. Live providers, generated-code execution, downloads, installations, and spending require separate authorization.
