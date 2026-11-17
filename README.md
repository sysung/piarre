# Piarre

Piarre is a local-model proof of concept for chatting with MiniCPM5-2B in a disposable Docker container. It uses a Rust Rig harness. File tools and thinking display are planned.

## Set up

Start Docker Desktop with Model Runner enabled. The current setup has been verified on an Apple Silicon Mac. You do not need a local Rust installation.

Clone the repository and enter it:

```sh
git clone https://github.com/sysung/piarre.git
cd piarre
```

Install the model once. Allow about 1.56 GB for the model, plus temporary staging space:

```sh
sh scripts/install-model.sh
```

Skip this step if `piarre/minicpm5:2b-q4_k_m` is already installed. The installer removes temporary downloads after success, failure, or interruption. The imported model stays in Docker Model Runner.

## Build and try a prompt

```sh
docker compose build harness
docker compose run --rm harness "What is 2 + 2? Reply with only the number."
```

The documented verified response is `4`. When you pass a prompt argument, the command answers once and exits.

## Chat interactively

```sh
docker compose run --rm harness
```

Type your message and press Enter. Replies stream as they arrive.

| Key | Action |
| --- | --- |
| Up or Down | Recall earlier input. |
| Ctrl-C at the prompt | Clear the current input. |
| Ctrl-C during a response | Cancel the local response and return to the prompt. |
| Ctrl-D at an empty prompt | Exit chat. |

Follow-up messages include earlier successful turns. Conversation history stays in memory. Restarting begins a fresh conversation.

Cancelling a response leaves the cancelled turn out of history and keeps earlier completed turns. The model server may continue generating after local cancellation. In one-shot mode, cancellation exits with failure.

## Stop or start fresh

At an empty `You>` prompt, press Ctrl-D to exit. If a response is running, press Ctrl-C first, then Ctrl-D at the prompt.

The `--rm` option removes the chat container after it exits. Conversation history and temporary files in `/workspace` and `/tmp` are discarded. Start a fresh session with:

```sh
docker compose run --rm harness
```

Rebuild only when the application or build configuration changes. Exiting chat does not unload MiniCPM5-2B or delete the installed model.

## Release model memory

To release model memory after use:

```sh
docker model unload piarre/minicpm5:2b-q4_k_m
```

## Runtime behavior and limits

Rig runs inside Docker, while Docker Model Runner serves MiniCPM5-2B separately. No personal folders are mounted into the harness.

The harness does not set an output-token cap or generation deadline. It uses the configured model and runtime defaults. Runtime context and output limits still apply. A runtime-reported cutoff is shown as incomplete.

Terminal control characters appear as visible escapes instead of being executed. Normal text, tabs, and line breaks are preserved.

## Project work

[Tasks and verification](openspec/changes/local-model-chat-poc/tasks.md) · [GitHub Project](https://github.com/users/sysung/projects/8)
