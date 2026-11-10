# Arena synthesis

Two independent configured candidates, Sol and Astra, planned this story. The parent read both end to end. Astra cross-judged evidence grounding, discovery validity, scope/authority, executable verification and reuse, each scored 0–2. These are review judgments, not measured model or product performance.

| Candidate | Evidence / discovery / authority / execution / reuse | Selected base |
| --- | --- | --- |
| A, Sol | 1/2/2/2/2 | Yes, refreshed |
| B, Astra | 2/1/2/2/2 | No |

## Candidate A

## #93: held-out retrieval improvement

**Objective/verdict.** Measure rationale and dependency misses beyond the authored #66 probes. Verdict: prepare fresh deterministic evidence; #88 actual local inference remains a completion blocker under offline-only scope.

**Implementation after review.** Extend existing `scripts/evaluate-project-retrieval.mjs` with explicit development/heldout manifests, scorer mutation checks and separate retrieval versus answer reports; keep `test/acceptance/retrieval-fixture.json` historical. Reuse #97 `test/context-selection/retrieve.mjs`, semantic protocol and preserved holdout artifacts as exposed development evidence. Share new scenario IDs/results with #94 rather than clone its runner. Exact+FTS5 versus bounded sourced reverse-module relationships uses fixed evidence limit and identical frozen source snapshot; compiler references apply only to suitable static questions.

**Tests first/falsification.** Independently author new rationale paraphrase, multi-file relation, changed/conflicting decision, unanswerable and naturally occurring versus explicitly injected dynamic-dispatch cases. Expected evidence is verified against blobs; answer keys never enter dispatched context. Wrong static edges, unavailable trace, rename/deletion, permission change and project mismatch must reject or report incomplete coverage. Mutate an expected source and demonstrate scorer failure. Retain every case where expansion regresses precision or applicability.

**Verification/pending.** Existing evaluator plus proposed `node --test test/retrieval-comparison/*.test.mjs`; #94 `validate`/`validate-stress` are offline when dependencies are available. Freeze actual local artifact/runtime/hardware before later identical-model arms and score answer support/abstention separately. No fresh local run is authorized now; do not label mocks completion. #79 consumes this evidence but still needs separate runnable arms and human selection. Reject embeddings/graph database absent a demonstrated unresolved miss worth their cost.

## Candidate B

## #93: held-out retrieval extension

**Verdict and objective.** Preserve #97's useful narrow result and complete the missing protocol preparation. It does not satisfy the requested exact/FTS5-plus-relationships study or the production local-controller prerequisite merely because local calls occurred elsewhere.

**Small deliverable.** Extend `scripts/evaluate-project-retrieval.mjs` with a distinct held-out manifest input while retaining the original fixture and unchanged baseline. Add new `test/acceptance/retrieval-heldout.json` and evaluator tests. Reuse #94's manifest/result schema to separate evidence recall from answer support, unsupported claims and abstention. PR #97's `test/context-selection/semantic/retrieval.mjs` and `retrieval.test.mjs` supply scope/freshness examples, not a fresh holdout. Its lexical/direct/dense comparison found a distractor-use difference despite full required-source coverage.

**Tests first.** Cover exact lookup, paraphrased rationale, multi-file relation, stale/conflicting decisions, no answer, and natural versus injected dynamic dependency. Reject static edges presented as observed execution. Verify fixed top-k, source hashes, answerability and project isolation; a deletion/rename must invalidate cached evidence. Use an unchanged baseline control and a deliberately incorrect scorer case. Failed holdouts become named regressions rather than remaining secretly eligible for retuning.

**Verify and pending.** Run the existing evaluator, new Node tests and #94 `validate`/`validate-stress`, with zero model requests. Freeze independently authored questions and private keys before tuning. #88/#89's exact artifact/runtime is required for later actual paired inference, and source-supported semantic review remains pending. #79 consumes this evidence but keeps its own human comparison. Recommend bounded relationships only if fresh results justify them; defer embeddings/reranking absent demonstrated misses. No completed-discovery claim is possible offline-only.

## Selected synthesis and rejected alternatives

Use A as base for the explicit unchanged exact+FTS5 versus bounded reverse-module relationship comparison. Refresh #94 to d12cc75 and graft B’s distinction between full source coverage and distractor-use failure. Reject lexical-only retesting, fake fresh holdouts and completion from retrieval-only checks.

The selected base is A, refreshed. The synthesized contract is in design.md and verification.md, which supersede any stale source or command examples in the candidate excerpts above. In particular, use benchmark PR #95 head `d12cc75`, the CONTAINER argument for native intent verification, and an installed-host route that cannot implicitly download VS Code. Both candidates converge on offline preparation and preserving the existing pilot; neither recommends claiming complete discovery results from fixtures.

## Review checkpoint

The current user decision covers all twelve stories, offline-only work and plan publication followed by human review. No Apply, TDD implementation, runtime verification, Interrogate of new code, Blast Radius execution or Archive is complete. All later tasks remain pending.
