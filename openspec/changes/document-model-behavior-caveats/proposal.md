# Proposal

## Why

Local trials reproduced Qwen’s contradictory refusal to recall a harmless codeword, while MiniCPM answered and Nanbeige could not load. Preserve these findings so future model choices use observed behavior without treating a chat failure as proof of coding inability.

## What Changes

- Add a dated model-observation record under the active `local-model-chat-poc` OpenSpec change, including prompts, response excerpts, configuration identifiers and limitations.
- Link that record from the prerequisite inventory and distinguish its historical research from subsequent execution results.
- Keep Qwen available and the default unchanged. Record Nanbeige’s backend compatibility failure separately from generated answers.
- Apply documentation only: no source, prompts, history handling, runtime settings, model installs, automated tests or admission gates.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The active PoC’s `inference-evaluation` requirements already cover observations and bounded conclusions. This documentation-only change uses `skip_specs: true`; it adds evidence, not a new behavior contract.

## Impact

Only OpenSpec Markdown documentation changes during apply. The planned evidence file is `openspec/changes/local-model-chat-poc/model-observations.md`, linked from `prerequisites.md`. Existing README edits and paused launch/teardown work remain separate. Issue #206 is investigation context, not a claim that the Qwen behavior has been fixed.
