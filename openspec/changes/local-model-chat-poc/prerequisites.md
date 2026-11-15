# Prerequisite inventory

Status: task 0.5 is in progress. No installation or model download is approved by this inventory.

## Machine and tools

Direct inspection found Apple M3 Pro, 38,654,705,664 bytes of memory, macOS 26.6.2, Docker Engine 29.9.2, Compose 5.6.1 and Model Runner client/server 1.2.9. Model Runner was reachable with host inspection permissions. The restricted agent environment could not access it; that is not evidence that the service is down.

`rustc`, `cargo`, `ollama` and `llama-server` were not on the current PATH. This does not establish that they are absent everywhere. A container build can supply Rust later without installing it on the host.

## Model artifacts

[Source metadata](model-inventory.json) records exact repository revisions, licenses, parameter counts, file sizes and weight hashes from the public Hugging Face API. These are metadata observations, not successful load or memory measurements.

| Candidate | Repository | Stored parameters | Source weight bytes |
|---|---|---:|---:|
| Qwen | Qwen/Qwen3.5-4B | 4,659,865,088 | 9,319,828,096 |
| FrogNano | microsoft/FrogNano-4B-2609 | 4,659,865,088 | 9,319,820,920 |
| Nanbeige | Nanbeige/Nanbeige4.2-3B | 4,169,800,704 | 8,339,624,720 |
| Nemotron | nvidia/NVIDIA-Nemotron-3-Nano-4B-BF16 | 3,973,556,832 | 7,947,142,640 |
| MiniCPM | openbmb/MiniCPM5-2B | 2,516,756,480 | 5,033,557,096 |

Stored parameter totals can include vision weights. Loaded text-only counts remain to be established. MiniCPM belongs in a smaller cohort. Source weight size does not qualify serving memory.

[Quantization metadata](quantization-inventory.json) identifies official Q4_K_M artifacts for Nemotron and MiniCPM, including hashes and download sizes. Requests for three guessed official GGUF repository names returned HTTP 401; this does not prove that those artifacts do not exist. Discover their actual published locations rather than requiring credentials or substituting an arbitrary artifact.

## Remaining before task 0.5 completion

- Locate and pin suitable quantized Qwen, FrogNano and Nanbeige artifacts, including converter provenance.
- Read the Nemotron custom license and record its terms applicable to this experiment.
- Establish text-only loaded parameter counts and compatible runtime versions per artifact.
- Record runtime image/version pins and build prerequisites; distinguish documented support from local qualification.
- Produce an explicit provisioning and access profile for task 0.6 approval. No provisioning is allowed before that approval and M0 readiness.

Sources: each `model` identifier in the JSON files resolves at `https://huggingface.co/<model>/tree/<revision>`. Metadata was inspected during the approved M0 apply session.
