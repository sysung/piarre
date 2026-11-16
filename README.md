# Piarre

A local-model PoC using a Rust Rig harness. Chat with Qwen in a disposable container. File tools are planned.

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

Skip installation if `piarre/qwen3.5:4b-q4_k_m` is already installed. The installer removes its temporary downloads after success, failure, or interruption. The imported model stays in Docker Model Runner.

## Run

```sh
docker compose build harness
docker compose run --rm harness "What is 2 + 2? Reply with only the number."
```

The verified response is `4`. With a prompt argument, the command answers once and exits.

For an interactive conversation:

```sh
docker compose run --rm harness
```

Edit your message and press Enter. Use Up/Down to recall input, Ctrl-C to clear input at the prompt, and Ctrl-D on an empty prompt to exit. Follow-up messages include earlier successful turns. History stays in memory; restarting begins a fresh conversation. Replies stream as they arrive. Terminal control characters are shown as visible escapes instead of being executed; normal text, tabs, and line breaks are preserved. Thinking display is planned separately.

 Rig runs inside Docker; Docker Model Runner serves Qwen separately. No personal folders are mounted into the harness.

To release model memory after use:

```sh
docker model unload piarre/qwen3.5:4b-q4_k_m
```

## Project work

[Tasks and verification](openspec/changes/local-model-chat-poc/tasks.md) · [GitHub Project](https://github.com/users/sysung/projects/8)
