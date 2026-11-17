#!/bin/sh
# Install the pinned MiniCPM5-2B model into Docker Model Runner.
(
  set -eu
  docker model status
  staging=$(mktemp -d "${TMPDIR:-/tmp}/piarre-minicpm.XXXXXX")
  trap 'rm -rf -- "$staging"' 0
  trap 'exit 130' INT
  trap 'exit 143' TERM
  trap 'exit 129' HUP
  printf 'Staging: %s\n' "$staging"
  curl --fail --location --retry 2 \
    'https://huggingface.co/openbmb/MiniCPM5-2B-GGUF/resolve/8ad02b786ab81e33d465e1c80562640c55ab2877/MiniCPM5-2B-Q4_K_M.gguf' \
    --output "$staging/MiniCPM5-2B-Q4_K_M.gguf"
  curl --fail --location \
    'https://www.apache.org/licenses/LICENSE-2.0.txt' \
    --output "$staging/LICENSE"
  (
    cd "$staging"
    printf '%s\n' 'ec2d5801640099e97d8d7e8003ad4d81f336e757811f03a26173dddf386602fd  MiniCPM5-2B-Q4_K_M.gguf' | shasum -a 256 --check
  )
  docker model package \
    --gguf "$staging/MiniCPM5-2B-Q4_K_M.gguf" \
    --license "$staging/LICENSE" \
    --context-size 4096 \
    piarre/minicpm5:2b-q4_k_m
  printf 'Import finished. Temporary downloads will be removed.\n'
)
