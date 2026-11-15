# Prerequisite inventory

Status: task 0.5 is in progress. No installation or model download is approved by this inventory.

Sizes use decimal GB and are rounded to two decimal places. Exact sizes remain in the JSON metadata. The serving limit remains strictly below 8 GB.

## Machine and tools

Direct inspection found Apple M3 Pro, 38.65 GB of memory, macOS 26.6.2, Docker Engine 29.9.3, Compose 5.7.0 and Model Runner client/server 1.2.9. Model Runner was reachable with host inspection permissions. The restricted agent environment could not access it; that is not evidence that the service is down.

`rustc`, `cargo`, `ollama` and `llama-server` were not on the current PATH. This does not establish that they are absent everywhere. A container build can supply Rust later without installing it on the host.

## Model artifacts

[Source metadata](model-inventory.json) records exact repository revisions, licenses, parameter counts, file sizes and weight hashes from the public Hugging Face API. These are metadata observations, not successful load or memory measurements.

| Candidate | Repository | Stored parameters | Source weights (GB) |
|---|---|---:|---:|
| Qwen | Qwen/Qwen3.5-4B | 4,659,865,088 | 9.32 |
| FrogNano | microsoft/FrogNano-4B-2609 | 4,659,865,088 | 9.32 |
| Nanbeige | Nanbeige/Nanbeige4.2-3B | 4,169,800,704 | 8.34 |
| Nemotron | nvidia/NVIDIA-Nemotron-3-Nano-4B-BF16 | 3,973,556,832 | 7.95 |
| MiniCPM | openbmb/MiniCPM5-2B | 2,516,756,480 | 5.03 |

Stored parameter totals can include vision weights. Loaded text-only counts remain to be established. MiniCPM belongs in a smaller cohort. Source weight size does not qualify serving memory.

## Pinned quantized candidates

These are candidates for review, not approved downloads or qualified configurations. Each link fixes the repository revision. The JSON records exact filenames and SHA-256 hashes.

