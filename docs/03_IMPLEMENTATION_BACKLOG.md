# Implementation Backlog — Dependency-Ordered Tasks

**Estimation:** rough engineering hours for one experienced TypeScript developer; integration uncertainty may increase estimates. **P0** is PoC-critical; **P1** is optional.

| ID | Priority | Est. | Dependencies | Task / definition of done |
|---|---|---:|---|---|
| A00 | P0 | 4h | — | Spike: verify Webview microphone, realtime provider, coding backend start/steer/cancel, auth model. Document findings. |
| A01 | P0 | 4h | A00 | Monorepo TS workspace, lint, tests, CI, extension dev host; `npm test` passes. |
| A02 | P0 | 6h | A01 | VS Code sidebar Webview with Start, Mute, End, status, transcript, tasks, artifacts. Keyboard-accessible. |
| A03 | P0 | 8h | A02 | Realtime audio transport and VAD; two-way conversation without per-turn click; explicit mic lifecycle. |
| A04 | P0 | 5h | A03 | Barge-in stops speech output; does not cancel worker; automated routing test. |
| A05 | P0 | 5h | A01 | SQLite event schema, migrations, replay, idempotent append; restart integration test. |
| A06 | P0 | 6h | A03,A05 | Conversation coordinator, persona policy, requirement capture and provenance; dialogue test. |
| A07 | P0 | 5h | A06 | Plan proposal/approval and versioning; no writes before approval; tests. |
| A08 | P0 | 8h | A05,A07 | Coding adapter start/status/tool event bridge, bounded commands, approvals; scaffold website. |
| A09 | P0 | 7h | A04,A08 | Task-specific intent routing, steer/cancel, stale-plan protection, disk reconciliation; scenario tests. |
| A10 | P0 | 5h | A08 | Local preview launch, owned-process cleanup, open diff, build status; smoke test. |
| A11 | P0 | 6h | A05,A08,A10 | Summary/requirements/decisions/tasks export with evidence links; accuracy assertions. |
| A12 | P0 | 5h | A09,A11 | Restart recovery, manual-edit conflict protection, provider failure fallback; fault tests. |
| A13 | P0 | 5h | A03,A05 | Privacy/consent controls, redaction, export/delete session, SecretStorage. |
| A14 | P0 | 8h | A09,A11,A12 | Golden-path E2E and 8 edge cases, recorded evaluation, defect triage. |
| A15 | P1 | 6h | A08 | Read-only research worker parallel to conversation; no file writes. |
| A16 | P1 | 4h | A02,A06 | Focus mode and conversational preference settings. |
| A17 | P1 | 4h | A14 | Cursor installation and compatibility smoke tests, document limitations. |

**Total P0:** ~82 engineering hours (plus environment/debugging contingency); P1 ~14 hours. This is more realistic as 6–8 weeks at 10–15 hours/week than a guaranteed four-week completion.

## Milestones
**M0 (spike):** Verified provider/backend capabilities and working dev environment (A00–A01).
**M1 (conversation):** Two-way natural voice, barge-in, persisted turns (A02–A06).
**M2 (website):** Approved plan creates and previews a local website (A07–A10).
**M3 (trust):** Recaps, privacy, recovery, corrections and tests (A11–A14).
**M4 (optional):** Parallel read-only research and Cursor validation (A15–A17).

## Suggested issue template
```
Title: [A09] Route requirement changes to active coding task
Why: A user can redirect work while agent is coding.
Given: approved plan v1 and active coding task T42
When: user says “make it dark mode”
Then: requirement v2 is saved, affected task is steered or replanned,
      stale completion is not accepted, unrelated work is preserved.
Evidence: event trace, resulting code diff, integration test.
```

## Implementation order notes
Do not build multi-agent orchestration before one coding worker works end-to-end. Keep the coordinator thin: conversational model proposes structured intent, deterministic code handles authorization and task transitions. Defer visual polish until interruption semantics and reliable evidence are proven.
