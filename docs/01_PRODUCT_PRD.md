# Product Requirements Document — Piarre PoC

## 1. Vision and problem
Piarre is a friendly, continuous conversational engineering partner embedded in the editor. Unlike dictation, Piarre can talk, ask clarifying questions, delegate real coding tasks, explain changes, be interrupted, and remember decisions. The first use case is building a simple website from a vague spoken request.

### Target persona
Solo developer using VS Code (Cursor compatibility is a later smoke test). Comfortable reviewing diffs, but wants to direct the project by voice without repeatedly issuing isolated prompts.

### Job to be done
“When I have an idea for a website, help me turn it into a working local prototype through natural back-and-forth conversation, while preserving my control and giving me a trustworthy account of what happened.”

## 2. Product principles
1. **Conversation, not dictation.** User may speak naturally without pressing a button for each utterance.
2. **Friendly, not chatty.** Greet by preferred name only when explicitly configured; otherwise use a neutral greeting. Do not interrupt deep work unnecessarily.
3. **Work and talk concurrently.** Acknowledgment is fast; coding is asynchronous.
4. **Explain and verify.** Report observed actions and test results; never claim success without evidence.
5. **User remains in control.** Confirm scope before substantial writes; explicit approval for risky actions.
6. **Memory with provenance.** Distinguish user decisions, model assumptions, observed tool outcomes, and unverified statements.

## 3. Golden-path user journey
| Step | User | Piarre | System evidence |
|---|---|---|---|
| 0. Start | Opens Piarre panel, clicks Start session once | Greets, states active listening | session.started |
| 1. Intent | “Create me a website” | Asks what kind and for whom | requirement.draft |
| 2. Clarify | “Portfolio, modern, dark mode” | Asks only blocking questions; offers defaults | requirements.updated |
| 3. Research | Answers follow-ups | Quietly inspects workspace and viable stack | worker.readonly.started/finished |
| 4. Plan | Approves proposed pages and stack | Reads short plan and begins work | plan.approved, task.started |
| 5. Build | Continues conversation | Scaffolds files, installs approved dependencies, builds | file.changed, command.finished |
| 6. Redirect | “Actually make it dark mode” | Acknowledges and updates affected task | requirement.changed, task.replanned |
| 7. Review | Opens preview, critiques spacing | Updates UI without overwriting manual edits | preview.ready, diff.recorded |
| 8. Handoff | “What did we do?” | Summarizes verified work, decisions, blockers | session.summary.created |

### Example dialogue
Piarre: “Welcome back. What would you like to build?”
User: “Create me a website.”
Piarre: “Sure. Is it a portfolio, landing page, or something else?”
User: “Portfolio. Minimal and dark.”
Piarre: “I can start with a homepage, projects section, and contact links. I’ll use placeholder content and a lightweight React setup. Should I proceed?”
User: “Yes.”
Piarre: “I’m building it now. You can interrupt me if you want to change anything.”
User: “Wait, why React?”
Piarre: “I chose it for reusable components, but a static HTML site could be simpler. Do you want to switch?”
User: “No, keep going, but make the project cards larger.”
Piarre: “Got it. I’ll update the cards while preserving the rest of the layout.”

## 4. Functional requirements
| ID | Priority | Feature | Behavior and acceptance |
|---|---|---|---|
| F01 | P0 | Session onboarding | Start/End/Mute visible; optional preferred name and voice output setting; no automatic mic on app launch |
| F02 | P0 | Continuous voice | VAD-based turn detection; no per-turn button; transcripts show partial/final state |
| F03 | P0 | Barge-in | User can interrupt Piarre speech; audio stops; coding continues unless user explicitly redirects/cancels |
| F04 | P0 | Friendly conversation | Concise greetings, clarifying questions, no invented personal knowledge; quiet during long tasks |
| F05 | P0 | Requirements capture | Store purpose, pages, style, constraints, assumptions, unresolved questions with source/provenance |
| F06 | P0 | Plan approval | Show small plan before writing; record user consent and plan version |
| F07 | P0 | Coding delegation | One coding worker can scaffold, edit, run commands and stream status |
| F08 | P0 | Task-aware corrections | Change requirement mid-build; route to affected task; reconcile in-flight edits |
| F09 | P0 | Code review/preview | Open local preview and show changed files; user can ask “why” about an actual decision |
| F10 | P0 | Verification | Build and tests run; failures reported honestly; no unsupported “done” claims |
| F11 | P0 | Session artifacts | Transcript, decisions, requirements, task status, changed files, verification summary |
| F12 | P0 | Recovery | Reopen workspace and see previous session; reconcile uncertain running task state |
| F13 | P0 | Privacy controls | Clear mic status, recording opt-in, export/delete session controls |
| F14 | P1 | Read-only research | Inspect repo/framework options concurrently without file writes |
| F15 | P1 | Focus mode | Speak only on blocker, user question, or completion |
| F16 | P1 | Cursor compatibility | Same extension shell works on Cursor with supported APIs; no reliance on private internals |

## 5. UX surfaces
**Primary side panel:** avatar/waveform, conversation status, mic toggle, end-session control, transcript, latest Piarre reply, task chips, approvals.

**Task drawer:** running/queued/blocked/completed tasks; each has owner, status, short explanation, evidence links, and pause/cancel where supported.

**Artifacts tab:** summary, decisions, open questions, task checklist, changed files, commands/tests, export.

**Editor integration:** open diff, navigate to changed file, open local preview. Piarre must not obstruct typing or keyboard shortcuts.

### Conversation policies
- Greet at most once per explicit session start; respect configured name.
- Ask one high-value question at a time; default unimportant design choices, label assumptions.
- Provide a brief spoken acknowledgment before longer background work.
- Distinguish “stop speaking,” “stop coding,” “cancel,” and “change X.”
- Do not treat ambient speech or voices from speakers as authorization for destructive actions.
- During silence, continue only previously approved work; no unsolicited new scope.

## 6. Explicitly out of scope
Production deployment, payments, multi-user collaboration, generalized autonomous browsing, full IDE fork, native wake word, arbitrary simultaneous code-writing agents, cross-device synchronization, deep codebase knowledge graph, persistent listening when session is closed.

## 7. PoC success definition
At least 15 complete scripted/dogfood sessions; website runs locally; a mid-build requirement change is incorporated; recap is evidence-backed; zero unapproved destructive operations. Numerical quality targets and detailed testing are in `04_TEST_EVALUATION.md`.
