# Launch and teardown checks

Observed 2026-11-17 for #162 on master `6ce7666`, with Docker Model Runner 1.2.9, `piarre/qwen3.5:4b-q4_k_m`, and the unchanged Rig application. This PR changes documentation only.

| Check | Observed result |
|---|---|
| `docker compose build harness` | Successful build |
| Documented one-shot arithmetic request | Qwen answered `4`; exit status 0 |
| Interactive chat | Remembered `violet-742` and recalled it on the next turn |
| Ctrl-D at empty prompt | Exit status 0; named container absent from `docker ps -a` |
| Relaunch with the same Compose command | New chat answered `NONE` when asked for a previously supplied codeword |
| Workspace reset | Manually created `/workspace/issue162-marker` and `/tmp/issue162-marker` existed before exit; both directories contained no files after relaunch |
| Actual container configuration | UID/GID 10001; read-only root; privileged false; no bind mounts or persistent volumes; temporary mounts only at `/workspace` and `/tmp` |
| Application filesystem | Writing `/usr/local/bin/issue162-marker` failed with read-only filesystem |
| Host exposure | No `/Users` or Docker socket present; no personal folders mounted |
| Final cleanup | Second chat exited successfully with Ctrl-D |

The scratch markers were created through an operator shell inside the running container, not model tools. No host workspace files were changed by these checks. Source inspection confirms conversation history is initialized in memory and is not saved; the real-model restart observation agrees with that behavior.

These checks verify the default chat container lifecycle. They do not establish complete host isolation, native-model shutdown, or human PoC acceptance. Model unloading remains optional and was not needed for reset. No application code, automated tests, or standalone verifiers were added.
