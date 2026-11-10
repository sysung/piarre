# Tasks

All tasks remain pending. The user chose plan publication and review before Apply. Proposed paths and commands below do not exist or become runnable merely because this plan validates.

## 1. Review and pin the experiment

- [ ] 1.1 Obtain explicit human agreement on this plan and test boundaries, including the proposed defaults in design.md. Verify a review decision bound to this exact plan version before Apply.
- [ ] 1.2 Select the exact implementation/dependency commit and existing installed tools. Freeze input hashes, case identities, output paths and phase status. Verify the manifest identifies missing prerequisites as blockers and permits no automatic installs, downloads or provider calls.

## 2. Build the approved offline slice with TDD

- [ ] 2.1 Add the story-specific positive, negative and deliberately wrong controls in verification.md before implementation. Record the meaningful failing assertions against current behavior or the incomplete experiment, excluding failures caused only by missing tools.
- [ ] 2.2 Implement only the bounded scope and target paths in design.md, then refactor while keeping those assertions green. Verify with `node --test test/retrieval-comparison.test.mjs` once its proposed tests exist and their required implementation base is selected.
- [ ] 2.3 Document the exact fixture ownership, launch/reset procedure and outcome limits beside the experiment. Verify the documented offline commands as written without downloads and retain raw results, including failures and unknowns.

## 3. Verify and challenge the implementation

- [ ] 3.1 Execute every applicable row and command in verification.md against the committed candidate. Verify immutable source/runtime identity and report passed, failed, blocked, unsupported and not-run scope separately.
- [ ] 3.2 Run independent Interrogate reviews using configured Sol and Astra against the same immutable diff, intent and results. Execute the actual blast-radius probes in verification.md. Verify each finding has source or runtime evidence rather than model agreement alone.
- [ ] 3.3 Resolve accepted findings and rerun affected tests and probes. Verify every review finding has an act-on, consider, noted or dismissed disposition with rationale, and renewed evidence matches the final revision.

## 4. Complete the discovery only with its required evidence

- [ ] 4.1 Satisfy the later execution prerequisites in design.md through an explicit scoped decision, or record the blocked/not-run phase without claiming completion. Before any measurement, verify frozen task counts, controls, quality/effort margins, supported environment and resource/spend limits.
- [ ] 4.2 Collect the required actual comparison and human/model evidence described in verification.md only after authorization. Verify raw all-attempt results and original human observations, then publish the supported retain/adopt/narrow/defer verdict and its limitations on issue #79. A mock result cannot satisfy required actual evidence.

## Workflow follow-up

- Keep this change active while tasks, required evidence or review remain incomplete.
- After accepted findings are resolved and the required scope is actually complete, review the spec-sync assessment, archive through OpenSpec, and verify the archived result.
- Keep the PR open for the user. Neither archive nor a positive verdict authorizes merging or release.
