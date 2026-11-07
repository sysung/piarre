# Context selection development evaluator

This synthetic fixture tests lexical retrieval, source-derived indexing descriptions, bounded Qwen source selection, and answer generation with the same passages in different orders. It records the source text, model output and usage returned by the runtime. The questions and rubric were frozen before generating descriptions. These cases are now exposed development cases. The initial author also reviewed the results, so fresh independent cases and adjudication are required before a product recommendation.

Use the existing pinned Qwen3.5 4B Q6_K artifact with digest `ea484046efba5fc126b1b331c2d590a20cb7d3abdfc65366a7f8b547350cd629`. The scripts require Node with fetch and node:sqlite, plus the private Docker Model Runner endpoint. Each response must identify the exact resolved model digest. Temperature is 0, thinking is disabled, generation is serial, and each request has a 60-second deadline. A failure stops the script. Existing output files prevent inference from being rerun over the same logs. A timeout requires confirming backend inactivity before starting another round.

Create a new isolated run directory and copy this folder into it. Record the git commit, file SHA-256 hashes, Docker Model Runner version, installed model digest, image digest, hardware and runtime context. Make the directory available to an account-free Node container that can reach `http://model-runner.docker.internal/engines/v1`. Run the following commands in that directory, in order.

```sh
node annotate.mjs
node retrieve.mjs
node rerank.mjs
node answer.mjs
```

The maximum is 56 local calls. Eight generate index descriptions from source text alone. Sixteen select relevant passages from each question's project. Thirty-two generate answers across the direct and relevance-order arms. Generated descriptions and selection requests never receive the expected-source labels or answer regexes. Answer requests receive the same original passages and instruction in both arms, with source order as the only input change. The relevance-order pipeline also incurs the selection-call cost, which must be included when reporting its total latency and usage.

`retrieve.mjs` compares raw conjunctive FTS5, raw disjunctive FTS5, and the disjunctive index with generated descriptions. These are diagnostic variants, separate from production retrieval. All use the same project filter, top-three budget and Porter tokenizer. Generated descriptions locate original passages and never become answer evidence.

`answers.jsonl` preserves outputs and the frozen regex result. Manually adjudicate questionable wording without rewriting the original scores. A correct yes/no answer may not need to restate every numeric threshold. A keyword match can also accept an answer that incorrectly says the evidence is insufficient. Report content correctness and citation coverage separately.

The fixture has eight short synthetic passages and sixteen questions. It covers semantic paraphrases, multiple facts, historical policy text, and unavailable evidence. It does not exercise runtime source edits, production state, the Extension Host, or larger corpus scaling.

## Evidence preparation versus direct refinement

A separate experiment uses the same full original sources in both arms with a two-call ceiling per arm. In the direct control, Qwen drafts an answer and reviews it against the sources. In the candidate, Qwen copies source quotations, code validates every quote as an exact substring of its named source, and Qwen then answers using the checked quotations plus the complete original sources. An invalid quotation fails that case. It is never replaced with a guessed source.

Run this comparison in a fresh isolated copy of the fixture directory.

```sh
node compare-preparation.mjs
node report-preparation.mjs
```

The sixteen current cases allow at most 64 generation attempts. The report verifies that each arm saw the same original passages and question, includes both stages in measured time and usage, and retains failed or missing cases in the denominator. It also checks the 6,000 UTF-8-byte production prompt ceiling. This experiment is inspired by source verification and decomposition research; it is not a reproduction of the full Chain-of-Verification method.

The automatic pass count checks required regex fragments and source IDs. It cannot prove that every added claim is supported or that mandatory conditions retain their force. Use reviewers whose criteria are recorded before they see anonymized outputs. Preserve the original automatic scores alongside reviewer decisions and disagreements. A small score gain with a weakened authorization or reconciliation requirement does not justify promotion.

## Extractive and decoding diagnostics

