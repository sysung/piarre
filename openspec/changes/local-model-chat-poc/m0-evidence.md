# M0 evidence

## Recovery — verified

- Source revision: `3205f75e82ac7f1d82d9db961638252881cf7e88`.
- [Remote recovery branch](https://github.com/sysung/piarre/tree/archive/pre-local-model-poc-3205f75): `archive/pre-local-model-poc-3205f75`.
- Independent clone: `/tmp/piarre-recovery-3205f75`.
- Original and recovery Git trees both equal `2f9522be3aa70da965fe5ddaafdb81f2262dbb54`.
- Recovery checkout is clean; `git fsck --full` exited successfully.
- This verifies tracked source recovery, not restoration of user databases or installed dependencies.

## Reset — approved

All 149 paths in the [exact deletion manifest](design.md#draft-deletion-manifest) exist in the current tracked baseline. No tracked local modifications were present during inspection. The untracked current proposal remains preserved.

Retain Git history, `.agents/`, `AGENTS.md`, `docs/agents/`, OpenSpec configuration, archived records, current specs pending normal sync, and this change. Rewrite `README.md`, `docs/workflow.md`, and `.gitignore` separately. Do not touch user data, caches, other checkouts, or releases.

No deletion, installation, inference run, or benchmark has occurred. Recheck the manifest and worktree immediately before approved removal.

## Publication and approval

The maintainer approved publication and the exact reset manifest with “yes you may continue” after both were presented. Four milestones, seven parent issues and 28 child issues were published. Readback verified all issue bodies, milestone assignments, native parent/dependency relationships and Project 8 Backlog entries. IDs are in [github-map.json](github-map.json). Views and automation verification remain task 0.10.
