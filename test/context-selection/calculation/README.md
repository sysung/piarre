# Bounded arithmetic development screen

This research module tests whether source-linked numeric interpretation plus deterministic arithmetic avoids contradictory numerical replies. It has no product integration. Model audits remain correlated, uncertain judgments, and a valid calculation does not prove its premises or authorize an action.

Run offline checks from the repository root.

```sh
node --test test/context-selection/calculation/arithmetic.test.mjs
```

Copy `arithmetic.mjs`, `screen.mjs` and `development.json` into a new isolated output directory. In that directory, `node screen.mjs --dry-run` checks the initial prompts without inference. `node screen.mjs` launches at most eight serial requests through the existing pinned private Qwen runtime. Each arm gets at most two calls with matching generation limits. The candidate proposes and audits; the strong direct control drafts and refines. Original evidence is retained. Expected development criteria never enter a model prompt.

The source interpreter accepts signed decimals and cardinal words zero through twenty, then computes exact bounded rational values. Numeric tokens must occur as complete tokens in the unchanged original source, even when the model quotes only a substring. Quantities from unconfirmed records are rejected. Backward-only operation rows allow addition, subtraction, multiplication and division. No generated program is executed. Generic comparisons and source qualifications are rendered deterministically. Unit meaning, operand relevance, policy implications and completeness remain unverified.

Record every failure and consumed dispatch. A malformed plan or rejected audit is a failed sample, without a repair call. A timeout or uncertain network outcome stops execution; inspect backend activity before another run. Existing logs prevent silent relaunch. The two development cases screen feasibility only. Freeze a candidate before independent fresh validation. See `DESIGN.md` and `design` for alternatives, cross-review and the chosen synthesis.
