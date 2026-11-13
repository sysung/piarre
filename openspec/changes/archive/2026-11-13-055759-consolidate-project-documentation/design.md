# Design

## Context

See [proposal.md](proposal.md) for the motivation and scope. Planning uses OpenSpec 1.16.1 and the existing local root. At inspection, HEAD is `a16447a9dbeac224d1ffc1c793fb1a14ea12576a`; locally cached `origin/master` is `8a8b7ab38d9cb0d272389ef89a089e5cee9b7832`, 30 commits ahead. The remote revision was subsequently verified as `8a8b7ab38d9cb0d272389ef89a089e5cee9b7832` before creating issue #121 and an isolated implementation checkout. README and the index contain local edits; generated skills, research and seven specs are untracked.

The seven draft main specs contain 17 requirements. They do not represent a complete adopted baseline. Newer cached source contains P13/P14 principles, candidate/diagnostic instructions and reflection instructions absent from this checkout. The acceptance catalog has 21 scenarios, four automated and 17 pending. `scripts/accept-candidate.mjs` reads the PRD/technical files live and allows only their two paths with exact level-two headings. Its principle inventory additionally carries historical PRD revisions and hashes. The retrieval evaluator resolves ten source paths with `git show` at a fixed revision. The documentation test requires exactly four files; its obsolete 04 filename is already corrected on cached origin/master, but the four-file restriction remains.

The existing `test:contract` command runs scaffold, editor-boundary and repository-root tests. Standard tests run that suite before Host checks. The source resolver therefore needs a pure validation entry point exercised by the contract suite; running the full acceptance harness is unsuitable for documentation reference checks because it requires a clean checkout and can launch Host tests.

## Goals / Non-Goals

**Goals**

- Give humans and agents one adopted requirements baseline and inspectable changes, with accessible explanatory documentation and verification instructions.
- Preserve retired content, provenance, pending criteria and experimental decisions while making their status explicit.
- Keep code, documentation and verification revision-bound in one checkout and support a safe consolidation and rollback.

**Non-Goals**

- Implementing Piarre product features, choosing new product direction, or treating a research recommendation as an adopted pivot.
- Rewriting existing Git history, upgrading OpenSpec, or reducing old Git object storage by deleting historical documentation.
- Running application acceptance tests merely to establish that document paths resolve.

## Decisions

### D1. Keep documentation and OpenSpec together in Piarre

The user selected one repository for simplicity on 2026-11-13. Keep the consolidation decisions and reuse staged content instead of reverting the work. The target layout is:

```text
piarre/
  README.md
  docs/overview.md
  docs/USER_DESIGN_PRINCIPLE.md
  docs/workflow.md
  docs/research/
  openspec/config.yaml
  openspec/specs/
  openspec/changes/archive/
  .agents/skills/
```

README retains installation, development, first-use, candidate and diagnostic instructions. The overview explains purpose, direction, architecture and authority with links to contracts. The workflow guide owns contributor procedures. Rename the current `docs/03_USER_DESIGN_PRINCIPLES.md` to `docs/USER_DESIGN_PRINCIPLE.md`, preserving its content and updating live consumers. Historical snapshots retain original paths. Keep dated research and reflection guidance accessible.

The earlier separate Store and wiki options are superseded. Do not add a `store:` pointer, `docs-lock.json`, second checkout, Store registration requirement or cross-repository CI credential to the delivered branch. Large recordings and logs may still use durable artifact storage with evidence links. The measured text corpus was about 73 KB before planning; size does not justify the additional repository setup.

### D2. Use one Git revision for code and documentation

Resolve current OpenSpec references from the selected Piarre checkout. Capture one full Git SHA for revision-bound acceptance and verify that the checkout remains at that SHA and clean through evidence collection. Read committed source content at that revision for strict checks. Explicit preview may inspect draft working files, but it remains unverified and cannot satisfy acceptance.

Keep ordinary source-validation tests runnable on a dirty development tree or disposable fixture; they do not claim acceptance. Test missing/inaccessible local documents, unavailable revisions, dirty acceptance checkouts and changes during verification. Reject path escape and accidental resolution from another repository. No external Store fallback or separate lock is needed.

