#!/bin/sh
# Install the pinned Qwen model into Docker Model Runner.
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
