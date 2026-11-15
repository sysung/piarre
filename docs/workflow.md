# Documentation workflow

Read the [active PoC change](../openspec/changes/local-model-chat-poc/proposal.md) and its [verification plan](../openspec/changes/local-model-chat-poc/design.md#verification-plan). The [scope mapping](../openspec/changes/local-model-chat-poc/spec-scope.md) links to the retired requirements and explains the transition to the PoC.

## Make a change

1. Identify its GitHub issue and native blockers.
2. Create an issue-linked `codex/<issue-number>-<slug>` branch.
3. Keep requirements and decisions in OpenSpec. Link each issue to its description, value and human verification steps.
4. Record evidence against the exact revision and configuration. Keep unfinished work unchecked.

## Check planning

From this repository, run:

```sh
openspec list --json
openspec validate local-model-chat-poc --strict
openspec instructions apply --change local-model-chat-poc --json
```

Structural validation does not prove isolation, inference performance or usability. Follow the milestone's observable checks and record failed or unknown outcomes. New automated tests and standalone verifiers require explicit authorization under AGENTS.md.

## Preserve history

Retain archived changes and the [pre-reset recovery reference](https://github.com/sysung/piarre/tree/archive/pre-local-model-poc-3205f75). Restore old source in a separate checkout. Never infer human acceptance from issue closure, a merge or passing structural validation.

Sync and archive only at the approved delivery boundary. Publish the five PoC capabilities at that boundary.
