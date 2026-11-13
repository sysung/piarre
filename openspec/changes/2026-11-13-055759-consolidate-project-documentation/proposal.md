# Proposal

## Why

Piarre's broad PRD, technical design, index and draft OpenSpec baseline overlap and mix adopted requirements with experiments. Consolidation should make current intent easy to find while preserving earlier decisions, human-readable verification and exact links between documentation and code revisions.

## What Changes

- Establish OpenSpec specs and changes as the authoritative requirements and planning records. Discovery issues test feasibility within their recorded scope. Bring issue/spec conflicts to the user and record the resolution.
- Keep all maintained documentation and OpenSpec records in the Piarre repository. Use README for getting started, `docs/` for human guides and research, and `openspec/` for contracts, scoped changes and history.
- **BREAKING** Retire live `docs/00_README.md`, `docs/01_PRODUCT_PRD.md`, and `docs/02_TECHNICAL_DESIGN.md` paths after migration and replace live consumers with version-bound references. Preserve original legacy bytes and dispositions in a historical OpenSpec change that does not synchronize obsolete requirements into main specs.
- Rename the maintained `docs/03_USER_DESIGN_PRINCIPLES.md` to `docs/USER_DESIGN_PRINCIPLE.md` within Piarre and update live links and consumers; preserve historical revision/path references.
- Give each new change a UTC creation timestamp identifier and a readable history with lifecycle dates, PR/commit links, dependencies, and supersession. Preserve creation identifiers through archival and distinguish creation order from acceptance and merge order.
- Keep one canonical human-readable verification plan per substantive change and link to it from tasks, issues and guides. Bind recorded results to the single Git revision containing code and documentation.
- Adapt acceptance-source checks, documentation contracts and CI to repository-local OpenSpec sources while preserving pending outcomes and historical benchmark sources.

## Capabilities

### New Capabilities

None. This change reorganizes repository documentation and contributor tooling. Acceptance criteria are recorded in the design and its canonical verification plan.

### Modified Capabilities

None. Existing product capability requirements will be preserved or explicitly classified during migration. Any newly discovered product behavior change requires its own change proposal. This change declares `skip_specs: true` because it does not introduce product behavior.

## Impact

Affected material includes README, the documentation corpus, repository-local OpenSpec configuration and generated integrations, `scripts/accept-candidate.mjs`, `test/acceptance/catalog.json`, `test/scaffold-contract.test.mjs`, `package.json` contract-test registration and CI checkout configuration. `test/acceptance/principles.json` and the retrieval fixture contain historical provenance that must retain its original revision/path/hash semantics.

No separate documentation checkout, Store pointer, documentation lock or cross-repository CI credential is required. Reuse the staged consolidation, snapshots, exact source checks and verification work; adapt their paths and revision handling to this repository. Detailed implementation and verification live in [design.md](design.md) and [tasks.md](tasks.md).

## History

- Created at: 2026-11-13T05:57:59Z (2026-11-12 in America/Chicago).
- Outcome: implementation in progress; storage design revised by the user on 2026-11-13.
- Origin: this conversation's documentation consolidation review and user annotations.
- Originating issue: https://github.com/sysung/piarre/issues/121. Implementation branch: `codex/121-consolidate-documentation`. PR/commit and final verification evidence: pending.
- Accepted, merged and archived at: pending.
- Dependencies: no prerequisite change identified; the selected target revision is `8a8b7ab38d9cb0d272389ef89a089e5cee9b7832`.
- Supersedes: the informal recommendation to discard legacy documents after extraction; this proposal preserves their historical bytes.

- Storage decision: the user superseded the separate `piarre-docs` Store with one repository on 2026-11-13. Preserve consolidation work; omit the external Store, lock and cross-repository CI integration. The already-created private repository and credentials remain unused setup, not required dependencies.
