# Local discussion iteration benchmark

## Additional synthetic stress slice

The original development/holdout files and earlier results are unchanged. Ten new
regression families live in `stress-cases.mjs`: three necessary sources; withheld
third evidence after review; a fresh rationale paraphrase; conflicting confirmed
records; withdrawal after restart; request versus approval; unverified runtime
claims; an eleven-record distractor context; stale sources; and project isolation.
The explicit two-topic selection is a source-review fixture, not integration of
the experimental ranking algorithm. The larger context can be reported as
unsupported at the existing 6,000-byte limit; no source is silently truncated.

```sh
node --test test/iteration-benchmark/metrics.test.mjs
node scripts/iteration-benchmark.mjs validate-stress
node scripts/iteration-benchmark.mjs freeze-stress /absolute/new-freeze.json
node scripts/iteration-benchmark.mjs run stress "$B0" "$C1" "$NEW_STRESS_OUTPUT" "$CODE"
node scripts/iteration-benchmark.mjs score "$NEW_STRESS_OUTPUT" "$NEW_SCORE_FILE"
```

The stress schedule caps generation at 40 requests, uses both existing build arms
and two repetitions, and retains the cold/reset comparison for the withdrawal
sequence. All cases are exposed synthetic regression material: no independent
holdout or representative real-project accuracy claim is made. The stress
scorecard deliberately returns insufficient evidence for promotion.

The scorecard separates supplied required-evidence coverage from answer checks
and question counts. Unsupported claims need independent semantic review;
token usage is unavailable through the current production adapter. Both are
`null`, never a fabricated zero. Duplicate or unscheduled results reject scoring;
missing results and error rows cannot count as a completed run.

Offline validation on Node 24.22.1: three metric/fixture tests and scorer self-check
passed; runner and host syntax checks passed. Model requests: zero. Full host
bundle, actual controller execution, direct-Qwen diagnostic and model quality
evaluation are **not run**. Docker is unavailable and esbuild setup did not
complete in this environment. Automatic approval review also blocked copying the
production controller locally because of its configured-provider disclosure
capability; no provider call or disclosure was attempted.

Before accuracy evaluation, freeze candidate/build/model/rubric and an independently
authored new holdout with source, question and private-key hashes. Keep the keys out
of the dispatched manifest. Preserve the original holdout and results. A fair
direct-Qwen diagnostic must use exactly the reviewed excerpts, prompt/envelope and
model settings; the existing #97 lexical2 arm already invokes Qwen directly with
selected records, so repeating that call alone cannot establish a controller gain.
Production search-versus-selector integration and independent answer review remain
pending. These additions do not close #93 or #94 or authorize a merge.

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
