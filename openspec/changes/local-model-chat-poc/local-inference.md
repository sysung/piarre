# First real local inference request

Task 1.2 / [issue #151](https://github.com/sysung/piarre/issues/151), observed 2026-11-15. Started from master `de576b3307f7404483f3098201fee25f8c86644a`.

## Result

The local chat-completions API returned HTTP 200 and assistant text `4` for `What is 2 + 2? Reply with only the number.` The response finished with `stop`, not a token-limit cutoff. The exact [request](evidence/151/request.json) and [response](evidence/151/response.json) are retained. The prompt contains no personal data.

## Configuration observed

| Setting | Value |
|---|---|
| Client | Host `curl`, direct local HTTP |
| Base URL | `http://localhost:12434/engines/llama.cpp/v1` |
| Request route | `POST /chat/completions` |
| Requested model | `piarre/qwen3.5:4b-q4_k_m` |
| Listed model ID | `docker.io/piarre/qwen3.5:4b-q4_k_m` |
| Artifact ID | `sha256:098affd77c5ad0eff9ba46fa1224f74fef5ea04d7a0805a0e794652dc657565d` |
| Model context | 4,096 tokens |
| Output cap | 128 tokens |
| Temperature / streaming | 0 / false |
| Template option | `enable_thinking: false` |
| Client timeouts | 5-second connection, 120-second overall |
| Runtime | DMR 1.2.9; llama.cpp b9879-metal, commit 72874f5 |

The model listing and inspected local artifact agree with [provisioning](provisioning.md). The response's model field contains DMR's local GGUF path under that artifact ID rather than echoing the requested model name. The response fingerprint includes the recorded backend commit. The server reported 26 prompt tokens and 2 completion tokens.

## Procedure and limits

1. Read `GET /models` at the base URL. It listed the installed Qwen artifact with a 4,096-token context.
2. Submit the saved request directly to the local chat endpoint. No API key, remote provider, model download or Docker configuration change was used.
3. Inspect HTTP status, assistant content and finish reason. The response was `4` with `stop`.
4. Observe the model in `docker model ps`, unload only this model, and confirm the running-model list is empty. The installed artifact remains available.

This is one real host-to-runtime request. It establishes neither response quality across tasks nor streaming, tool support, performance, container connectivity or Rig compatibility. Server timing fields are incidental raw evidence, not benchmark results. A future container cannot use `localhost` to address the Mac; its actual route must be checked during containerized Rig integration in #157.

[Issue #156](https://github.com/sysung/piarre/issues/156) owns the configuration handoff. This record supplies its observed inputs without marking that separate task complete.
