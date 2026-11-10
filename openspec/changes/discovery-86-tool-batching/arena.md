# Arena decision

Two supplied candidates were independently cross-judged before synthesis. They use distinct configured Sol and Astra roles, both GPT models. No claim of different model families or runtime validation follows.

| Candidate | Approach | Evidence / discovery / authority / execution / reuse | Total |
| --- | --- | --- | --- |
| A, Sol | Separate programmatic-execution fixture slice with sequential/DAG comparison and explicit caps/partial-effect controls | 1 / 2 / 2 / 2 / 2 | 9/10 |
| B, Astra | Small fixed-program slice within #94's existing benchmark, preserving source/control contracts | 2 / 2 / 2 / 2 / 2 | 10/10 |

Select B because it avoids a second benchmark framework and pins the refreshed #94 implementation. Graft A's explicit resource/output limits and hidden-partial-completion controls. Both retain sequential control, adaptive fallback, per-call authority, and unknown-stop reconciliation.

Reject arbitrary generated JavaScript or vendor integration in the offline slice. Treat private `finalBoundary` as source evidence, not a callable seam. A fixed interpreter and worktrees cannot certify a sandbox; the required later sandboxed arm, actual provider performance, and human visibility/control results remain gated and not run.

The final design references issue #94 separately from implementation PR #95 at `d12cc75fdcca5532e180c8371b1b766df1155b08`. Neither candidate was accepted unchanged. Fixture caps and later performance criteria are proposed for review, not measured or previously approved. Publish this plan, then wait for human review before Apply.
