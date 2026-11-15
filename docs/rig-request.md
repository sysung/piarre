# Send one request through Rig

Start Docker Desktop with the [local Qwen model installed](local-model-setup.md), then run from the repository root:

```sh
docker compose build harness
docker compose run --rm harness "What is 2 + 2? Reply with only the number."
```

The command starts the Rust application inside Linux Docker. Rig sends the prompt to Docker Model Runner and prints the returned text. This first slice accepts one request and exits. Interactive conversation, streaming and file tools follow in separate tasks.

## Configuration

Compose explicitly supplies these defaults; the application does not read cloud API keys or choose another provider on failure:

| Variable | Default |
|---|---|
| `PIARRE_ENDPOINT` | `http://model-runner.docker.internal/engines/llama.cpp/v1` |
| `PIARRE_MODEL` | `piarre/qwen3.5:4b-q4_k_m` |

The container uses Docker Desktop's model-runner hostname. `localhost` inside a container refers to that container, not your Mac. See [Docker's API reference](https://docs.docker.com/ai/model-runner/api-reference/).

Choose another installed local model explicitly:

```sh
PIARRE_MODEL=your-local-model docker compose run --rm harness "Hello"
```

This slice uses temperature 0, an output cap of 128 tokens, a 120-second client timeout and `enable_thinking: false`. These are starting settings, not performance claims. Other models may not support the same template option. Rig's OpenAI-compatible chat interface is used only as the local wire format; no OpenAI account or key is needed. The library receives a fixed non-secret placeholder because the local DMR endpoint ignores authentication.

An unavailable endpoint exits unsuccessfully with `Request failed` rather than downloading a model or falling back to a cloud service:

```sh
PIARRE_ENDPOINT=http://127.0.0.1:1/v1 docker compose run --rm harness "Hello"
```

If the client times out, backend work may still be running. To unload only this model after use:

```sh
docker model unload piarre/qwen3.5:4b-q4_k_m
```

## Container scope

The runtime has no host-folder, credential or Docker-socket mounts. It runs as user 10001 with a read-only root filesystem, dropped Linux capabilities and no privilege escalation. `/workspace` and `/tmp` are temporary memory-backed filesystems; both disappear with the container. Container memory is capped at about 0.54 GB, independent of the native model server's memory.

There is no shell or file tool exposed to the model. The application/image and local inference runtime remain trusted software; these settings do not promise complete network isolation against compromised application code. No ports are published.

The compiler and dependency cache stay in Docker build storage. Building downloads Rust dependencies and base images; running the application does not download weights. `Cargo.lock` records the resolved Rust dependencies.
