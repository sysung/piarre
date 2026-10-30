# Repository instructions

## Pstack token efficiency

Before substantial work, choose the least expensive workflow that can meet the acceptance criteria.

Give a rough low, medium, or high token estimate with assumptions and confidence. Distinguish estimated usage from measured usage.

Default to one agent. Delegate only a specific independent task whose benefit justifies the added context and coordination. Give delegates only the context they need.

Use lower reasoning for routine work and increase it for concrete uncertainty. Avoid duplicate investigations and repeated reviews unless new evidence warrants them.

Keep the assessment proportional to the task. Treat token budgets as advisory unless an enforcement mechanism exists.

## Issue-to-PR lifecycle

Use this lifecycle for every implementation item.

1. Identify the GitHub issue before changing files. Create an issue when the requested implementation has no existing item. Do not create issues for read-only questions or routine repository operations.
2. Add the issue to the Piarre project when it is not already present. Set its status to In progress when implementation starts.
3. Create a dedicated branch from the current integration base. Name it `codex/<issue-number>-<short-slug>`. Keep one issue per branch and exclude unrelated changes.
4. Keep the issue description accurate. Record material scope changes, completed work, verification evidence, and blockers as progress comments. Avoid comments that only repeat commit messages or CI status.
5. Open a pull request for the branch. Link it with `Closes #<issue-number>`. Describe the user outcome, the implementation, the verification performed, and any open risk.
6. Set the project item to In review when the pull request is ready for review. Use the project's linked pull request field when GitHub does not populate it automatically.
7. Before reporting completion, read back the issue, project status, branch, pull request, checks, and merge state. Distinguish proposed, in progress, implemented, verified, reviewed, merged, and complete.
8. Set the project item to Done only after the pull request is merged and the issue is closed. Add a final issue comment with the pull request link and the verification result when GitHub's automatic timeline does not show enough context.

For stacked work, give every issue its own branch and pull request. Use the preceding issue branch as the base only when the dependency requires it, and retarget the pull request after its dependency merges.
