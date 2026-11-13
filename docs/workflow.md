# Documentation workflow

## Use the local documentation

Clone Piarre and use the documentation in that checkout. Code, guides, specs and changes share one Git revision. With OpenSpec 1.16.1 installed, run these commands from the repository root or a child directory:

```sh
openspec context --json
openspec list --all --sort name
openspec validate --all --strict
```

The context must identify this Piarre checkout. No Store registration, documentation lock, second repository or deploy key is required. CI fetches enough Piarre history to resolve the historical source fixtures.

## Make and review a change

Create an issue-linked implementation branch from the desired Piarre baseline. Use `YYYY-MM-DD-HHMMSS-slug` with UTC time for new change IDs. Keep existing IDs. On collision, choose a distinct descriptive suffix. OpenSpec proposals and designs contain the decisions; tasks reference the canonical verification plan instead of repeating it.

Each proposal has a History section recording its outcome, creation, acceptance, merge and archive times, originating issue, documentation PR and first commit, implementation PR and commit, verification evidence, dependencies and supersession. The documentation and implementation PR can be the same. Unknown events remain pending. These Markdown fields are a project convention. Creation order comes from `openspec list --all --sort name`; acceptance and merge order come from their recorded events. Timestamps alone do not establish dependency.

Publish documentation and tooling together in one implementation PR. Record its originating issue, PR and implementation commit. Add final evidence in a later commit or durable result artifact so no commit must contain its own hash. Each verification result identifies the single Piarre revision it tested. Later edits do not rewrite the old result; changed criteria require new verification.

## Verify

The migration's [canonical plan](../openspec/changes/2026-11-13-055759-consolidate-project-documentation/design.md#verification-plan) defines V01–V12. Future changes declare one canonical plan, with links from tasks and issues. Record passed, failed, blocked and unverified outcomes with commands and revision evidence. Human-readable checks remain alongside automated checks.

`npm run test:contract` exercises reference resolution and provenance without launching the application. `npm run test:acceptance -- --preview` inspects draft references and produces an explicitly unverified report; it cannot satisfy acceptance. Strict acceptance requires a clean Piarre checkout at the recorded revision and the applicable behavioral checks. A failed or unverified check must remain incomplete unless the user explicitly accepts a recorded limitation.

## Retain history and roll back

Archive completed changes through the OpenSpec archive workflow. Legacy snapshots and abandoned discoveries record their outcome and skip spec synchronization. Never check off unfinished tasks to make abandonment look complete. OpenSpec 1.16.1 fixtures verified `openspec archive <change> --skip-specs --yes --json`: date-prefixed IDs remain stable, obsolete deltas do not alter main specs, and unfinished tasks remain unfinished. Expected historical warnings remain visible.

Restore the prior catalog, documentation and consumer files with an ordinary reviewed revert when rolling back the migration. Keep documentation history and the [original snapshots](../openspec/changes/archive/2026-11-13-legacy-documentation/disposition.md). Rerun source validation against the restored revision; do not force-rewrite repository history.
