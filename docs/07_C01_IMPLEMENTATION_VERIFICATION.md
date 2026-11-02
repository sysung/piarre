# Immediate C implementation and verification

Status: Execution plan prepared, 2026-11-01. Implementation has not started in this checkout.

The next work package establishes a current, verified baseline before building the integrated candidate. The active delivery queue is [the C first-release plan](06_C_FIRST_RELEASE_PLAN.md).

## First steps

1. Preserve local documentation changes and select an isolated issue branch from the current live default branch.
2. Run the existing checks and Extension Host tests against that base, recording actual failures and environmental blockers.
3. Assess the preserved B execution branch for reusable approvals, worker integration, writer ownership, and behavioral tests.
4. Define shared records and authority for conversation, memory, Basis, plans, runs, checkpoints, council, reflection, and provisional drafts.
5. Map each first-release requirement to implementation ownership and verification evidence.
6. Continue into the typed conversational workspace and one complete approved-work loop, without a separate user walkthrough for each internal package.

The work-specific implementation steps and verification matrix are in the local artifact `.artifacts/c-first-release/c01/implementation-and-verification.md`. That directory is ignored by Git. This tracked document preserves the lasting intent and completion criteria, and the relevant GitHub issue contains the full plan.

## Verification contract

Existing scripts must be checked on the chosen current base before execution. The observed local entrypoints are `npm ci`, `npm run check`, and `npm test`. The latter includes contract and Extension Host checks. Live provider probes require the supported adapter and applicable authorization.

Each result records the tested revision and observed outcome. Compilation, packaging, historical CI, and mock results do not prove that the live product works.

The integrated candidate must demonstrate source-linked resumption, useful clarification, correct Basis records, memory correction, reversible triage, real progress, cancelled provisional work, approved execution, current verification, safe interruption and restart, checkpoint restoration, linked ideas, bounded council, optional reflection, and stable/dev isolation.

Checkpoint checks use isolated repositories and cover newer manual edits, untracked files, partial restore failure, repeated requests, and stale evidence. No external-effect rollback is implied.

A practical regression defect receives failing-before and passing-after evidence. Independent review checks coverage and concrete risks. The final user receives one candidate and one feedback guide rather than separate internal-story walkthroughs.

## Completion boundary

C01 is complete when the current baseline is observed, reusable work is classified, shared authority contracts and blocking policy choices are explicit, and the requirement-to-scenario map is ready. This completion does not mean the product is released.

The first product evaluation tolerates rough edges while establishing measurable improvement targets. Unauthorized actions, silent data loss, misleading verification, and broken recovery remain blockers. Stable production installation and paid provider use require their applicable authorization.
