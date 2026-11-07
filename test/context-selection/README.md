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