The `extractive` folder freezes a separate twelve-question mixture of lookup, application, computation, clarification and unavailable evidence. In a fresh isolated copy of that folder, run `node compare.mjs`. It caps the run at 36 local requests across direct generation, direct extraction with a brief inference summary, and source-ID selection followed by deterministic rendering of original passages. The two extraction formats receive distinct schemas because the representation is the experimental variable. Model weights, evidence, token ceiling and sampling settings match. Evaluate faithfulness and actual task completion separately. A quoted price table does not complete a requested calculation.

The `decoding` folder tests the original four exposed clarification failures with three repetitions and two configuration arms. In a fresh copy, run `node probe.mjs`. It caps the run at 24 requests and preserves complete request bodies and returned text. The requested alternatives are the current temperature-zero profile and Qwen's recommended general non-thinking sampling bundle. The current backend accepts documented fields, but this script cannot independently echo its effective sampler configuration. Treat any observed difference as a configuration experiment; do not attribute it to context retrieval.

The model-card recommendation and API field documentation are primary sources for this diagnostic. The model card also notes that sampling support varies by inference framework. [Qwen model card](https://huggingface.co/Qwen/Qwen3.5-4B) · [Docker Model Runner API](https://docs.docker.com/ai/model-runner/api-reference/)

These probes are development evidence. Three responses to the same question are repeated samples, not three independent tasks. Count a question mark separately from semantic usefulness: a reply can clearly request a missing fact in declarative wording, or ask a formally valid but irrelevant question.

The decoding runner also supports `roles`, `field`, `bridge`, `compact` and `plain` modes, for example `node probe.mjs field`. Use a fresh directory for each mode. Roles changes instruction placement; field changes only the output text key; bridge tests the combined reply-field candidate on captured production prompts; compact tests shorter instructions while retaining every source and metadata field; plain removes forced JSON output and compares indexed text with JSON input. Counts are 8, 8, 8, 12 and 8 calls respectively. `node probe.mjs MODE --dry-run` writes the planned requests without contacting a model. The request builder was checked offline against all 68 captured requests from the corresponding development probes.

## Frozen conversational reply comparison

The `reply` folder contains an independently authored sixteen-case mixture and a production Extension Host runner for candidate commit `2bf1d2f`. Build it with absolute candidate and fresh output paths.

```sh
node test/context-selection/reply/build.mjs /absolute/candidate /absolute/fresh-output
```

The builder checks the candidate commit, clean tree and fixed suite hash. It performs no inference. Run the generated `runner.cjs` as VS Code 1.144.0's `--extensionTestsPath` with the candidate extension and an isolated workspace/profile. An account-free Docker host must reach the existing private Model Runner endpoint. Mount the candidate read-only and the output directory writable. Do not mount personal account data or a working project. Use Xvfb directly where the image lacks xauth.

The maximum is 64 serial local calls, two repetitions per case and arm. The candidate uses the production controller and client, validates its response, saves citations, and reopens SQLite. Direct Qwen receives all the same source texts with confirmed status in indexed plain text and can answer freely with inline citations. Neither arm receives the private criteria. The baseline is not forced into a summary schema. Runtime errors count as failures. The log captures dispatches, original envelopes, accepted answers, errors, source mappings and persistence checks. Stop on an interrupted run and inspect backend activity before any further experiment. Never overwrite or silently retry a partial run.

Use the fixed semantic criteria with anonymized outputs. Valid direct inline citations and candidate attached citations both count. A clear request for a missing fact can be declarative. Two repetitions diagnose quality consistency, not statistical generalization or a latency advantage. The synthetic suite becomes development data after this comparison. See `reply/protocol.md` for the frozen protocol.

The separate `calculation` prototype follows the relevant-only oracle failure. It interprets source-linked numeric tokens, evaluates bounded arithmetic without executing generated programs, and audits complete answers under a two-call ceiling. Its initial eight-call development screen includes an authorization prerequisite and a missing fact. It is research tooling, with no production integration or superiority claim.
