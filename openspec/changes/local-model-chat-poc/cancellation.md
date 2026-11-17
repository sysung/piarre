# Cancellation checks

Observed on 2026-11-16 for #161, branch `codex/161-cancel-generation`, based on master `a08140c`. The implementing PR records the reviewed revision.

Configuration: Docker Model Runner 1.2.9 on Apple Silicon, `piarre/qwen3.5:4b-q4_k_m`, Rig 0.46.0. No model, context, output-cap or deadline changes.

## Observed behavior

1. Built the harness with `docker compose build harness`.
2. Started interactive chat and sent `Remember the codeword cedar. Reply only OK.` Qwen answered `OK`.
3. Requested a 2000-word explanation of rain. After visible streamed text, pressed Ctrl-C. The harness marked the response incomplete, reported local cancellation and backend uncertainty, and returned to `You>` without retrying.
4. Asked for the codeword. Qwen answered `cedar`, retaining the earlier completed turn.
5. Typed draft input and pressed Ctrl-C at the prompt. The input cleared. The next arithmetic request answered `4` rather than being cancelled.
6. Requested a long forest story and cancelled again during streaming. The same notice and prompt returned. Ctrl-D then exited successfully.
7. Started a one-shot ocean-story request and cancelled during streaming. The harness showed the partial-output and backend notices and exited with status 1.
8. Existing terminal-filter tests passed, 3 of 3. No new automated tests were added.

## Implementation and limits

The request future competes with Ctrl-C. Cancellation drops the local stream; only successful completed responses enter conversation history. Existing history remains. There is no retry or automatic timeout. The Ctrl-C branch is polled first so output cannot starve cancellation.

These checks establish local cancellation with real Qwen. They do not prove when the native inference server stopped computing. Cancellation before first output was not separately observed. File tools are not implemented, and human PoC acceptance remains pending.
