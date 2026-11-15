# Disposable workspace and local inference profile

Status: direction approved by the maintainer on 2026-11-15. Replaces the earlier pending surrogate/proxy profile in PR #172. This records permission and design; it does not claim implementation or successful containment checks.

## Initial setup

Use the existing Docker/Compose and DMR installation. Start with the published Qwen3.5-4B Q4_K_M artifact recorded in `quantization-inventory.json`: repository `ggml-org/Qwen3.5-4B-GGUF`, revision `8d43d974efc48399cb58957ad49c8b26bf5a109c`, file `Qwen3.5-4B-Q4_K_M.gguf`, 3.03 GB, SHA-256 `217002fa8008ef4fc6d548353a3aebef055a96e6ff8e0e2c0953ef8254a89c14`. Preserve its license/source metadata. An identity mismatch is investigated before describing the file as that artifact.

Provision deliberately through the host operator using the runtime-managed cache. Chat never downloads models. No surrogate Python image, 10 GB approval ceiling or 8 GB serving-memory eligibility is required. Try the actual configuration and note its behavior. Other configured local models may be selected; installing a new runtime or downloading a new artifact remains an explicit operator action.

## Agent environment

Rig and `/workspace` live in the same disposable Linux container. Use non-root execution, read-only application files, dropped capabilities, no privilege escalation and configurable bounds on writable scratch, processes, memory and tool steps. No personal Mac folder, repository, credential, SSH agent, Docker socket, privileged mode or host-network mount/access is granted. The default workspace is temporary and discarded on teardown; there is no host working-directory requirement.

Rig calls the configured local inference endpoint directly. No proxy, account system, SSH keys or public listener is introduced. Trust the installed runtime and application image. This does not establish a network boundary against arbitrary compromised application code or prove native inference has no Mac filesystem access. Revisit that assumption before arbitrary execution or personal workspace integration.

## User sequence

1. Obtain a real local model response and then a real Rig chat response.
2. Let the maintainer try chat before enabling any model-driven file changes.
3. Enable workspace-tool mode explicitly. Offer bounded list/read/create/edit/delete tools, without shell, HTTP tools or Python execution. Reject path escapes, symlinks outside the workspace, non-regular targets and root/recursive deletion.
4. Inspect actual files after the real model's requests; report completed operations and errors. Cancellation does not undo completed changes.
5. Stop/reset the container and confirm temporary workspace data is discarded.

Use harmless sample data. Inspect actual mounts/user/paths and check denied paths using harmless fixtures; no fake inference service is needed. The user chat trial and final acceptance remain pending. This approval does not authorize a personal Mac workspace mount or new automated test/verifier authorship.
