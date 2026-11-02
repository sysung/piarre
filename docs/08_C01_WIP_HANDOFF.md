# C01 work in progress and review guide

Status: Partial C01 baseline work, 2026-11-01. No new conversational UI or C product is implemented by this change.

## Delivered

- Consolidated product principles and features, the C implementation backlog, and the immediate implementation and verification plan.
- Historical B issue and board summary, with supersession and source-branch preservation recorded.
- An issue-specific documentation branch rebased onto current default-branch commit `843f95c`, including merged reviewable proposals.
- Corrected historical-source links after the rebase.
- Existing baseline checks run against this checkout. Results below distinguish observed passes from incomplete checks.

## Verification observed

`npm ci` completed using the lockfile. The initial check attempt lacked installed dependencies; it was rerun after installation.

`npm run check` passed lint, type checks, build, and extension packaging. `npm run test:contract` passed all four checks.

The Extension Host smoke suite was started outside the restricted GUI environment and required downloading its pinned VS Code runtime. Its final result is recorded below when available. A started test is not a pass.

The dependency installation reported 16 audit findings, including two high-severity findings. These are unresolved baseline findings. No dependency upgrade or audit remediation is part of this documentation change.

No live coding-worker probe, model benchmark, checkpoint implementation, or C acceptance journey has passed in this slice.

## Review and optional baseline smoke test

Review the consolidated design, C release plan, and immediate verification contract first. Sign-off on this PR concerns product direction and the partial baseline record, not a completed C product.

To exercise the existing baseline without replacing your daily extension:

1. Check out this PR in a development checkout and run `npm ci`.
2. Run `npm run check` and `npm test` with a supported Node version and GUI environment. Linux CI uses its virtual display wrapper.
3. Open that checkout in VS Code and launch **Run Piarre Extension** with F5.
4. In the separate Extension Development Host, run **Piarre: Open** in a trusted test repository.
5. Run **Piarre: Propose Task** and inspect the unapproved proposal. Reload the development window and confirm it persists.
6. Close the Development Host when finished. Do not install the packaged extension over the daily production environment for this review.

These commands test existing durable-project and proposal behavior. Voice, the C conversation panel, memory/Basis, council, nested ideas, and checkpoint restore remain planned capabilities.

## Remaining work

C01 remains in progress. Next inspect the preserved execution branch against the current base, finalize minimal shared contracts and authority policies, and produce the full requirement-to-scenario map. Then C02 builds the typed conversational workspace. No per-story product walkthrough is required from the user.

This WIP deliberately stops short of the full product to respect the user's remaining credit budget. There is no exact conversion from the displayed remaining-credit percentage to a token allowance.
