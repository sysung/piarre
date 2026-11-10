# Tasks

All tasks are future work and remain pending. Plan validation does not execute them.

## 1. Agree the implementation boundary

- [ ] 1.1 Obtain human plan/test-boundary agreement and an explicit Apply request before implementation. Verify a recorded decision covers the fixed offline slice and proposed caps, while live work remains separately gated.
- [ ] 1.2 Resolve the exact #94/PR #95 integration revision and record fixture/source/tool identities. Verify the manifest names existing versus new files and preserves the unchanged benchmark baseline.

## 2. Build the offline comparison with tests first

- [ ] 2.1 Add failing equivalence, independent/dependent/adaptive workload, authority, and evidence-loss tests in proposed `tool-programs.test.mjs`. Implement the minimum fixed sequential/DAG interpreter, then refactor with the tests green. Verify all fixture outcomes and document manifest limits beside the slice.
- [ ] 2.2 Add red tests for correction, denial, stop, timeout, malformed output, call/output/resource caps, lost acknowledgment, duplicate effect, restart, and hidden partial completion. Implement minimum receipt/unknown-state behavior and refactor. Verify no uncertain-effect retry, implicit rollback, or hidden completed work.
- [ ] 2.3 Document offline reproduction and all-attempt reports. Verify the proposed Node test command and existing metric/validation commands in `verification.md` after dependencies are available, with no provider calls or downloads.

## 3. Independently review and probe affected behavior

- [ ] 3.1 Run independent Interrogate with configured Sol and Astra on the bounded implementation and evidence. Verify findings identify their source and disposition; resolve accepted findings and re-run affected tests.
- [ ] 3.2 Execute Blast Radius probes for unchanged retrieval/source support, #94 metric compatibility, SQLite/event authority, one-writer ownership, baseline fallback, and unknown-stop retention. Verify actual outputs and reverify any fixes; mocks do not certify containment.

## 4. Complete the separately authorized discovery

- [ ] 4.1 Obtain separate sandbox/provider/human-trial authorization and freeze tasks, counts, repetitions, order/cache/reset controls, model/settings, acceptance/margins, resource limits, and budget. Verify a reviewed protocol before generated code or live calls.
- [ ] 4.2 Demonstrate the selected sandbox's filesystem/process/network/credential/resource/output restrictions, denied authority, manual-edit preservation, and stop/recovery behavior. Verify actual runtime probes and retained uncertainty before running either arm.
- [ ] 4.3 Run the frozen unchanged per-call versus sandboxed programmatic comparison and human visibility/control review. Verify immutable all-attempt quality, timing, round-trip, token/cost, failure, freshness, stop, and maintenance evidence, including unsuitable adaptive workloads.
- [ ] 4.4 Produce adopt/retain/defer findings and reviewed lasting conclusions. Verify results/limitations link to #86/#94/#55/#102; accepted technical-design changes receive their own reviewed scope and discovery is not called complete with live/human evidence missing.

## Workflow follow-up

- Archive only after required tasks, actual results, independent review, re-verification, and human completion review are satisfied. Archive is not part of current authorization.
