# Proposal

## Why

Establish whether a real local model can support useful chat and simple file tasks through Rig. Start with chat, then let the user select an existing project folder so file changes persist across sessions.

## What Changes

- Preserve the completed recovery and approved legacy reset. No further cleanup is requested.
- Deliver M0 scope and setup, M1 one working local model, M2 Rig chat followed by a user chat trial and scoped file tools, and M3 human acceptance.
- Run Rig in an isolated Linux container. When the user selects an existing folder, mount it as `/workspace` for persistent file access. Use MiniCPM5-2B by default through the existing local inference runtime; do not build a mocked model service or mediation proxy.
- Use the configured model/runtime generation defaults without a harness output-token override or automatic generation deadline. Long-output management is future work; manual stopping remains a separate slice.
- Offer optional streamed model-provided reasoning, displayed separately from the answer, when the configured local runtime exposes it.
- After the user tries chat, add list/read/create/edit/delete operations within the selected workspace. Outside file operations require a separate approval decision. Default chat has no project mount. Shell execution, generated-code execution and retrieval are outside this slice.
- Let operators try configured local models. Record observed behavior; benchmarks, an 8 GB target, exact memory accounting and tokenizer support do not control model admission.
- Keep concise issues, parent stories, native dependencies and PR evidence links. Project views remain useful parallel work, not an inference prerequisite.

## Capabilities

### New Capabilities

- `isolated-local-inference`: explicit local setup and persistent, opt-in workspace access.
- `inference-evaluation`: lightweight observations of real model attempts without admission scoring.
- `poc-delivery`: recoverable preparation, small delivery slices and human checkpoints.
- `typed-discussion`: session chat and bounded file operations after the initial user trial.
- `result-review`: configuration-linked observations and explicit user acceptance.

### Modified Capabilities

None.

## Impact

Revises the existing local-model PoC and its GitHub backlog. It supersedes the research-first sequence, surrogate endpoint, proxy and blanket no-tools requirement. Existing research and recovery evidence remain available. Benchmarks, runtime comparisons, conversion, model compliance, context retrieval, persistent chat memory and public multi-user hosting are later work. Application code follows in Apply; this proposal does not claim a working model or agent.
