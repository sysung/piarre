# Piarre

A local-model PoC using a Rust Rig harness. Send one prompt to Qwen and print its response. Interactive chat and file tools are planned.

## Prerequisites

Start Docker Desktop with Model Runner enabled. The current setup is verified on an Apple Silicon Mac. No local Rust installation is needed.

Clone the repository and enter it:

```sh
git clone https://github.com/sysung/piarre.git
cd piarre
```

Install the model once (about 3.03 GB, plus temporary staging space):

```sh
sh scripts/install-model.sh
```

Skip installation if `piarre/qwen3.5:4b-q4_k_m` is already installed. The installer prints its temporary download directory; you can remove that directory after a successful import.

## Run

```sh
docker compose build harness
docker compose run --rm harness "What is 2 + 2? Reply with only the number."
```

The verified response is `4`. Each run sends one prompt and exits. Rig runs inside Docker; Docker Model Runner serves Qwen separately. No personal folders are mounted into the harness.

To release model memory after use:

```sh
docker model unload piarre/qwen3.5:4b-q4_k_m
```

## Project work

[Tasks and verification](openspec/changes/local-model-chat-poc/tasks.md) · [GitHub Project](https://github.com/users/sysung/projects/8)
