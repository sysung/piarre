# Isolation and provisioning profile

Status: proposed for maintainer approval under task 0.6 / #144. No approval or qualification has been recorded. This profile permits a first baseline only; the remaining inventory stays available for separately reviewed additions.

## Approval scope

1. Prepare a disposable synthetic environment for task 0.7 using the pinned image below. Use only generated fixture data.
2. After M0 readiness approval in task 0.11, provision the pinned Qwen baseline for task 1.1. No automatic model download from chat or Compose startup.
3. Keep the existing Docker Desktop installation and DMR backend. This approval does not cover backend upgrades, Ollama, direct llama.cpp, MLX, model conversion or benchmark execution.

## Permitted downloads

| Artifact | Size (GB) | Purpose and earliest use |
|---|---:|---|
| Python official ARM64 image, pinned below | 0.02 compressed | Synthetic endpoint and client, task 0.7 |
| Qwen3.5-4B Q4_K_M, pinned below | 3.03 | First local baseline, task 1.1 after 0.11 |

The image size is compressed registry layers, not its installed size. Allow up to 10 GB of dedicated baseline storage for the downloaded file, any DMR copy, image and metadata. Exceeding that allocation requires review. No vision projector or original high-precision checkpoint is included.

- Image: `docker.io/library/python@sha256:9cf2fdca7b3dd6082fd160ff5b8664f108c7441e200018a36554b2e8028f45df`.
- Model repository: `ggml-org/Qwen3.5-4B-GGUF` at `8d43d974efc48399cb58957ad49c8b26bf5a109c`.
- Model file: `Qwen3.5-4B-Q4_K_M.gguf`.
- Model SHA-256: `217002fa8008ef4fc6d548353a3aebef055a96e6ff8e0e2c0953ef8254a89c14`.

Keep the Qwen artifact's Apache-2.0 license and provenance with its metadata. Trusted provisioning may use Docker Hub and Hugging Face distribution endpoints, including their artifact CDN redirects, solely for these pinned downloads. Verify digests before use. No login credentials are passed into containers. All download/network activity is separate from conversation.

## Storage and permissions

- Proposed host working directory: `/Users/sysung98/.piarre-poc/local-model-chat-poc/`, mode 0700, owned by the current user. Store only approved downloads, synthetic inputs and run metadata there. Create it only after approval.
- DMR may use its existing Docker-managed model cache. Before import, record the resolved cache location and copies in task 1.1; do not relocate Docker data or mount that cache into the harness. Stop if cache ownership, persistence or storage allocation cannot be established.
- The native inference engine may read its executable, required system/GPU libraries and the approved model cache, and write its dedicated runtime scratch/log files. Personal documents, repositories, credentials and unrelated home-directory paths are outside its permitted access. Verify the actual native process restrictions in task 1.2. Do not infer them from Docker branding.
- Synthetic containers and the later harness run as non-root, with read-only root filesystems, all Linux capabilities dropped and no privilege escalation. No Docker socket, SSH agent, host networking, devices or personal home/repository mounts.
- Give each synthetic container at most 0.25 GB memory, one CPU, 64 processes and 0.02 GB temporary storage. Stop synthetic runs after five minutes. No persistent prompt history or unrestricted restart policy.
- Interactive chat receives no host mount. Fixed-input mode may mount only the dedicated synthetic-input directory read-only. Run metadata excludes prompts and replies by default.

## Network and API boundary

The client may reach only the inference mediation service on a dedicated internal network. Do not publish client or mediation ports to the LAN. The mediation service is trusted infrastructure, not a model-controlled tool.

The mediation service accepts only chat requests for the pinned model and forwards to a fixed DMR inference destination. Allow only `POST /engines/llama.cpp/v1/chat/completions` upstream. Reject management, model pulling/deletion, embeddings, URL fetching, alternate model names and tool definitions. Do not forward arbitrary paths, hosts or redirects. Provisioning and health inspection are trusted host actions outside the chat route.

Constrain the mediation service to the approved DMR destination. Test that the client cannot bypass mediation via Docker host aliases, direct gateway addresses, another container, LAN services or internet endpoints. An internal Compose network alone is not proof. If the chosen enforcement cannot establish these restrictions without relaxing the profile, stop and return for a revised design.

The native inference process has no permitted external inference or download route during testing. DMR's management plane remains a trusted host facility, unavailable to the harness. Do not expose its unauthenticated API to the LAN or change global Docker networking without separate review.

## Qualification and stop conditions

Task 0.7 uses a synthetic endpoint and denied-resource fixtures. Its evidence qualifies only that environment. Task 1.2 rechecks the actual native process and DMR route before measurement. Task 2.6 rechecks the final harness image before personal input. Keep input synthetic until the relevant gates pass.

Human verification:

1. Inspect exact images, user, mounts, storage, allowed API route and resource limits. Expect only the resources declared above.
2. Exercise permitted synthetic chat and denied management/network/file requests. Expect allowed chat to succeed and every denied operation to fail without a side effect.
3. Inspect teardown. Expect only the dedicated metadata and approved cached artifacts to persist; unrelated Docker resources and files remain untouched.
4. Record pass, fail or unknown with the exact configuration. Failure or uncertainty blocks qualification. Native-process containment failure requires a reviewed VM/dedicated-machine alternative, not weakened access limits.

No standalone verifier or new automated test is authorized by profile approval. Any such authorship needs the separate authorization required by AGENTS.md. These are manual acceptance steps for the later implementation tasks.

## Candidates outside this download approval

FrogNano remains pending its source/conversion license discrepancy. Nemotron remains pending its FP8/BF16 provenance discrepancy and license review. Nanbeige and MiniCPM are still candidates, but adding downloads requires an artifact-specific extension to this profile. Failure of Qwen does not disqualify those candidates.

## Approval record

Pending. Approval of this profile does not complete M0 readiness, permit benchmarks, or qualify a model.

Sources: [DMR execution and unauthenticated API](https://docs.docker.com/ai/model-runner/), [DMR API paths](https://docs.docker.com/ai/model-runner/api-reference/), [pinned model inventory](quantization-inventory.json). The image digest and compressed size were read from registry manifests without pulling it.