| Candidate artifact | Q4_K_M size (GB) | Provenance and limits |
|---|---:|---|
| [ggml-org/Qwen3.5-4B-GGUF](https://huggingface.co/ggml-org/Qwen3.5-4B-GGUF/tree/8d43d974efc48399cb58957ad49c8b26bf5a109c) | 3.03 | llama.cpp organization conversion; exact conversion build not stated in the inspected card. |
| [bartowski/FrogNano-4B-2609-GGUF](https://huggingface.co/bartowski/FrogNano-4B-2609-GGUF/tree/dfbb801e04ddf045ffd245b9f1a546ed0c7d960f) | 2.80 | Community conversion using llama.cpp b11279; model-specific precision layout. Source metadata says Apache-2.0, conversion card says MIT. Resolve before provisioning. |
| [bartowski/Nanbeige_Nanbeige4.2-3B-GGUF](https://huggingface.co/bartowski/Nanbeige_Nanbeige4.2-3B-GGUF/tree/17562eefe9752007209148d5f7a6e275fc8d8077) | 2.68 | Community conversion using llama.cpp b10159; source model linked by publisher. |
| [nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF/tree/ba223d14e45525f7fae81db77ea8cabeb2fc6c25) | 2.84 | Official NVIDIA conversion; custom NVIDIA Nemotron Open Model License. |
| [openbmb/MiniCPM5-2B-GGUF](https://huggingface.co/openbmb/MiniCPM5-2B-GGUF/tree/8ad02b786ab81e33d465e1c80562640c55ab2877) | 1.56 | Official OpenBMB conversion; smaller parameter cohort. |

The five selected weight files total 12.91 GB. This excludes caches, containers, source weights and intermediate conversions. Load only one candidate at a time. Weight size is not peak serving memory.

FrogNano's converter explicitly describes a model-specific layout. A shared Q4_K_M label therefore does not establish identical precision allocation. Pin each artifact and compare runtimes with the exact same file. Model comparisons need a declared choice between published configurations and a common conversion recipe. Do not describe published configurations as a controlled quantization experiment.

For text-only runs, do not download or load vision projectors. Qwen and FrogNano stored source totals include multimodal weights; exact loaded text counts remain unresolved until artifact tensor metadata is inspected. Published totals are retained above rather than relabeled as loaded counts. This remains a qualification prerequisite.

## Runtime comparison

[Release metadata](runtime-inventory.json) pins the release candidates observed during this research. A release identifier is not evidence of local compatibility.

| Runtime | Candidate version | Benefit | Prerequisites and limitations |
|---|---|---|---|
| Docker Model Runner | Installed 1.2.9 | Existing installation and Compose integration; native Apple Silicon inference | Identify its exact embedded llama.cpp build. Its unauthenticated API includes management operations; restrict the harness to inference routes and qualify native process access. |
| Direct llama.cpp | v1.0.0 | Direct GGUF control and explicit backend settings; useful same-file reference | Obtain a pinned arm64 binary or build with CMake and an Apple toolchain. Requires an approved native-process confinement profile. |
| Ollama | v0.40.16 | Convenient local lifecycle and GGUF import | Additional installation; imported artifact, template and decoding settings must match. Model management routes require restriction. No cloud fallback. |
| MLX-LM | v0.32.2 | Apple-oriented alternative worth a separate experiment | Python environment and MLX-format artifact. This is a whole-stack comparison, not a same-GGUF runtime comparison. No MLX artifact is selected for download yet. |

Recommendation: retain DMR with llama.cpp as the first qualification attempt because it is already present. Use direct llama.cpp as the same-file comparison if approved. Keep Ollama as an alternative when it solves a measured compatibility or lifecycle problem. Do not install all four merely to fill the table. There is no measured speed winner.

The model publishers document llama.cpp usage for the selected GGUFs. FrogNano names b11279 and Nanbeige b10159 as conversion versions; these are not verified minimum supported versions. Exact DMR, Ollama and MLX support for each artifact remains unverified. All candidates require live load, template, context, containment and memory checks before eligibility. A generic import command is not compatibility proof.

Sources: [DMR architecture and access](https://docs.docker.com/ai/model-runner/), [llama.cpp build requirements](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md), [Ollama GGUF import](https://docs.ollama.com/import), [MLX-LM](https://github.com/ml-explore/mlx-lm). Publisher conversion evidence is linked in the artifact table.

## License handling

The [NVIDIA license](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-nemotron-open-model-license/) permits use and derivatives subject to its conditions. Redistribution requires the license and applicable notices; trademark permission is limited. It also includes compliance, warranty and liability provisions. Keep the license with the pinned artifact. This PoC proposes local evaluation, not redistribution. Maintainer review of the actual license remains part of provisioning approval.

FrogNano's source/conversion metadata disagree. Keep both recorded and do not replace upstream obligations with the conversion card's MIT label. The other inspected source metadata uses Apache-2.0. No licensing uncertainty is treated as approval.

## Decision needed before completing task 0.5

1. **Published configurations:** use the pinned files as shipped, report their precision layouts and compare practical configurations. This adds no conversion pipeline, but cannot isolate model quality from quantization differences.
2. **Common conversion recipe:** convert source checkpoints with one reviewed converter build, quantization policy and calibration policy where supported. This better serves the requested controlled comparison, but adds source downloads, conversion storage and a new work item. Architectures may still require separate cohorts.

Recommend option 2 for the controlled model comparison, while retaining the published Qwen artifact for the initial runtime smoke test. Neither option authorizes downloads. Record the choice in the measurement protocol before adding conversion work or narrowing the comparison claim.

Remaining prerequisites: resolve the FrogNano license discrepancy; establish text-only tensor counts; identify DMR's embedded engine build; pin any installation assets and checksums; approve native-server access, storage and download scope in task 0.6. No model execution or benchmark has occurred.
