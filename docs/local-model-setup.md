# Set up the first local model

This installs the PoC's Qwen3.5-4B Q4_K_M in Docker Model Runner (DMR). Rig is not built yet. DMR owns model loading and inference; Rig will call it in a later task.

## Prerequisite

Start Docker Desktop with Model Runner enabled, then check:

```sh
docker model status
```

The first setup used DMR 1.2.9 and its native Apple Silicon llama.cpp backend. The model download is 3.03 GB; allow additional space for temporary staging and the runtime-managed copy. No memory-score or benchmark gate applies.

## Download and import

Run this block in a terminal. It uses temporary staging, verifies the pinned file, and imports a separate local model name without replacing other models. A failed command stops this block.

```sh
(
  set -eu
  staging=$(mktemp -d "${TMPDIR:-/tmp}/piarre-qwen.XXXXXX")
  printf 'Staging: %s\n' "$staging"
  curl --fail --location --retry 2 \
    'https://huggingface.co/ggml-org/Qwen3.5-4B-GGUF/resolve/8d43d974efc48399cb58957ad49c8b26bf5a109c/Qwen3.5-4B-Q4_K_M.gguf' \
    --output "$staging/Qwen3.5-4B-Q4_K_M.gguf"
  curl --fail --location \
    'https://huggingface.co/Qwen/Qwen3.5-4B/resolve/851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a/LICENSE' \
    --output "$staging/LICENSE"
  (
    cd "$staging"
    printf '%s\n' '217002fa8008ef4fc6d548353a3aebef055a96e6ff8e0e2c0953ef8254a89c14  Qwen3.5-4B-Q4_K_M.gguf' | shasum -a 256 --check
  )
  docker model package \
    --gguf "$staging/Qwen3.5-4B-Q4_K_M.gguf" \
    --license "$staging/LICENSE" \
    --context-size 4096 \
    piarre/qwen3.5:4b-q4_k_m
  printf 'Import finished. Temporary source files remain in %s\n' "$staging"
)
```

The local name identifies this imported configuration. Packaging copies the existing quantized weights; it does not train or requantize the model. The 4,096-token context is a starting runtime setting, not a benchmark result or a limit on which models may be tried. No vision projector is included.

After successful import, the printed temporary directory may be removed to reclaim the staging copy. Keep the DMR-managed copy for subsequent runs. Repeating import under the same name may update that local reference; use another name when preserving multiple configurations.

## Load, inspect and unload

```sh
docker model inspect piarre/qwen3.5:4b-q4_k_m
docker model run --detach piarre/qwen3.5:4b-q4_k_m
docker model ps
docker model unload piarre/qwen3.5:4b-q4_k_m
docker model ps
```

Expect the named model to appear after loading and disappear from the running list after unloading. Unloading frees its serving resources while keeping the installed artifact. It does not stop Docker Desktop or unload other models.

If loading fails, record the error rather than substituting a different model. [Issue #151](https://github.com/sysung/piarre/issues/151) records the first real prompt and response, reproduced below.

## Observed provisioning

See [the provisioning record](../openspec/changes/local-model-chat-poc/provisioning.md) for artifact identity, runtime version and the actual lifecycle result. Download identity and successful loading do not establish response quality, tool-call support or Rig integration.

## Ask the local API a question

With Docker Model Runner running and the model installed, send a request:

```sh
curl --fail-with-body --show-error --silent \
  --connect-timeout 5 --max-time 120 \
  http://localhost:12434/engines/llama.cpp/v1/chat/completions \
  --header 'Content-Type: application/json' \
  --data '{"model":"piarre/qwen3.5:4b-q4_k_m","messages":[{"role":"user","content":"What is 2 + 2? Reply with only the number."}],"max_tokens":128,"temperature":0,"stream":false,"chat_template_kwargs":{"enable_thinking":false}}'
```

Inspect `choices[0].message.content` for the answer and `choices[0].finish_reason` for how the response ended. The observed answer was `4` with `stop`. Other prompts or settings may give different results. The template option requests a direct answer without a thinking section for this smoke request.

This endpoint is reachable from the Mac in the observed setup. If connection fails, check `docker model status` and the local API setting rather than substituting a cloud endpoint. Do not use this host `localhost` address inside a container; the container route will be established with Rig.

Unload after use with `docker model unload piarre/qwen3.5:4b-q4_k_m`. See the [actual request record](../openspec/changes/local-model-chat-poc/local-inference.md) for settings, evidence and limits.
