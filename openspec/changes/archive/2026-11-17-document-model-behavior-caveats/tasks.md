# Tasks

## 1. Preserve model observations

- [x] 1.1 Add `openspec/changes/local-model-chat-poc/model-observations.md` with the dated configuration, exact prompts, labeled response excerpts and artifact identifiers from the design snapshot. Verify Qwen fresh-session refusal, MiniCPM’s two successful recall sessions and Nanbeige’s loading error are individually represented; mark uncaptured metadata as unknown.
- [x] 1.2 Include bounded conclusions and optional manual replay commands in that note. Verify it keeps Qwen eligible for coding trials without claiming coding competence, records no Nanbeige answer, makes no general MiniCPM ranking, and explains Ctrl-D plus relaunch as session-history reset.

## 2. Connect and verify the documentation

- [x] 2.1 Link the observation note from the existing PoC prerequisite inventory and qualify historical no-execution wording. Verify the link resolves and historical research remains distinct from the November 17 observations.
- [x] 2.2 Run `openspec validate document-model-behavior-caveats --strict` and inspect the scoped diff. Verify only the planned OpenSpec documentation and task status changed; exclude existing README edits, source, Compose, dependency, runtime and test changes. Confirm the wording does not claim issue #206 is fixed.

## 3. Record accepted PoC limitations

- [x] 3.1 Record the user acceptance of the observed limitations in the model-observation note and add a short README notice. Preserve dated successes and failures, distinguish hypotheses from established causes, and state that #206 closes without a technical fix. Verify links and strict OpenSpec validation; no application code or new tests.
