# Technical Design — Piarre PoC

## 1. System architecture
```
VS Code extension host (TypeScript)
  ├─ Webview (React): voice UX, transcript, tasks, approvals, artifacts
  ├─ Editor adapter: workspace, files, diffs, terminal/preview, SecretStorage
  └─ Local Piarre service (Node/TypeScript)
       ├─ Realtime voice gateway (speech session, VAD, barge-in)
       ├─ Conversation coordinator (intent, dialogue, task references)
       ├─ Deterministic orchestrator (task state, approvals, dependency graph)
       ├─ Agent adapter (Codex App Server or supported coding SDK)
       ├─ Optional read-only research worker
       ├─ SQLite event store / projections
       └─ Artifact exporter (Markdown/JSON)
```

Use editor-neutral interfaces for all workspace operations. The extension adapter uses supported VS Code APIs; Cursor is a compatibility target, not an assumed agent API. Model outputs propose actions; deterministic orchestrator validates and applies them.

## 2. Suggested interfaces
```ts
interface EditorAdapter {
  getWorkspace(): Promise<{ root: string; trusted: boolean }>;
  openDiff(path: string): Promise<void>;
  openPreview(url: string): Promise<void>;
  getChangedFiles(): Promise<string[]>;
  requestApproval(action: ApprovalRequest): Promise<boolean>;
}
interface CodingAgentAdapter {
  start(task: CodingTask): Promise<{ runId: string }>;
  steer(runId: string, instruction: string): Promise<void>;
  interrupt(runId: string): Promise<void>;
  getStatus(runId: string): Promise<AgentStatus>;
}
interface EventStore {
  append(event: PiarreEvent): Promise<void>;
  replay(sessionId: string): Promise<PiarreEvent[]>;
}
```
Do not assume all coding backends implement true pause/resume. Capability-detect `steer`, `interrupt`, and `resume`; fallback to cancel/restart from a reconciled working tree.

## 3. Domain objects
- `Session`: id, workspaceId, startedAt, endedAt, micMode, currentPlanVersion.
- `Requirement`: id, statement, sourceTurnId, status (proposed/confirmed/superseded), version.
- `Plan`: version, tasks, assumptions, approval actor/time.
- `Task`: id, type, dependencies, runId, status, affectedFiles, planVersion.
- `Decision`: id, question, choice, alternatives, sourceTurnId, affectedTasks.
- `ToolExecution`: id, taskId, command/tool, exitCode, duration, sanitizedOutputRef.
- `Artifact`: type, createdAt, sourceEventIds, verificationStatus, path.

Every event includes `eventId`, `sessionId`, `sequence`, `timestamp`, `actor`, `type`, `payload`, and `correlationId`; use monotonic sequence per session for deterministic replay. Persist event before acknowledging durable state change.

## 4. State machines
**Voice:** inactive → connecting → listening ↔ speaking → muted → ended; recoverable `error`.

**Task:** queued → running → (steer_requested | cancel_requested | needs_approval | completed | failed); steer_requested → running/replanned; cancel_requested → cancelled/failed. A “pause” UI may be offered only if the backend supports safe suspension; otherwise label the action “Stop task.”

**Plan:** draft → proposed → approved → superseded. Any materially new scope must create a new plan version and, when needed, request reapproval.

## 5. Intent routing / interruption matrix
| Utterance | Effect |
|---|---|
| “Stop talking” | Cancel TTS output only; coding continues |
| “Pause the coding task” | Request supported pause; otherwise explain cancel/restart option |
| “Stop everything” | Stop speech and request cancellation of active work; reconcile partial changes |
| “Why React?” | Query recorded rationale; no task interruption by default |
| “Make it dark mode” | Update requirement and steer/replan affected task |
| “What’s happening?” | Read current event-backed task status |
| “Delete the project” | Require explicit UI confirmation; do not infer consent from voice alone |

Interruptions must reference active task IDs and plan versions. Ignore stale worker responses for superseded plan versions, while retaining them in the event log. Reconcile actual disk state before continuing after cancellation.

## 6. Voice implementation
Use a supported realtime speech-to-speech provider with server-side or semantic VAD and speech barge-in. Webview captures microphone only after explicit Start. Use a local bridge to exchange events with the extension host; keep provider credentials out of Webview and use short-lived credentials where supported. Handle speaker echo, partial transcript corrections, disconnect/reconnect, and audio output cancellation separately from coding cancellation. Do not claim true simultaneous speech recognition while audio output plays until tested on target platforms.

## 7. Agent execution and approvals
Workspace must be trusted. The worker executes within an explicit workspace boundary, with sandboxing/allowlists where supported. Classify operations: read-only; ordinary writes within approved plan; network/install; destructive; secret access. Require explicit approval for the latter categories according to policy. Record all approvals. Never execute arbitrary shell text emitted by the conversational model without orchestrator validation. Protect manual edits: capture base revision/hash before writes and surface conflicts rather than silently overwriting.

## 8. Persistence and artifacts
SQLite stores event log and materialized task/session projections. Export on demand and at session end:
```
.piarre/
  sessions/<session-id>/summary.md
  sessions/<session-id>/transcript.jsonl
  sessions/<session-id>/events.jsonl
  decisions/ADR-0001.md
  requirements.md
  tasks.json
```
Keep raw audio/video outside the repo, locally and only with opt-in. Add `.piarre` retention and `.gitignore` guidance. Summaries must link to evidence IDs, report `verified`, `attempted`, and `not verified` distinctly, and avoid hallucinated changes.

## 9. Preview and verification
For the golden-path website, prefer React + Vite with minimal dependencies; project plan approval precedes writes. Run approved package commands, capture exit code, start dev server with bounded port/process ownership, open editor preview or browser. Verify build plus minimal smoke check; browser-level visual verification is optional and must not be claimed without actual observation. Cleanup owned processes at session end.

## 10. Failure and recovery
- Voice provider unavailable → show connection error, allow typed continuation, retry with backoff.
- Agent crash → preserve event state; mark run unknown until reconciled.
- User changes code manually → detect changed hash and require merge/replan.
- Build failure → bounded retries with observed errors; report unresolved blockers.
- Reconnect → restore last committed events, inspect worker process and working tree, never assume task completed.
- Context limit → summarize only durable verified events and confirmed requirements; keep original log for audit.

## 11. Observability and privacy
Collect latency from speech-end to first audio, barge-in latency, intent routing correctness, task duration, failure codes, tokens/cost by worker, artifact accuracy. Sanitize logs; recording is opt-in; show export/delete actions; no hidden background microphone. Avoid storing secrets, full environment variables, or sensitive command output.

## 12. Design decisions to validate in spike
Verify Realtime SDK/browser audio support in VS Code Webviews, selected coding backend's actual steer/cancel semantics, supported auth/billing, Cursor extension compatibility, preview hosting/port forwarding, and OS audio permissions. Do not treat APIs as guaranteed until exercised with a minimal integration test.
