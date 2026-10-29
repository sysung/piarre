# Testing and evaluation plan for Piarre v0.2

## Evidence levels

1. Deterministic fixtures prove domain transitions, policy, idempotency, and recovery.
2. Adapter contracts prove observed provider capabilities and failure handling.
3. End-to-end journeys prove that the visible product state matches durable state and disk state.
4. Opt-in product studies measure whether voice improves supervision compared with typed control.

Mock adapters never prove live speech quality or provider semantics. A worker report never proves its own change.

## P0 golden path

1. Open a trusted repository and create a durable project.
2. Type or say a goal.
3. Review requirements, tasks, scope, checks, and budget.
4. Approve one bounded coding task.
5. Observe the worker and its reported capabilities.
6. Interrupt spoken output without stopping the worker.
7. Change one requirement while work is active.
8. Verify the current build and inspect the exact diff.
9. Review a preview observation without presenting it as an automated pass.
10. Accept the current revision.
11. Restart the editor and confirm project, evidence, and task recovery.
12. Export a summary whose claims link to current evidence.

## P0 regression scenarios

| ID | Scenario | Required result |
|---|---|---|
| T01 | Interrupt speech | Audio stops and coding continues. |
| T02 | Stop task | Interruption is requested, partial work is preserved, and observed state is reconciled. |
| T03 | Stop all | Every resolved active target is requested to stop and the fan-in remains visible. |
| T04 | Ambiguous stop | Piarre asks for clarification and performs no destructive action. |
| T05 | Change a requirement | A new plan version affects only relevant tasks. |
| T06 | Stale worker completion | Old output cannot satisfy current work. |
| T07 | Manual edit during work | The edit is preserved and the conflict blocks acceptance. |
| T08 | Build failure | Failed evidence remains visible and bounded repair does not invent success. |
| T09 | Provider disconnect | Typed control remains available and project state does not change implicitly. |
| T10 | Editor restart | Durable state replays and unknown external state is inspected. |
| T11 | Lost acknowledgement | An external effect is not repeated. |
| T12 | Export and delete | Export omits secrets and local deletion is verified by readback. |

## P0 release gate

B15 may pass only when the golden path and T01 through T12 have versioned evidence. Report each scenario as passed, failed, blocked, unsupported, or not tested. A blocked live adapter does not become a passing mock result. No unapproved destructive operation is allowed.

## P1 supervised-team scenarios

- A read-only worker cannot acquire write capability.
- Two coding workers never share a write root.
- Dependency and capability checks explain why a task is blocked.
- Cancellation and restart preserve worktree ownership.
- Conflicting work creates an integration review and invalidates affected evidence.
- A different worker can verify but cannot accept the author's change.
- A local interpreter stays behind the same proposal and policy boundary.
- Budget exhaustion prevents new scheduling without corrupting active work.

## Measurement protocol

Measure interaction latency, interruption routing, task-state accuracy, evidence accuracy, recovery success, resource use, and invalid proposal rate. Keep the run count, spread, hardware, provider, model, and failure count with every reported number. Do not set support claims from a single run or from cached, skipped, or failed work.

The planning estimates in the backlog are arithmetic inputs, not measured throughput. Re-estimate after B07, B15, and B22 because those gates expose recovery, live-adapter, and multi-worker uncertainty.

## Product study

After B15, run opt-in sessions that compare voice-first supervision with typed control for the same bounded tasks. Measure completion, correction cost, approval comprehension, and user confidence. Record raw audio only with explicit consent and outside the repository. Five external developers are a discovery sample, not statistical proof.

## Promotion rule

Piarre can advertise only capabilities backed by current revision-bound evidence. Historical A00 observations remain in `docs/history/a00-findings.md` and cannot satisfy B-series release gates.
