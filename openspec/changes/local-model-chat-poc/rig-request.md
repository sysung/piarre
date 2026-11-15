# First containerized Rig request

Task 2.1 / [issue #157](https://github.com/sysung/piarre/issues/157), observed 2026-11-15. Started from master `b78fed8` after the maintainer approved closing #156 with the evidence already in PRs #178 and #179.

## Delivered slice

A small Rust executable accepts a prompt argument, sends one chat-completion request through Rig, prints the returned text and exits. The Docker build contains the compiler; no Rust toolchain was installed on the Mac. Compose supplies the local endpoint and model explicitly. No file tools, persistent history or interactive UI are implemented in this slice.

- Rust 1.97.1; `rig-core` 0.46.0 with its reqwest transport. `Cargo.lock` records dependency resolution, and the image builds with `--locked`.
- Container endpoint: `http://model-runner.docker.internal/engines/llama.cpp/v1`.
- Model: `piarre/qwen3.5:4b-q4_k_m`, provisioned in #150 and observed through the host API in #151.
- Request: temperature 0, maximum 128 output tokens, `enable_thinking: false`; 120-second client timeout. The program prints after the completed call rather than exposing streamed output.

## Actual checks

| Action | Observed result |
|---|---|
| Build the final Compose image | Rust compilation and locked dependency build succeeded |
| `docker compose run --rm harness "What is 2 + 2? Reply with only the number."` | Printed `4`; exit 0 |
| Override endpoint with `http://127.0.0.1:1/v1` and send `Hello` | Exit 1, `Request failed` with a transport error for `/chat/completions`; no answer or fallback |
| Run `id` in the same service configuration | UID/GID 10001 |
| Inspect actual container configuration | No bind mounts; read-only root; not privileged; capabilities ALL dropped; no-new-privileges; no published ports |
| Inspect storage/resource configuration | Temporary `/workspace` and `/tmp`; 0.54 GB container memory cap; 64-process limit |
| Cleanup | Inspection container removed; only the Qwen model used by this check unloaded |

The temporary inspection used an operator-supplied shell entrypoint to inspect the service; no shell was exposed to the model. The application image includes only the runtime binary, not the repository or model weights. Docker build storage retains the compiler image and dependency cache for subsequent builds.

`cargo fmt --check` was attempted in the compiler image but rustfmt is not included in that image. Formatting was reviewed directly. No new tests or standalone verifiers were authored. Validation used real compilation, real inference, an actual unavailable endpoint and container inspection.

## What this does not establish

This proves one container-to-DMR request through Rig and the observed container settings. It does not establish general model quality, streaming, session context, file-tool behavior or comprehensive network isolation. The local runtime and application image remain trusted. The next task is Rustyline conversation input (#158); user chat acceptance remains later (#173).

See [usage](../../../docs/rig-request.md). Docker documents this container address in its [API reference](https://docs.docker.com/ai/model-runner/api-reference/). Rig's [published provider documentation](https://docs.rs/rig-core/0.46.0/rig_core/providers/openai/) describes the chat-completions interface; the implementation uses the published crate source and the real runtime checks above.
