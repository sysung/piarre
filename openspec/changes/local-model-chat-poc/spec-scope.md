# Legacy specification scope

The approved local-model-chat-poc change replaces the old application scope. The legacy main specs were retired separately on 2026-11-15. The active PoC deltas describe the proposed replacement behavior until the approved sync and archive boundary.

| Legacy capability | Requirements reviewed | Disposition |
|---|---:|---|
| [approved-execution](https://github.com/sysung/piarre/blob/3205f75e82ac7f1d82d9db961638252881cf7e88/openspec/specs/approved-execution/spec.md) | 3 | Retire all legacy requirements from this PoC |
| [goal-proposals](https://github.com/sysung/piarre/blob/3205f75e82ac7f1d82d9db961638252881cf7e88/openspec/specs/goal-proposals/spec.md) | 4 | Retire all legacy requirements from this PoC |
| [imported-acceptance-baseline](https://github.com/sysung/piarre/blob/3205f75e82ac7f1d82d9db961638252881cf7e88/openspec/specs/imported-acceptance-baseline/spec.md) | 4 | Retire all legacy requirements from this PoC |
| [project-knowledge](https://github.com/sysung/piarre/blob/3205f75e82ac7f1d82d9db961638252881cf7e88/openspec/specs/project-knowledge/spec.md) | 2 | Retire all legacy requirements from this PoC |
| [project-state](https://github.com/sysung/piarre/blob/3205f75e82ac7f1d82d9db961638252881cf7e88/openspec/specs/project-state/spec.md) | 2 | Retire all legacy requirements from this PoC |
| [result-review](https://github.com/sysung/piarre/blob/3205f75e82ac7f1d82d9db961638252881cf7e88/openspec/specs/result-review/spec.md) | 2 | Replace with revision-bound PoC evidence and explicit user acceptance |
| [typed-discussion](https://github.com/sysung/piarre/blob/3205f75e82ac7f1d82d9db961638252881cf7e88/openspec/specs/typed-discussion/spec.md) | 2 | Replace with session-local, tool-free terminal chat |
| [workspace-recovery](https://github.com/sysung/piarre/blob/3205f75e82ac7f1d82d9db961638252881cf7e88/openspec/specs/workspace-recovery/spec.md) | 2 | Retire all legacy requirements from this PoC |

New capabilities are `isolated-local-inference`, `inference-evaluation`, and `poc-delivery`. Their deltas define the adopted experiment requirements; passing planning validation does not establish delivery.

At sync, publish the five PoC capabilities. For the retirement decision and verification evidence, see [issue #170](https://github.com/sysung/piarre/issues/170).
