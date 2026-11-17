# Runtime generation defaults — issue #200

Implementation starts from master `eaf6069`. Removes the harness's 128-token output override and 120-second Tokio deadline. No replacement settings are introduced. The existing temperature and thinking settings are unchanged. Runtime-reported Length finishes are marked incomplete; no failed turn is added to conversation history.

## Request and transport inspection

Pinned Rig 0.46.0 constructs `CompletionRequest` with `max_tokens: None`. Its OpenAI chat encoder includes only present fields, so no `max_tokens` field is sent. `OpenAIConfig::client()` uses `rig_reqwest::shared()`. rig-reqwest 0.46.0 builds reqwest 0.13.5 with its defaults: no total/read deadline. No application timeout wraps the stream. The removed environment settings are not read or forwarded by Compose.

Read-only live llama.cpp `/props` inspection reported `max_tokens: -1`, `n_predict: -1`, `ignore_eos: false`, and `n_ctx: 4096`. An active `/slots` observation confirmed the harness request used `max_tokens: -1` and `n_predict: -1`. These are runtime settings, not a promise of unlimited output. Context capacity was not changed.

## Real checks

Docker Model Runner 1.2.9 on the existing M3 setup, model `piarre/qwen3.5:4b-q4_k_m`, artifact `sha256:098affd77c5ad0eff9ba46fa1224f74fef5ea04d7a0805a0e794652dc657565d`.

- Locked Compose build passed. Existing three terminal-filter tests passed in the Rust compiler container.
- A long tree tutorial produced an active runtime observation of 1384 decoded tokens, exceeding the old 128-token cap.
- One-shot arithmetic returned `4`, exit 0.
- Interactive chat remembered `WILLOW-92`, reported HTTP 400 for a 6039-token prompt versus 4096 available, then recalled `WILLOW-92`. Exit 0 describes the session, not the failed turn.
- Retired environment settings were explicitly supplied as `1` to the normal/chat checks and did not truncate the recalled code word. Source inspection confirms they are unused.
- An unavailable endpoint failed visibly with exit 1 and no fallback.

The prompt requested a detailed 5000-word tree tutorial with 30 sections. Output began at 1.884 seconds, continued past 120 seconds (175 stdout reads after that boundary), and ended at 125.48 seconds; process exit was 1 at 125.55 seconds. The runtime reported Length and the harness reported an incomplete answer. About 3184 whitespace-separated words were captured; this is not an exact completion-token total. The active 1384-token observation above is a lower bound, not final usage. No runtime context change or artificial delay was used. Only the model used for verification was unloaded afterward. Strict OpenSpec validation and whitespace checks passed. Manual in-chat stopping remains #161. No automated verifier or new tests were added.
