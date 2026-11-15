# Prerequisite inventory

Status: task 0.5 inventory completed in merged PR #169. Historical research below is reference material. The approved current scope and setup are in [isolation-profile](isolation-profile.md) and [design](design.md). Earlier qualification/approval recommendations below are superseded; they are not active prerequisites.

Parameter counts use billions (B), rounded to one decimal place. Sizes use decimal GB, rounded to two decimals. Exact values remain in the JSON metadata. The former 8 GB research target is not a model-admission limit.

## Machine and tools

Direct inspection found Apple M3 Pro, 38.65 GB of memory, macOS 26.6.2, Docker Engine 29.9.3, Compose 5.7.0 and Model Runner client/server 1.2.9. Model Runner was reachable with host inspection permissions. The restricted agent environment could not access it; that is not evidence that the service is down.

`rustc`, `cargo`, `ollama` and `llama-server` were not on the current PATH. This does not establish that they are absent everywhere. A container build can supply Rust later without installing it on the host.

## Model artifacts

[Source metadata](model-inventory.json) records exact repository revisions, licenses, parameter counts, file sizes and weight hashes from the public Hugging Face API. These are metadata observations, not successful load or memory measurements.

| Candidate | Repository | Stored parameters | Source weights (GB) |
|---|---|---:|---:|
| Qwen | Qwen/Qwen3.5-4B | 4.7B | 9.32 |
| FrogNano | microsoft/FrogNano-4B-2609 | 4.7B | 9.32 |
| Nanbeige | Nanbeige/Nanbeige4.2-3B | 4.2B | 8.34 |
| Nemotron | nvidia/NVIDIA-Nemotron-3-Nano-4B-BF16 | 4.0B | 7.95 |
| MiniCPM | openbmb/MiniCPM5-2B | 2.5B | 5.03 |

Stored parameter totals can include vision weights. Loaded text-only counts remain to be established. MiniCPM belongs in a smaller cohort. Source weight size does not qualify serving memory.

## Pinned quantized candidates

These are researched artifacts, not evidence of successful local execution. The current profile selects Qwen for the first attempt. Each link fixes the repository revision. The JSON records exact filenames and SHA-256 hashes.

