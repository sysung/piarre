# Piarre

Piarre is a local-model experiment: can a small model support useful conversation through a Rust Rig harness?

The project is starting local inference. The previous VS Code application has been removed from this branch. The new chat executable is not implemented yet.

## Planned experience

Use Rustyline to type messages into a containerized Rig harness. The harness calls a separately provisioned local inference server and streams plain text back. It has no shell tools, repository access or persistent chat history by default.

Start with [local model setup](docs/local-model-setup.md). Try real configurations and record their behavior; benchmark scores and memory targets do not control admission. After the user tries chat, scoped file tools will operate inside a disposable Linux workspace.

## Follow the work

- [Milestones, tasks and verification](openspec/changes/local-model-chat-poc/tasks.md)
- [Architecture and verification plan](openspec/changes/local-model-chat-poc/design.md)
- [GitHub Project](https://github.com/users/sysung/projects/8)
- [Documentation workflow](docs/workflow.md)

M0 prepares the environment and backlog. M1 establishes a real local response. M2 builds minimal chat. M3 records human acceptance or rejection.

## Recover the old version

The [recovery branch](https://github.com/sysung/piarre/tree/archive/pre-local-model-poc-3205f75) preserves the old tracked source at `3205f75e82ac7f1d82d9db961638252881cf7e88`. Check it out separately if needed. Cleanup does not migrate or remove legacy user data.

## Specification transition

The [active change](openspec/changes/local-model-chat-poc/proposal.md) defines this PoC. The active change holds the proposed requirements until delivery and acceptance. See the [scope mapping](openspec/changes/local-model-chat-poc/spec-scope.md) before implementing requirements.
