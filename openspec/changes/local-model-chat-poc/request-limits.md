# Request limits — issue #160

Implemented from master `090008e`. Adds `PIARRE_MAX_OUTPUT_TOKENS` (default 128) and `PIARRE_REQUEST_TIMEOUT_SECONDS` (default 120), forwarded by Compose and validated before inference. Missing values use defaults; empty, zero, non-integer and out-of-range values fail visibly. Values use positive u32 integers; the runtime still decides whether a requested token budget is supported.

The deadline covers the full stream. A provider-reported Length finish becomes an explicit incomplete-result error rather than a successful conversation turn. Failed turns leave earlier history intact. Context validation stays with the local runtime; no tokenizer gate, history trimming or retry was added.

## Observed on 2026-11-16

Existing M3/DMR setup, real `piarre/qwen3.5:4b-q4_k_m`, 4096-token runtime context, thinking disabled, temperature 0:

- Locked Docker build passed.
- Eight-token cap: counting response printed `One, two, three, four,` then reported the output limit and incomplete response; exit 1.
- One-second timeout with 2048 output tokens: streamed part of a photosynthesis answer, reported timeout and uncertain backend completion; exit 1.
- Invalid values: zero and empty output cap, non-integer and overflowing timeout all exited 1 before inference with setting-specific errors.
- Real session: remembered `MAPLE-63`, submitted an oversized prompt, then recalled `MAPLE-63`. Runtime returned HTTP 400 with `exceed_context_size_error`, 6044 requested tokens and 4096 available. Error and unchanged-history notice were visible. Session ended normally; exit 0 reflects the interactive session, not success of the rejected turn.
- Successful override: 256 tokens and 10 seconds returned `4` for the arithmetic prompt; exit 0.
- Only the model used by these checks was unloaded afterward.
- Strict OpenSpec validation and whitespace checks passed. No new tests or standalone verifiers were authored; verification exercised real commands and inference.

No claim of precise backend cancellation, general model quality, or human acceptance. Cancellation controls remain #161 and thinking display remains #182.
