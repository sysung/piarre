# Conversation input — issue #158

Implemented from master `b0f158d`, after PR #180. Rustyline 19.0.0 provides editable input with in-memory history; file-history support is disabled. Rig 0.46.0 receives earlier successful user/assistant messages in order. A failed turn reports its error without replacing prior conversation. Prompt arguments retain one-shot behavior. Compose enables stdin and a TTY.

## Observed verification

On 2026-11-15 (local date), built the locked Docker image and used real `piarre/qwen3.5:4b-q4_k_m` through `http://model-runner.docker.internal/engines/llama.cpp/v1` on the existing M3/DMR setup:

1. Started `docker compose run --rm harness` in a terminal.
2. Typed `Remember my code word is ORCHID-7x`, used Backspace to replace `x` with `2`, then submitted `. Reply only OK.` Qwen replied `OK`.
3. Asked for the code word without repeating it. Qwen replied `ORCHID-72`.
4. Exited with Ctrl-D (exit 0), started a new container, and asked for the code word or `UNKNOWN` if none was supplied. Qwen replied `UNKNOWN`.
5. Exited cleanly. The existing one-shot arithmetic command returned `4`. Unloaded only the model used for this check.

No history files are loaded or saved. No automated tests or standalone verifiers were added. Streaming, terminal-output filtering, configurable bounds, and in-flight cancellation remain tasks 2.3–2.5. These observations establish editable input and session context, not human acceptance or general model quality.