CI checks out Piarre with sufficient Git history for pinned historical sources, runs source contracts and the applicable quality checks, and needs no documentation deploy key. Publish one implementation PR containing documentation and tooling. History and later evidence can link the resulting commit without requiring that commit to contain its own hash. Later documentation edits do not rewrite earlier evidence and require re-verification when they affect the tested criteria.

### D3. Make OpenSpec authoritative and preserve discovery freedom

Main specs define adopted product requirements. Active changes define the scope and decisions of their proposed work. Discovery issues and branches can make reversible working decisions within that scope. A proposed change does not supersede adopted specs merely because it was created later. Adoption records the user decision or previously delegated authority and the applicable scope.

Issues link the relevant change and verification section. A conflict between an issue, working decision and OpenSpec is presented to the user before work depending on that conflict proceeds. Record the resolution in the change and update the issue link/context. Update surviving ownership prose, including the design-principles introduction, to this policy. Source code and verification evidence continue to describe actual implementation and observations at their recorded revisions.

For this migration, classify every legacy passage as adopted contract, explanatory context, experimental/open decision, superseded decision, or historical evidence. Preserve the complete old documents as historical sources even where a passage is extracted. The automatic memory-capture trigger remains an open decision; the existing knowledge spec's conditional provenance behavior does not resolve it. New product requirements discovered by this audit require a separate proposal and appropriate adoption.

### D4. Preserve legacy documents and abandoned discoveries without activating their deltas

Create a timestamped legacy-documentation change containing the original PRD, technical design and index as source snapshots, a disposition map, original code-repository SHA/path and byte hashes. Capture dirty working versions distinctly from committed originals if they contain useful work. Mark this migration history as historical/superseded, with a plain explanation of which material remains adopted and where to find it.

Archive this documentation-only record with spec synchronization skipped. For future abandoned discovery changes, record abandonment, reasoning and any reusable findings, then archive without syncing their proposed requirements. Keep ordinary schema validation for normal deltas. Verify the installed tool's abandoned/incomplete-task behavior in an isolated fixture before defining the routine; never mark unfinished implementation tasks complete to obtain a clean archive status. Preserve the explicit abandoned outcome in reports and allow for the installed `validate --archived` command's completed-task expectation when choosing checks.

A user may discard a disposable branch, but the durable change record retains the decision when future reuse is desired. Historical source material stays distinct from active contracts in navigation and agent guidance.

### D5. Use stable UTC creation IDs plus explicit lifecycle history

New change names follow `YYYY-MM-DD-HHMMSS-slug` using UTC. On an exact collision, choose another descriptive suffix rather than overwriting a change. Preserve the ID on archive; date-prefixed IDs already avoid a second date prefix in the installed archive workflow. Record `Created at` with an ISO-8601 UTC timestamp in the proposal's History section. The installed `.openspec.yaml` date may reflect local calendar date; it is not the ordering key. Existing change IDs remain stable unless a separate, fully referenced rename is justified.

Each proposal History section records current outcome (proposed, discovery, accepted, implemented, abandoned or superseded), created/accepted/merged/archived timestamps when known, originating issue, originating PR/commit, implementation PR/commit, verification evidence, and dependencies/supersession links. Unknown events stay explicitly pending. These are project conventions in Markdown, not unsupported native OpenSpec metadata fields.

Use `openspec list --all --sort name` for creation order. Git PR merge timestamps establish integration order. Dependencies and supersession establish causal relationships. A useful human history table can link those recorded events without copying proposal content. Do not infer dependency from a timestamp or filesystem modification time.

### D6. Preserve live acceptance semantics and pinned historical sources

Replace the hardcoded PRD/technical allowlist with scoped references to the selected Piarre checkout. Give each catalog scenario one or more exact requirement/scenario references, or an explicit open-change reference for pending work. Resolve paths within the selected checkout, reject path escape, and check precise headings/identities. Preserve each scenario ID, owner, requirement text, test names and pending status unless a separately authorized requirements change says otherwise. Validate semantic coverage during review, since a heading's existence alone cannot establish equivalence.

