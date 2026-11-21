# Streamed safe output — issue #159

This note records the original #159 implementation. Current plain chat uses Rig's stdout helper as described in the [terminal chat requirement](specs/typed-discussion/spec.md#requirement-render-terminal-chat-and-diagnostics).

Started from master `20fcd40` after the thinking-display planning merge. Rig 0.46.0 now supplies streamed text events. Each visible chunk is flushed immediately; the stream must finish successfully before its response enters conversation history. Errors after displayed text identify the response as incomplete. Reasoning events are not displayed in this slice (#182).

Terminal controls are rendered as visible Rust-style escapes, not executed or silently deleted. Unicode text, newline and tab are preserved. Filtering each character independently makes the output independent of chunk boundaries. Model text, error messages and displayed configuration values use the filter. Raw completed model text remains in in-memory conversation context; it is filtered whenever displayed.

## Observations

Verified on the existing M3 Mac with real `piarre/qwen3.5:4b-q4_k_m` through the container DMR endpoint. The request settings remain temperature 0, thinking disabled, 128 output tokens and a 120-second timeout.

- Locked Compose release build passed.
- Asked for ten short tree facts. Captured 129 stdout reads, first at 2.855 seconds and last at 6.738 seconds; process exited 0 at 6.846 seconds. Reads are not a token count. The answer stopped partway through the list at the existing output cap; this proves incremental delivery, not instruction completeness or a performance benchmark.
- Real interactive turns remembered `PINE-84`, recalled it on the next turn, and exited with Ctrl-D, status 0.
- An unavailable endpoint returned a visible transport error, status 1.
- Three user-authorized filter tests passed using Rust 2024 in the compiler container: readable Unicode/layout, every C0/DEL/C1 control except allowed newline/tab, and clear-screen/cursor/clipboard/carriage-return/backspace/C1 sequences at every character split.
- Strict OpenSpec validation and whitespace checks passed.

The deterministic tests exercise the production filter, not a mocked inference endpoint. Real inference verifies integration. Configurable limits (#160), in-flight cancellation (#161), and thinking display (#182) remain separate tasks. The focused tests do not establish every possible terminal's behavior or human acceptance.
