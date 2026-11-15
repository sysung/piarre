# Legacy specification scope

The approved local-model-chat-poc change replaces the old application scope. Main spec files remain unchanged until the normal sync/archive boundary; they are not implementation instructions for the chat PoC.

| Legacy capability | Requirements reviewed | Disposition |
|---|---:|---|
| [approved-execution](specs/approved-execution/spec.md) | 3 | Retire all legacy requirements from this PoC |
| [goal-proposals](specs/goal-proposals/spec.md) | 4 | Retire all legacy requirements from this PoC |
| [imported-acceptance-baseline](specs/imported-acceptance-baseline/spec.md) | 4 | Retire all legacy requirements from this PoC |
| [project-knowledge](specs/project-knowledge/spec.md) | 2 | Retire all legacy requirements from this PoC |
| [project-state](specs/project-state/spec.md) | 2 | Retire all legacy requirements from this PoC |
| [result-review](specs/result-review/spec.md) | 2 | Replace with revision-bound PoC evidence and explicit user acceptance |
| [typed-discussion](specs/typed-discussion/spec.md) | 2 | Replace with session-local, tool-free terminal chat |
| [workspace-recovery](specs/workspace-recovery/spec.md) | 2 | Retire all legacy requirements from this PoC |

New capabilities are `isolated-local-inference`, `inference-evaluation`, and `poc-delivery`. Their deltas define the adopted experiment requirements; passing planning validation does not establish delivery.

At sync, apply each explicit replacement/removal and update legacy Purpose text. Retain archived records and recovery history. Do not restore retired coding-agent requirements without a later proposal.
