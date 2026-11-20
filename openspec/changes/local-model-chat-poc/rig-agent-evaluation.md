# Rig Agent evaluation

[#212](https://github.com/sysung/piarre/issues/212), OpenSpec task 2.8a. Adopted Rig Agent 0.46.0 after real MiniCPM checks on November 20, 2026.

## Configuration

- Baseline `6e0daf5`, application from master `3480266`, image `sha256:ea431a33207d2102ede909cf0335a784f56b6da85a3651105b75ddb7b96e1ca4`.
- Candidate `95fe138`, image `sha256:64efe648730136e3548435e2a32492f036c6cdeb11d3c2afddc751280eb04c71`. Separate temporary probe and history trace image `sha256:2b6502237b5f600deddab77a5d758b9df14af2aad67b71cf541c5f6cc601eb1b` used the same candidate and runner.
- Docker Engine 29.9.3, Docker Model Runner 1.2.9 on Apple Silicon, `http://model-runner.docker.internal/engines/llama.cpp/v1`. MiniCPM `piarre/minicpm5:2b-q4_k_m`, package `sha256:442e50cefb402d1450ae6675580707786dff858e89fb7700926c7783af4d71d7`, context 4096, temperature 0, thinking disabled. The installed GGUF SHA-256 matched the [pinned artifact](model-observations.md).
- Compiler `rust:1.97.1-slim-bookworm`, runtime `debian:bookworm-slim`. Request and transport inspection found no new generation cap, deadline, fallback, or retry. No inference settings changed between baseline, candidate, and the probe.

## Observed results

| Check | Observation |
| --- | --- |
| Matched chat | Both production images answered `4` in one-shot mode with exit 0. In interactive chat, `My picnic drink is lemonade.` followed by `What drink did I say I brought to the picnic?` recalled lemonade on both images. |
| Stream and cancel | Both streamed digits incrementally for `My fictional bike is orange. Write the numbers from 1 to 1000, one per line. Do not abbreviate.` Ctrl-C stopped local streaming, returned to the prompt, and the next follow-up recalled lemonade. Ctrl-D exited 0. Candidate one-shot Ctrl-C exited 1. Backend stop timing was not measured. |
| History trace | With the probe disabled in the temporary image, the history passed to Rig before and after cancelling was identical. It contained two accepted user/assistant pairs exactly once each. It contained neither the bike prompt nor the partial answer. The final production image also passed the same interactive sequence. |
| Real tool call | Prompted MiniCPM to call `probe_nonce` once and report its result, without giving it the value. First completion finished `ToolCalls`. The parsed call, executed event and tool result shared one provider call ID. The handler supplied `cedar-glass-4d17`; MiniCPM quoted it in completion 2, which finished `Stop`. The run transcript contained the call and matching result. Exit 0. |
| Runtime cutoff | The temporary image, with the probe disabled, streamed a counting request under existing limits. Rig reported `Length` plus a final response. Piarre marked the display incomplete and exited 1. Empty output and EOF without final response were inspected in code and not reproduced live. |
| Errors | Unavailable loopback endpoint produced a visible HTTP connection error and exited 1. Closing the output pipe during streaming produced `Broken pipe` and the application exited 1 without a panic. |
| Build and existing checks | Locked Docker build, three existing Linux tests, `cargo fmt --check`, `git diff --check` and strict OpenSpec validation passed. |

## Adoption decision

The candidate adds 27 net lines to the chat-only source because it separates the foreground turn from the CLI loop and validates Rig's final event. The simplification is at equivalent tool capability. Rig performs the dispatch, result matching and model continuation that the #211 prototype implemented manually. The CLI has one foreground path and one history writer. It appends Rig's new transcript once, after finish validation and successful output. The production image contains no probe or instrumentation. #213 and #214 cover workspace permissions and production file tools.
