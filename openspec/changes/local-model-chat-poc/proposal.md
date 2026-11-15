# Proposal

## Why

Piarre needs a small experiment that establishes whether a local model can support a usable conversation through a Rust agent harness. The existing VS Code application and its delivery requirements obscure that question and increase setup work.

## What Changes

- **BREAKING**: remove the old application, its build/test/release machinery, and obsolete product documentation after verifying a recovery reference and obtaining approval of an exact deletion manifest. Preserve Git history, project agent instructions, OpenSpec tooling, and historical records.
- Deliver M0 preparation and isolation, M1 local inference evaluation, M2 minimal Rig chat, and M3 human acceptance. M0 includes drafting and publishing the complete M1–M3 backlog after review.
- Use Rustyline for terminal input, Rig for session-local conversation routing, and a container for the harness. Model output is inert text; this PoC has no execution tools.
- Qualify a native Apple Silicon inference endpoint. Docker Model Runner with llama.cpp is the initial hypothesis; Ollama, direct llama.cpp, and MLX remain alternatives to evaluate, not promised integrations.
- Evaluate pinned published model configurations first. A common conversion pipeline is outside the initial PoC unless a reviewed follow-up establishes its need.
- Measure runtime performance separately from model quality. Require less than 8 GB of total serving memory for qualifying local configurations.
- Organize approved GitHub work by milestone, user-story parent, small sub-issues, and native dependencies in Project 8. Keep implementation completion separate from user acceptance.

## Capabilities

### New Capabilities

- `isolated-local-inference`: explicit provisioning, restricted connectivity, pinned local model configuration, and measured serving limits.
- `inference-evaluation`: reproducible runtime/model comparisons and evidence-bound conclusions.
- `poc-delivery`: recovery-first reset, dependency-linked planning, milestone gates, and explicit PoC acceptance.

### Modified Capabilities

- `typed-discussion`: replace VS Code/Codex-specific durable conversation with tool-free terminal chat and session-local context.
- `approved-execution`: remove coding-run approval, ownership, and subscription forecasting requirements from this chat-only PoC.
- `goal-proposals`: retire saved goal and proposal UI behavior.
- `project-state`: retire VS Code project identity/storage and durable command replay requirements.
- `project-knowledge`: defer durable knowledge and scoped corrections until a later proposal.
- `result-review`: replace patch-review requirements with revision-bound PoC evidence and human acceptance.
- `workspace-recovery`: retire patch publication and checkpoint restoration; the PoC cannot mutate user repositories.
- `imported-acceptance-baseline`: retire legacy application acceptance contracts while preserving their historical source.

## Impact

The reset affects `apps/`, `packages/`, legacy tests and scripts, Node configuration, and VS Code release workflows. New Rust and Compose implementation follows only after this plan is reviewed and apply is requested. Main specifications remain unchanged during proposal creation; the deltas describe their intended replacement or retirement.

Model files, runtime installation, benchmark execution, GitHub publication, cleanup, and release are not performed by this proposal. No model training, OpenCode integration, autonomous coding, retrieval, cross-session memory, cloud fallback, or shared multi-user hosting is included. The earlier 90% ambition is not an acceptance threshold.