Factor source validation out of the acceptance runner so tests exercise the same resolver without invoking generation, Host tests or network. Bind acceptance source provenance to the same Git revision as the code. Replace the exact-four-documents assertion with entry-point and local reference checks appropriate to the new layout.

Keep historical `principles.json` source tuples and retrieval-fixture paths/revisions/hashes unchanged. Their source repository remains the code repository even after the live documents move. Ensure CI has the referenced Git objects through appropriate checkout/fetch depth. New historical records explicitly identify the source repository. Dated research links to the historical document version being discussed, with separate navigation to current context.

### D7. Keep one human-readable verification plan and link it

The canonical plan for this change is [Verification plan](#verification-plan) below. Tasks and issues reference its check IDs. Future substantive changes may put the canonical plan in their design or a dedicated verification document when the schema supports it. Plan placement must be declared and linked once. A result records outcomes and evidence rather than copying the instructions. Humans can compare each check to the adopted/proposed requirement it tests, and contradictions are handled under D3.

## Risks / Trade-offs

- Losing useful staged work: copy the consolidated guides, specs, pending criteria and snapshots back into the isolated Piarre branch, verify manifests, then adapt live links.
- Promoting obsolete ideas: retain passage dispositions, explicit pending/abandoned outcomes and skip synchronization for historical changes.
- Stale evidence: bind code and documentation to one revision, reject dirty strict acceptance and preserve previous results as historical.
- Duplicate prose: use short guides and exact links to contracts and the canonical verification plan.
- Superseded setup: the private `sysung/piarre-docs` repository, read-only deploy key and code-repository `PIARRE_DOCS_DEPLOY_KEY` secret already exist. They are not runtime dependencies and must not appear in the delivered workflow. Deleting remote resources or revoking credentials is a separately scoped cleanup decision, not an implicit rollback.

## Migration Plan

1. Retain the preserved original dirty tree, issue #121, isolated branch and verified baseline inventory. The staging area is `/private/tmp/piarre-docs-migration-121`; its `code`, `piarre-docs` and `inventory` directories contain reusable work.
2. Copy the consolidated human guides into the isolated Piarre branch's `docs/`, and the complete planning/spec/archive corpus into its local `openspec/`. Resolve this updated plan as authoritative over older staged copies. Verify all snapshots and catalog mappings.
3. Adapt the partially implemented exact source resolver and its tests to one checkout and SHA. Retain useful path/heading/provenance tests; remove tests and implementation that only exercise the superseded external Store or lock. Preserve behavioral TDD evidence for the revised boundary.
4. Update acceptance reporting, contract registration, local documentation navigation and CI. Preserve required history checkout depth, and omit the second checkout and credential use. Retire the legacy live index/PRD/design only after their retained sources and replacement consumers pass.
5. Verify a fresh single-repository checkout, the canonical V01–V12 criteria and rollback fixture. Publish one reviewable PR with exact-revision evidence.
6. Archive the completed migration after tasks and applicable verification pass and final review is satisfied.

Rollback uses a normal reviewed revert of the single-repository consolidation to restore the previous live paths and consumers. Preserve snapshots and evidence; do not rewrite shared Git history or delete the staged inventory.

## Verification plan

Run in isolated Piarre checkouts. CLI fixtures use temporary OpenSpec configuration/data directories without changing personal registrations. Record CLI version, platform, the single code-and-documentation SHA, commands, exit status and evidence location. Use passed, failed, blocked or unverified outcomes. Structural checks and application-runtime evidence have separate scopes.

| ID | Preconditions and action | Expected result and evidence |
| --- | --- | --- |
| V01 | Inventory target legacy documents, draft specs and 21 catalog scenarios; compare before/after disposition records | Every passage has a retained destination or explicit retirement reason; all original bytes remain in hashed snapshots; preserve scenario IDs/owners/test names and the target baseline's statuses. Baseline observed here is 4 automated/17 pending; explain any legitimate newer-target difference. |
| V02 | Run context/list/doctor from the Piarre root and child directory in a fresh checkout without any registered documentation Store | Commands select the local root and the expected specs/changes. There is no Store pointer, lock, second checkout or external-documentation credential requirement. Capture command output and manifests. |
| V03 | Resolve local sources at the selected revision; exercise missing/inaccessible files, unavailable revision, dirty strict acceptance, and a revision/source change during verification | Valid sources resolve within the Piarre checkout; failures are actionable and cannot yield current acceptance. Preview remains explicitly unverified. Contract tests can still inspect working drafts without claiming acceptance. |
| V04 | Resolve every migrated catalog reference, then remove a target scenario, substitute a similarly named unrelated heading and attempt a path escape | All valid references resolve exactly; corrupted references fail with the scenario ID and cause. Review before/after requirement coverage separately. Run the same resolver in the acceptance runner and contract suite. |
| V05 | Resolve every historical product source in principles.json and every pinned retrieval source using its original repository/revision/path; compute recorded hashes | Both distinct current historical PRD hashes match and ten current retrieval inputs remain available. Inventory values are unchanged; missing Git history fails clearly. Record object IDs and hashes. |
| V06 | Archive a legacy fixture and an abandoned discovery fixture with obsolete delta content using the selected skip-sync path | Main spec bytes remain unchanged, outcomes remain visible, unfinished tasks remain truthful and snapshots remain readable. Record before/after hashes and expected incomplete-task warnings. |
| V07 | Create two timestamped fixture changes, accept/archive them in reverse order and list all by name | Creation order remains A then B; history accurately shows reverse acceptance/archive order. IDs survive archive, duplicate IDs cannot overwrite, and the creation timestamp's UTC date is explicit. |
| V08 | Follow originating issue/PR/commit, implementation commit, supersession and verification links from a completed fixture/history entry | Links identify the intended Piarre revision. Unknown events stay pending. Results name the single revision actually checked and remain historical after later edits. Validate real remote links when published. |
| V09 | Follow root README to overview, principles, current capability, proposal, canonical plan and legacy snapshot | A human can locate each without a second competing requirements account. Verify the maintained principles file is `docs/USER_DESIGN_PRINCIPLE.md`, no live consumer still targets its numbered predecessor, and historical references retain their original paths. Check relative links/anchors and reviewer-accessible external links. Confirm preservation of first-use, candidate, diagnostic and reflection instructions from the target branch. |
| V10 | Review a sample discovery issue whose decision conflicts with a spec and a sample record of optional memory capture | The conflict is surfaced with both sources and resolved by the user before dependent execution. Open capture policy remains explicitly open until decided. Check every surviving authority declaration against D3. |
| V11 | Compare the canonical verification plan with tasks, requirements and issue links, then record a sample failed outcome | All checks trace to relevant decisions/criteria; instructions live in one place, links resolve, and failed/unverified outcomes cannot be reported as completed verification. |
| V12 | Run contract tests, project quality checks and strict OpenSpec validation against the final Piarre revision; exercise rollback in a fixture | `npm run test:contract` and applicable `npm run check` succeed; selected active/spec artifacts validate; historical abandonment exceptions are explicit. The reverted checkout resolves its prior documentation, preserved history remains intact, and CI needs no external documentation checkout or key. |

Public test boundaries for implementation are the source-resolver inputs/results, actual CLI local-root resolution in isolated fixtures, and the human documentation entry points. Use one failing scenario and minimal implementation at a time for resolver/contract changes. Confirm these boundaries under the selected TDD workflow when implementation begins. No test should merely assert that an invented directory count matches this design.

Verification completion requires V01–V12 evidence or an explicitly accepted limitation linked to the affected criterion. This planning run only checks artifact coherence, links and OpenSpec structure. Execution evidence is collected during implementation.

## Open Questions

No storage decision remains open. The user selected repository-local documentation. Remote cleanup is optional and separately scoped; it does not block the migration.

## Implementation evidence carried forward

The independent inventory verified 26 snapshot hashes, all 255 nonblank target-document lines, 21 catalog rows, two historical PRD hashes and ten retrieval sources. Local links and archive/chronology fixtures passed in staging. These results are reusable inputs, not proof that the revised single-repository integration is complete. Destination-dependent tasks are reopened for copying, adaptation and re-verification.

## History

See the canonical [proposal History](proposal.md#history) for lifecycle dates and provenance.
