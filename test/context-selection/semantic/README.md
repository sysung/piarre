# Local semantic retrieval development evaluator

The answer model stays Qwen3.5 4B Q6_K. The added local Qwen3 embedding artifact indexes original source records; it does not generate knowledge. Both installed digests are pinned in the scripts and protocol. The embedding runtime reports its tag rather than resolved digest, so verify the installed artifact independently before and after the run.

Run the offline source-scope and freshness checks from the repository root.

```sh
node --test test/context-selection/semantic/retrieval.test.mjs
```

Copy `retrieval.mjs`, `run.mjs` and `report.mjs` to a fresh account-free run directory alongside the development `sources.json`, `questions.json` and `keys.json`. Save the host's `docker model inspect ai/qwen3-embedding:0.6B-F16` result as `model-installation.json`. The container must reach the private existing Model Runner endpoint. Never mount personal account data or a working project.

```sh
node run.mjs build
node run.mjs rank
node report.mjs
node run.mjs plan direct,lexical,dense,hybrid 1
node run.mjs answer
```

`build` serially embeds batches of at most four. The twelve-source/eight-query development cohort needs five embedding requests. Running `build` again validates the complete cache with zero requests. Partial logs prevent automatic retries. `rank` compares project-filtered Porter FTS5/BM25, dense cosine and reciprocal rank fusion with constant60, using top-three budgets. `report` reads private keys only after retrieval; keys never enter `run.mjs` or model requests. It reports required-source recall, not precision or answer correctness.

`plan` freezes every exact prompt and source fingerprint before inference. The development plan above has32 answer requests. Direct Qwen receives the entire original project pool. Retrieval arms receive their selected original records with the same metadata and instructions. Free prose is intentional; no forced summary or JSON output. Answer generation is serial with no retries. Completed truncations count as failures; an uncertain network outcome stops the run and requires inspecting backend inactivity before another experiment. Never overwrite a partial run.

Keep the independently authored holdout files unopened until selecting and freezing a candidate from development evidence. Hashes are in `holdout-manifest.json`. Compare at most one semantic candidate with the full-pool direct baseline on holdout, with two repetitions. A quality claim needs independent semantic review of original evidence, completion, source support and prerequisites. A recall gain alone is insufficient. This evaluator has no product integration or execution capability.
