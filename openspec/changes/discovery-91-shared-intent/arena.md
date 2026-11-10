# Arena synthesis

Two independent configured candidates, Sol and Astra, planned this story. The parent read both end to end. Astra cross-judged evidence grounding, discovery validity, scope/authority, executable verification and reuse, each scored 0–2. These are review judgments, not measured model or product performance.

| Candidate | Evidence / discovery / authority / execution / reuse | Selected base |
| --- | --- | --- |
| A, Sol | 2/2/2/1/2 | No |
| B, Astra | 2/2/2/2/2 | Yes |

## Candidate A

## #91: shared accepted intent

**Objective/verdict.** Evaluate one accepted understanding shared by human and agent. Verdict: continue existing validation-first PR101 pilot, not another intent store or second prototype.

**Implementation after review.** Build on PR101 only after explicitly selecting that unmerged dependency. Extend `test/intent-pilot/BASELINE.md`, `README.md` and a machine-readable effort/outcome worksheet plus missing disposable conflict fixtures. Actual seams are `parseIntentMarkdown/renderIntentMarkdown/parseReviewedIntentDocument` in `packages/core/src/intent-document.ts` and `IntentDocuments.inspect/preview/adopt/handoff/exportHandoff`; existing test suites are `intent-document.test.ts`, `intent-documents.test.ts`, `intent-commands.test.ts`. Compare repo-native accepted snapshots plus authoritative adoption events with database-owned readable exports on the same small fixture, documenting ownership per record type rather than building both product architectures.

**Tests first/falsification.** Direct edit remains proposed; stale review refuses adoption; altered/missing accepted snapshot blocks handoff; rename/deletion, older branch, divergent accepted edits and crash/retry cannot revive acceptance or evidence. Preserve original negation, quantities, unknowns and unrelated records. Add only uncovered cases after reading existing 15-check/52-native evidence; do not rerun duplicate investigations for appearance.

**Verification/pending.** `npm run check`, contract checks, existing intent suites; `node scripts/verify-intent-prototype.mjs CONTAINER NEW_OUTPUT` only on its already-supported isolated environment. Real Markdown baseline, OpenSpec comparison, genuine resumed tasks and human continue/narrow/stop decision remain pending. #92 consumes exact accepted identities; #87 is its scope example. Reject storage replacement before pilot evidence. A technically passing prototype can still fail the effort/maintenance hypothesis.

## Candidate B

## #91: shared accepted intent

**Verdict and objective.** Continue the validation-first pilot using PR #101. Do not build a second accepted-intent system. Its parser, adoption and handoff implementation is concrete; maintenance value and everyday usefulness remain unknown.

**Small deliverable.** Extend existing `test/intent-pilot/README.md`, `BASELINE.md` and fixtures with the #87 restore requirement and a storage-option comparison. Add missing branch/divergence cases to `apps/vscode/test/suite/intent-documents.test.ts` and `intent-document.test.ts`. Use `IntentDocuments.preview/adopt/handoff`, `parseIntentMarkdown`, `parseReviewedIntentDocument` and the current SQLite adoption history. Inspect canonical ownership for each alternative: readable files alone, database plus exports, and the existing hybrid whose accepted snapshots are selected by events.

**Tests first.** Freeze negation, scope and unknowns across human/agent renderings. Include dirty edits, old branch, divergent accepted record, rename/deletion, replay after interrupted adoption, tampered snapshot and missing dependency links. Unchanged imported metadata must not fabricate correction impacts. A material correction must stale linked evidence while leaving unrelated history intact. Reject any result that treats a saved file or copied acceptance label as adoption.

**Verify and pending.** On the PR #101 revision run `npm run check`, `npm run test:contract`, and its documented `node scripts/verify-intent-prototype.mjs piarre-sandbox-piarre-1 NEW_OUTPUT` only if that existing isolated host is available. Preserve loaded-runtime hashes and event readback. Compare plain Markdown, OpenSpec and the prototype through the existing 120-minute pilot; two genuine resumptions and voluntary preference remain human work. Source portability and branch-wide authority remain explicit decisions. This is the first dependency for later #102–#106 execution, not a prerequisite for writing their plans.

## Selected synthesis and rejected alternatives

Use B as base with A’s add-only-uncovered-tests rule and machine-readable effort worksheet. Correct native syntax to CONTAINER, not PROFILE. Preserve the 120-minute pilot and original author/adopter distinction. Reject a second intent store or a claim that technical tests establish usefulness.

The selected base is B. The synthesized contract is in design.md and verification.md, which supersede any stale source or command examples in the candidate excerpts above. In particular, use benchmark PR #95 head `d12cc75`, the CONTAINER argument for native intent verification, and an installed-host route that cannot implicitly download VS Code. Both candidates converge on offline preparation and preserving the existing pilot; neither recommends claiming complete discovery results from fixtures.

## Review checkpoint

The current user decision covers all twelve stories, offline-only work and plan publication followed by human review. No Apply, TDD implementation, runtime verification, Interrogate of new code, Blast Radius execution or Archive is complete. All later tasks remain pending.
