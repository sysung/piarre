# Arena synthesis

Two independent configured candidates, Sol and Astra, planned this story. The parent read both end to end. Astra cross-judged evidence grounding, discovery validity, scope/authority, executable verification and reuse, each scored 0–2. These are review judgments, not measured model or product performance.

| Candidate | Evidence / discovery / authority / execution / reuse | Selected base |
| --- | --- | --- |
| A, Sol | 2/2/2/1/2 | No |
| B, Astra | 2/2/2/2/2 | Yes |

## Candidate A

## #79: retrieval alternatives

**Objective/verdict.** Prepare a fair, executable comparison of unchanged exact+FTS5 against one sourced relationship challenger. Verdict now: comparison not ready; PR97 is supporting narrow evidence, not completed human discovery.

**Implementation after review.** Extend `scripts/evaluate-project-retrieval.mjs` and `test/acceptance/retrieval-fixture.json`; retain exact/FTS5 semantics and fixed result budget. Use `ProjectRetrieval.rebuild/search/assertCapturedCurrent` in `apps/vscode/src/project-retrieval.ts` and `lookupCompilerReferences` in `technical-lookup.ts` as the actual seams. Add `test/retrieval-comparison/{manifest.json,README.md,*.test.mjs}` for frozen neutral arm mapping and reproducible offline launch/reset checks, not production ranking. Later each human-tested arm needs its own issue-linked branch/worktree/state/PR, including baseline, per retained requirements.

**Tests first/falsification.** Extend existing `project-retrieval.test.ts` cases for current accepted versus newer proposal, deleted/revoked evidence after warm lookup, changed-during-read and cross-project rejection. Add independently adjudicated rationale and dynamic-dispatch fixtures; no-edge means unknown coverage. Reject a challenger if it raises stale/unauthorized hits, loses required constraints, or adds no practical supported-answer benefit. Keep high fan-out/output bounds and cancellation controls.

**Verification/pending.** Run the existing retrieval evaluator and proposed fixture tests; record ingestion/update/query cost separately. No actual local answer scores this phase. #93 supplies fresh offline cases; #58 isolation and #88 local route remain prerequisites for runnable later arms. Human C79-COMPARE-R1 review and final selection remain pending; do not mark Ready until launch/stop/reset, independent review and model-backed prerequisites pass. Embeddings/reranking/graph services are deferred because PR97's simpler method already beats its semantic candidate narrowly.

## Candidate B

## #79: controlled retrieval A/B

**Verdict and objective.** Prepare a fair comparison; retain the exact/FTS5 baseline until evidence justifies a challenger. This discovery is not ready for human testing. PR #97's lexical top-two result is a narrow context-use result, not completion of the required baseline-versus-retrieval comparison.

**Small deliverable.** Extend `scripts/evaluate-project-retrieval.mjs` and `test/acceptance/retrieval-fixture.json` with a separately frozen case manifest and a bounded source-header/relationship challenger. Preserve the existing `exact`, `fts5`, `fts5-relations`, `compiler` methods and original corpus. Use `ProjectRetrieval.search/rebuild` in `apps/vscode/src/project-retrieval.ts` for production-baseline checks. Add new `test/retrieval-comparison.test.mjs` and a comparison guide/manifest under `test/retrieval-comparison/`. Do not introduce embeddings or a graph service given PR #97's negative dependency evidence.

**Tests first.** Include unchanged-source control, paraphrase miss, exact symbol, new proposal versus accepted decision, late history, source deletion after warm lookup, permission revocation, cross-project/environment collision, missing/dynamic relationships and context overflow. Add source edits during retrieval, high fan-out/slow provider, unavailable live-state evidence, cancellation and partial constraint coverage. Reject stale or unauthorized sources even when recall improves. Falsify the challenger if supported evidence does not improve at fixed top-k or any safety regression appears.

**Verify and pending.** Run `node --test test/retrieval-comparison.test.mjs`, `node scripts/evaluate-project-retrieval.mjs /tmp/79-results.json`, and relevant existing project-retrieval tests through an available host. After implementation approval, each human-tested arm needs its own issue-linked branch/worktree/PR, immutable bundle and verified start/stop/reset guide. Keep #58 isolation and #93 cases shared. Generated answers, source-applicability ratings and the explicit final human choice remain pending. The challenger and practical thresholds remain review decisions.

## Selected synthesis and rejected alternatives

Use B as base. Add A’s neutral arm mapping, assertCapturedCurrent checks, separate per-arm branches and explicit C79 checkpoint. Preserve every retained #79 requirement, including late history, revocation, slow sources and incomplete coverage. Reject a graph/vector rollout based only on the small historical keyword result.

The selected base is B. The synthesized contract is in design.md and verification.md, which supersede any stale source or command examples in the candidate excerpts above. In particular, use benchmark PR #95 head `d12cc75`, the CONTAINER argument for native intent verification, and an installed-host route that cannot implicitly download VS Code. Both candidates converge on offline preparation and preserving the existing pilot; neither recommends claiming complete discovery results from fixtures.

## Review checkpoint

The current user decision covers all twelve stories, offline-only work and plan publication followed by human review. No Apply, TDD implementation, runtime verification, Interrogate of new code, Blast Radius execution or Archive is complete. All later tasks remain pending.
