# Local discussion iteration benchmark

Use Node 22.12+, the repository's installed dependencies, pinned VS Code 1.144.0, and the existing Docker Model Runner installation. The runner checks the installed model digest and refuses an unrecognized inference endpoint through the production adapter. Use a disposable VS Code host that can reach the Docker internal endpoint. A previously configured literal loopback endpoint can be passed in `PIARRE_BENCHMARK_ENDPOINT`.

```sh
node scripts/iteration-benchmark.mjs validate
node scripts/iteration-benchmark.mjs run probe "$B0" "$C1" "$NEW_PROBE_OUTPUT" "$CODE"
node scripts/iteration-benchmark.mjs run paired "$B0" "$C1" "$NEW_PAIRED_OUTPUT" "$CODE"
node scripts/iteration-benchmark.mjs score "$NEW_PAIRED_OUTPUT" "$NEW_SCORE_FILE"
```

Use absolute paths. `B0` is a clean checkout of PR #89's frozen revision. `C1` is a clean checkout of a later revision. `CODE` points to the VS Code executable or an equivalent launcher that forwards the arguments and keeps the process attached. On Linux, provide a display such as Xvfb. Launch from an account-free environment and mount only the frozen baseline and generated run directory. The output directory must be new. Start a fresh run directory for each authorized round and retain previous output.

The probe phase sends three known development prompts to B0. Freeze the candidate before running the paired phase or opening held-out output. The runner emits the chronological inputs without answer keys, the exact bundle hashes, and an append-only attempt log. An unknown result stops the run because delivery cancellation cannot establish that the runtime stopped. Keep logs outside the model workspace. Published examples belong in development once used to tune a candidate.

The generated cases exercise the production discussion controller, transport, source selection and SQLite replay from an Extension Host. The control cases cover stale and wrong-project references. Regex checks provide a reproducible first pass. For consequential or ambiguous scoring, use an independent reviewer with arm labels hidden, and preserve their adjudication separately. The runner does not exercise installed UI actions, retrieval ranking, coding, or human supervision. Report those from their own test surfaces.