| Candidate artifact | Q4_K_M size (GB) | Provenance and limits |
|---|---:|---|
| [ggml-org/Qwen3.5-4B-GGUF](https://huggingface.co/ggml-org/Qwen3.5-4B-GGUF/tree/8d43d974efc48399cb58957ad49c8b26bf5a109c) | 3.03 | llama.cpp organization conversion; exact conversion build not stated in the inspected card. |
| [bartowski/FrogNano-4B-2609-GGUF](https://huggingface.co/bartowski/FrogNano-4B-2609-GGUF/tree/dfbb801e04ddf045ffd245b9f1a546ed0c7d960f) | 2.80 | Community conversion using llama.cpp b11279; model-specific precision layout. Source metadata says Apache-2.0, conversion card says MIT. Resolve before provisioning. |
| [bartowski/Nanbeige_Nanbeige4.2-3B-GGUF](https://huggingface.co/bartowski/Nanbeige_Nanbeige4.2-3B-GGUF/tree/17562eefe9752007209148d5f7a6e275fc8d8077) | 2.68 | Community conversion using llama.cpp b10159; source model linked by publisher. |
| [nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF/tree/ba223d14e45525f7fae81db77ea8cabeb2fc6c25) | 2.84 | Official NVIDIA conversion; custom NVIDIA Nemotron Open Model License. |
| [openbmb/MiniCPM5-2B-GGUF](https://huggingface.co/openbmb/MiniCPM5-2B-GGUF/tree/8ad02b786ab81e33d465e1c80562640c55ab2877) | 1.56 | Official OpenBMB conversion; smaller parameter cohort. |

The five selected weight files total 12.91 GB. This excludes caches, containers, source weights and intermediate conversions. Load only one candidate at a time. Weight size is not peak serving memory.

FrogNano's converter explicitly describes a model-specific layout. A shared Q4_K_M label therefore does not establish identical precision allocation. Pin each artifact and compare runtimes with the exact same file. The approved initial policy compares published configurations. Do not describe published configurations as a controlled quantization experiment.

For text-only runs, do not download or load vision projectors. Qwen and FrogNano stored source totals include multimodal weights; exact loaded text counts remain unresolved until artifact tensor metadata is inspected. Published totals are retained above rather than relabeled as loaded counts. This is deferred research, not a prerequisite to chat.

## Runtime comparison

[Release metadata](runtime-inventory.json) pins the release candidates observed during this research. A release identifier is not evidence of local compatibility.

| Runtime | Candidate version | Benefit | Prerequisites and limitations |
|---|---|---|---|
| Docker Model Runner | Installed 1.2.9 | Existing installation and Compose integration; native Apple Silicon inference | Observed backend: b9879-metal, commit 72874f5; recheck before execution. Its API includes management operations. The revised PoC trusts the fixed application/runtime and does not claim enforced inference-only network access. |
| Direct llama.cpp | v1.0.0 | Direct GGUF control and explicit backend settings; useful same-file reference | Obtain a pinned arm64 binary or build with CMake and an Apple toolchain. Additional installation is a separate operator choice. |
| Ollama | v0.40.16 | Convenient local lifecycle and GGUF import | Additional installation; imported artifact, template and decoding settings must match. The chat client does not expose model-management tools. No cloud fallback. |
| MLX-LM | v0.32.2 | Apple-oriented alternative worth a separate experiment | Python environment and MLX-format artifact. This is a whole-stack comparison, not a same-GGUF runtime comparison. No MLX artifact is selected for download yet. |

Recommendation: retain DMR with llama.cpp as the first real inference attempt because it is already present. Add a direct llama.cpp same-file comparison only to answer a concrete compatibility, configuration or performance question in task 1.4. Keep Ollama as an alternative when it solves a measured compatibility or lifecycle problem. Do not install all four merely to fill the table. There is no measured speed winner.

The model publishers document llama.cpp usage for the selected GGUFs. FrogNano names b11279 and Nanbeige b10159 as conversion versions; these are not verified minimum supported versions. Exact DMR, Ollama and MLX support for each artifact remains unverified. Try actual load and requests for the selected configuration; record failures without memory or benchmark admission. A generic import command is not compatibility proof.

Sources: [DMR architecture and access](https://docs.docker.com/ai/model-runner/), [llama.cpp build requirements](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md), [Ollama GGUF import](https://docs.ollama.com/import), [MLX-LM](https://github.com/ml-explore/mlx-lm). Publisher conversion evidence is linked in the artifact table.

## License handling

The [NVIDIA license](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-nemotron-open-model-license/) permits use and derivatives subject to its conditions. Redistribution requires the license and applicable notices; trademark permission is limited. It also includes compliance, warranty and liability provisions. Keep the license with the pinned artifact. This PoC proposes local evaluation, not redistribution. Maintainer review of the actual license remains part of provisioning approval.

FrogNano's source/conversion metadata disagree. Keep both recorded and do not replace upstream obligations with the conversion card's MIT label. Nemotron GGUF metadata names an FP8 base while the source inventory records BF16. Keep their exact derivation unresolved in the optional model-comparison research; do not assume conversion directly from the inventoried BF16 checkpoint. The other inspected source metadata uses Apache-2.0. No licensing uncertainty is treated as approval.

## Deferred comparison policy

Start with pinned published configurations. Compare practical results and disclose known quantization layouts and unknowns; do not attribute all differences to source-model quality. A common conversion pipeline is deferred unless no suitable published artifact exists, a suspected conversion defect affects selection, or controlled source-model comparison becomes necessary. Any conversion work requires a separate reviewed task, initially comparing a published and rebuilt file from one checkpoint.

## Follow-up ownership

| Open prerequisite | Owning task | Must resolve before |
|---|---|---|
| FrogNano license and Nemotron provenance questions | Deferred research / #155 | Considering those specific downloads; unrelated model use is not blocked |
| Actual runtime identity and model behavior | 1.1 / #150 and 1.2 / #151 | Recording the first real local result |
| Loaded components and memory observations | Deferred 1.3 / #152 | Optional future comparisons, never chat admission |
| Comparison settings and precision disclosures | Deferred 0.8 / #146 | A future comparative report |

Task 0.5 checks that findings are traceable and unresolved prerequisites have owners. It does not perform these later operations or require their successful results. Only a prerequisite needed by the attempted operation affects that operation. No model execution or benchmark has occurred.

## Inventory verification

All five quantized entries have fixed repository revisions, artifact paths, exact sizes and SHA-256 hashes; metadata sizes agree with the recorded LFS sizes. Sources and documented compatibility limits are linked above. Every open prerequisite has a consuming task. These checks complete inventory acceptance only.

Read-only `docker model status` reported llama.cpp `b9879-metal`, commit `72874f5`, backend digest `sha256:b70706f473b4043ca3e0c32704a7fda3412b83bceef0564684187b8011230de8`. Other listed backends were not installed. A running backend does not establish compatibility with any shortlisted model.
