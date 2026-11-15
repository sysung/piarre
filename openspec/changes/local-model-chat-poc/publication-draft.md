# GitHub publication draft

Publish four milestones, seven user-story parents, and 28 child issues from the reviewed task briefs. M1–M3 remain provisional until M0 research supplies exact artifacts and settings.

Commit scope: only `openspec/changes/local-model-chat-poc/`. Publish these artifacts on an issue-linked `codex/` branch so issue links resolve. No application cleanup belongs in that commit.

Each issue starts with the required triage disclaimer, uses `enhancement` and `needs-triage`, and is added to Project 8 in Backlog. Preserve native parent and blocked-by relationships. Do not alter retired issues. Task 0.1 carries the verified recovery evidence; acceptance is never inferred from closure.

## Milestones

- M0 — Preparation and isolation
- M1 — Running a local model
- M2 — Creating the agent harness
- M3 — User Acceptance Testing

## Parent issues

- S0 (M0): I can start clean and recover the old version.
- S1 (M0): I can isolate testing from daily work.
- S2 (M0): I can see future work and its blockers.
- S3 (M1): I can run a local model and inspect speed and memory.
- S4 (M1): I can choose a model using comparable quality results.
- S5 (M2): I can chat with the selected model through Rig.
- S6 (M3): I can explicitly accept or reject the PoC.

## Child issues

The bodies are the description, value, verification, exclusions and contracts in [tasks.md](tasks.md), with published OpenSpec links. Dependencies below become native GitHub links.

| ID | Title | Parent | Blocked by |
|---|---|---|---|
| 0.0 | Bootstrap the reviewed issue map | S2 | none |
| 0.1 | Verify the recovery reference | S0 | none |
| 0.2 | Approve the exact reset manifest | S0 | 0.0, 0.1 |
| 0.3 | Remove approved legacy code and release machinery | S0 | 0.2 |
| 0.4 | Record retained and retired specification scope | S0 | 0.3 |
| 0.5 | Inventory runtime and model prerequisites | S1 | none |
| 0.6 | Approve the isolation and provisioning profile | S1 | 0.5 |
| 0.7 | Check the surrogate isolation environment | S1 | 0.0, 0.6 |
| 0.8 | Freeze measurement and evaluation protocol | S2 | 0.5, 0.6 |
| 0.9 | Finalize the complete backlog after research | S2 | 0.0, 0.4, 0.8 |
| 0.10 | Configure Project views and transitions | S2 | 0.9 |
| 0.11 | Review M0 readiness with the maintainer | S2 | 0.7, 0.10 |
| 1.1 | Provision one approved baseline model | S3 | 0.11 |
| 1.2 | Qualify the live inference route | S3 | 1.1 |
| 1.3 | Qualify candidate memory and timing | S3 | 1.2 |
| 1.4 | Compare compatible runtime configurations | S3 | 1.3 |
| 1.5 | Qualify the model-quality evaluator | S4 | 0.11 |
| 1.6 | Evaluate the eligible small-model cohort | S4 | 1.4, 1.5 |
| 1.7 | Record the selected configuration or stop decision | S4 | 1.6 |
| 2.1 | Route a fixed input through containerized Rig | S5 | 1.7 |
| 2.2 | Add Rustyline conversation input | S5 | 2.1 |
| 2.3 | Stream and safely render model text | S5 | 2.2 |
| 2.4 | Enforce context and request limits | S5 | 2.3 |
| 2.5 | Cancel and reconcile interrupted requests | S5 | 2.4 |
| 2.6 | Package the chat launch in Compose | S5 | 2.5, 0.7 |
| 3.1 | Run the human acceptance session | S6 | 2.6 |
| 3.2 | Retest accepted UAT fixes | S6 | 3.1 |
| 3.3 | Record PoC acceptance and next questions | S6 | 3.2 |

## Readback

Verify every milestone assignment, issue body, parent and blocker after publication. Save the draft-ID to GitHub-number map here. Project view and automation changes remain task 0.10 after backlog finalization.
