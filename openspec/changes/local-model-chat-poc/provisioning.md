# First local model provisioning

Task 1.1 / [issue #150](https://github.com/sysung/piarre/issues/150), observed 2026-11-15 on the M3 Pro Mac. Base revision: `bf1c83d2e4a95271da7235d2cf8a938807f79a37`.

## Installed artifact

| Item | Observed value |
|---|---|
| Local model name | `piarre/qwen3.5:4b-q4_k_m` |
| Source | `ggml-org/Qwen3.5-4B-GGUF` |
| Source revision | `8d43d974efc48399cb58957ad49c8b26bf5a109c` |
| File | `Qwen3.5-4B-Q4_K_M.gguf` |
| Download size | 3.03 GB |
| File SHA-256 | `217002fa8008ef4fc6d548353a3aebef055a96e6ff8e0e2c0953ef8254a89c14` |
| DMR artifact ID | `sha256:098affd77c5ad0eff9ba46fa1224f74fef5ea04d7a0805a0e794652dc657565d` |
| GGUF architecture / quantization | `qwen35` / `MOSTLY_Q4_K_M` |
| DMR-reported parameters | Approximately 4.2B |
| Configured context | 4,096 tokens |
| License | Apache-2.0; upstream license included in the package |

File size and hash matched the pinned inventory. DMR's parameter metadata is reported as observed; the source inventory's 4.7B total may include different components and is not relabeled as this GGUF's parameter count. No vision projector was downloaded. No conversion, training or quantization was performed.

The license file came from `Qwen/Qwen3.5-4B` revision `851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a`. The GGUF publisher's pinned metadata also declares Apache-2.0. The DMR ID identifies the local package including its configuration, not the raw GGUF alone.

## Runtime and lifecycle evidence

- DMR client/server: 1.2.9, Docker Desktop, darwin/arm64 client.
- Backend: llama.cpp `b9879-metal`, commit `72874f5`, digest `sha256:b70706f473b4043ca3e0c32704a7fda3412b83bceef0564684187b8011230de8`.
- Before: this local model name was absent and the running-model list was empty. Existing other models were preserved.
- `docker model package` exited successfully and `inspect` returned the artifact ID and `context_size: 4096`.
- `docker model run --detach piarre/qwen3.5:4b-q4_k_m` exited successfully. `docker model ps` listed this model on llama.cpp in completion mode.
- `docker model unload piarre/qwen3.5:4b-q4_k_m` reported one model unloaded. The running list became empty; inspection still returned the installed artifact ID.

Weights are stored by DMR, outside the Git repository and the future agent workspace. The temporary downloaded GGUF was removed after successful import and lifecycle verification to avoid retaining a second 3.03 GB copy. The setup guide shows equivalent repeatable commands with a fresh temporary directory.

## Human verification and next step

Follow [local model setup](../../../docs/local-model-setup.md) to inspect, load and unload the model. Expect it to appear only while loaded, while remaining installed afterward.

This verifies provisioning and model load/unload only. No prompt was submitted, no response quality or performance was measured, and no Rig application or agent workspace exists yet. [Issue #151](https://github.com/sysung/piarre/issues/151) records the next real prompt and API observation. Task 1.1 does not imply tasks 1.2 or 1.7 are complete.
