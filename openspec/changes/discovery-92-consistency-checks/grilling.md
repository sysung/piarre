# Grilling and review boundary

## Settled frontier

The user answered the scope and boundary round before these proposals were authored:

1. Cover all twelve open stories labeled discovery, including #79/#93 and #103–#106. Answer: yes.
2. Keep downloads, live inference, paid calls, hardware purchases and human trials pending; prepare offline work only. Answer: yes.
3. Publish Arena/OpenSpec plan PRs and wait for human review before Apply. Answer: publish plans, then wait.

These answers authorize planning and publication. They do not approve this story’s proposed product choices, numeric experimental thresholds or later runtime trials.

## Decision tree for issue #92

First review the proposed bounded scope, defaults and verification outcomes in design.md and verification.md. If the plan is accepted, start OpenSpec Apply in a later request and use meaningful red/green TDD for the approved offline slice. If the plan needs a change, revise it before implementation.

Required actual model or human evidence remains gated and pending. Freeze its supported route, source/task versions, order, counters and budget before any later measurement. A negative or deferred result is valid when supported by the required evidence or an explicit blocker disposition; an unperformed experiment is not a pass.

The workflow after approval remains Apply using TDD, execute verification, Interrogate and actual Blast Radius probes, resolve accepted findings, reverify and Archive. Archive waits for real completion and its spec-sync review. Keep the PR open for user review throughout.
