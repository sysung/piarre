# Arena synthesis

Two independent configured candidates, Sol and Astra, planned this story. The parent read both end to end. Astra cross-judged evidence grounding, discovery validity, scope/authority, executable verification and reuse, each scored 0–2. These are review judgments, not measured model or product performance.

| Candidate | Evidence / discovery / authority / execution / reuse | Selected base |
| --- | --- | --- |
| A, Sol | 2/1/2/1/2 | No |
| B, Astra | 2/2/2/1/2 | Yes, repaired |

## Candidate A

## #83: templates, equipped skills and principles

**Objective/verdict.** Test whether users can inspect/import effective instructions and distinguish a template from a pinned session copy without extra supervision. Verdict: bounded roster/import discovery, no production agent library or multiwriter system selected.

**Implementation after review.** Add a disposable `test/agent-equipment/` roster and small canvas alternative, fixture import manifests and effective-instruction preview. Use actual `WorkerSpec`/`Assignment`/`assertCoordinationCurrent` from `packages/core/src/coordination.ts` and `parseCoordinationAction` as boundary references; existing `coordination-controller.ts`, `coordination-view.ts` and `coordination.test.ts` remain unchanged unless a separately accepted integration requires them. First parser supports one explicitly documented repository-local SKILL.md configuration; unsupported Codex/Claude fields remain displayed, not silently converted. Inventory grill-me/pstack/OpenSpec responsibilities by pinned source and loaded bytes, then propose one owner per lifecycle step.

**Tests first/falsification.** Proposed `test/agent-equipment/import.test.mjs`: repeat import stable identity, duplicate names, missing assets, override conflicts, linked-versus-copied source ownership, explicit-only skills retained and credential exclusion. Prototype tests ensure Add/copy does not launch, queued edits require manifest revalidation, active copies remain pinned, unknown writer and aggregate budget exhaustion block another writer. Composition fixtures must catch contradictory instructions; skill count alone cannot score success.

**Verification/pending.** `node --test test/agent-equipment/*.test.mjs`; keyboard walkthrough and actual human task comparison remain pending. #87 consumes selected version manifests; #102 measures later instruction-loading effects. Roster preference is prior design judgment, not usability proof. Reject silent conversion and full-library concatenation; defer runtime verification claims and broader format adapters until this slice demonstrates a usable import.

## Candidate B

## #83: templates, skills and passive principles

**Verdict and objective.** Test whether a roster plus inspector makes configuration understandable before creating an agent-management subsystem. Existing `CoordinationController.prepare/approveAndRun` and `parseCoordinationAction` allow bounded read-only assignments, not general templates/imports or multiple writers. The earlier arena preference is design judgment, not usability evidence.

**Small deliverable.** Add a disposable prototype under new `test/agent-equipment/` with sanitized source fixtures, `import-preview.mjs`, `import-preview.test.mjs` and keyboard-accessible roster/inspector HTML. Compare a small canvas rendering over the same data. Model template revision, session copy, skill availability/loading/invocation/unknown coverage, passive principle and enforced permissions separately. Preview Codex/Claude/repository mappings only for formats actually inspected; unsupported fields remain visible. Produce an owner map for grill-me/pstack/OpenSpec responsibilities, with exact versions and loaded volume.

**Tests first.** Copying an agent or importing performs zero launches and leaves source bytes unchanged. Cover duplicate import, changed source, override conflict, missing referenced asset, explicit-only skill, queued version edit, aggregate budget exhaustion and unknown writer state. Include a harmless same-name/different-scope control. Falsify consolidation when composition drops a requirement even if individual skill cases pass.

**Verify and pending.** Run `node --test test/agent-equipment/import-preview.test.mjs`; inspect the prototype with keyboard controls. Reuse existing coordination tests as contract evidence, without claiming the mock enforces runtime ownership. #87 consumes the proposed version manifest; neither depends on a new production template store. Humans must test scope/launch/cost predictions; actual behavior trials require later authorization. Copy-versus-link defaults and supported imports remain open; no automatic installation, rewriting or retirement is settled.

## Selected synthesis and rejected alternatives

Use repaired B as base with A’s single inspected local format and copied ownership. Add the complete optional onboarding path, queue-time revalidation, criterion-bound evidence and workspace-wide contention. Reject silent Codex/Claude fidelity promises and skill-count-only success metrics.

The selected base is B, repaired. The synthesized contract is in design.md and verification.md, which supersede any stale source or command examples in the candidate excerpts above. In particular, use benchmark PR #95 head `d12cc75`, the CONTAINER argument for native intent verification, and an installed-host route that cannot implicitly download VS Code. Both candidates converge on offline preparation and preserving the existing pilot; neither recommends claiming complete discovery results from fixtures.

## Review checkpoint

The current user decision covers all twelve stories, offline-only work and plan publication followed by human review. No Apply, TDD implementation, runtime verification, Interrogate of new code, Blast Radius execution or Archive is complete. All later tasks remain pending.
