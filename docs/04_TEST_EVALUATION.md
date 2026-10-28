# Testing and Evaluation Plan — POC to MVP

## 1. Study design
Run 15–20 complete website-building sessions. Start with the same vague phrase, vary requirements and interruptions. Use screen/audio capture only with explicit opt-in. Record structured events independently so failures can be reproduced without video. Compare voice workflow to typed prompts and, when available, existing editor voice features.

## 2. Golden-path acceptance test
1. Open trusted empty workspace; explicitly start voice session.
2. Say “Create me a website.”
3. Answer 2–4 natural discovery questions (portfolio, audience, style, pages).
4. Approve a concise implementation plan.
5. Observe coding task create React/Vite website and run build.
6. During build, ask “Why did you choose React?”; receive evidence-backed explanation without stopping coding.
7. Say “Actually, make dark mode the default”; confirm affected task replanned.
8. Open local preview and request a spacing change.
9. Finish; inspect files, build result, task checklist, decision log, session recap.
10. Restart editor; reopen recap and ensure task states reflect actual disk/process state.

## 3. Regression scenarios
| ID | Scenario | Required result |
|---|---|---|
| T01 | Interrupt spoken response | TTS stops promptly; coding unaffected |
| T02 | “Stop coding” | Active run stopped/cancelled with partial changes reconciled |
| T03 | Change requirement during write | Updated plan version; stale results not marked current |
| T04 | Ask why a stack was chosen | Rationale grounded in recorded plan or identified as assumption |
| T05 | Ambiguous “stop that” | Clarify target if uncertain |
| T06 | Build fails | Error captured, bounded repair, accurate final status |
| T07 | Manual file edit during run | No silent overwrite; conflict shown |
| T08 | Voice disconnect | Clear status and recoverable typed fallback |
| T09 | Editor restart | Replay state, reconcile task status |
| T10 | Ambient speech / speaker audio | No destructive authorization |
| T11 | User silent for 3 minutes | Authorized work continues, no unsolicited scope change |
| T12 | Session export/delete | Correct export; local deletion verified |

## 4. Measurement
- Median end-of-speech → first audible acknowledgment: target <1.5s on stable network.
- Correct interruption routing: ≥95% across labeled cases.
- Website build success: ≥90% across predefined scenarios.
- Decision and task-status accuracy: ≥95% on manually audited facts.
- Unapproved destructive operations: 0.
- Editor restart recovery: ≥90% of planned recovery cases.
- Track actual token/audio costs per successful session; do not assume a cost ceiling without measured usage.

## 5. Recording and trace format
Session recording includes synchronized timestamps and opt-in audio/screen files; event stream includes transcript partial/final, model intent, task transition, tool invocation, approval, file hash, command result, and summary evidence IDs. Redact API keys, tokens, personal file paths where appropriate, and sensitive environment values. Keep recordings outside the repository.

## 6. Feedback annotation
For each failure, capture: sessionId, timestamp, expected behavior, observed behavior, root-cause category (ASR/VAD, dialogue, routing, orchestration, backend, UI, environment, summary), severity, fix, and regression scenario. Favor code/state-machine fixes over accumulating brittle prompt rules.

## 7. Promotion gates
**PoC complete:** one developer can repeatedly complete the golden path; tests T01–T12 pass; summaries match evidence.
**MVP candidate:** 5+ external developers; 2 editor environments validated; repeatable improvements versus baseline; privacy/approval model reviewed; costs and latency measured; no critical data-loss issues.

## 8. Future scope after POC
Cursor adapter validation, multiple coding agents with worktree isolation, user-configurable personality, project knowledge graph, richer visual preview, optional wake word, independent desktop companion, then evaluate whether an editor fork is warranted.
