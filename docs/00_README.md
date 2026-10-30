# Piarre design and delivery package

**Status:** Product and delivery design v0.2 | **First workflow:** Build and verify a local website | **Target:** VS Code extension, editor-neutral core

## Document map
- `01_PRODUCT_PRD.md`: voice-first agent IDE thesis, audience, product model, features, UX, wireframe, trust boundaries, metrics, and staged scope.
- `02_TECHNICAL_DESIGN.md`: architecture, contracts, state machines, privacy, security, failure handling.
- `03_IMPLEMENTATION_BACKLOG.md`: dependency-ordered engineering tasks with definitions of done.
- `04_TEST_EVALUATION.md`: recorded dogfooding, replay, edge cases, release gates.

## Product direction
Piarre is a voice-first IDE for directing, observing, and verifying coding agents. The live work graph is the primary object. Voice directs visible work. Exact plans, code, diffs, approvals, budgets, and evidence remain visual. Models propose actions, while deterministic code owns authorization and task state.

## Non-negotiable P0 outcome
A developer starts a voice or typed session, requests a website, reviews and approves a work graph, watches one coding worker implement it, changes a requirement mid-build, previews and verifies the result, and accepts an evidence-backed task. The project survives the conversation and an editor restart.

## Scope boundaries
P0 supports one user, one local workspace, and one active coding writer. P1 can add a read-only worker, then isolated coding workers after conflict and evidence gates pass. No standalone IDE fork, shared cloud workspace, autonomous deployment, or background microphone outside an explicit session.

## Suggested execution order
Durable typed control loop → voice and typed control → trustworthy supervision → supervised-writer release gate → isolated worker experiments.

The product design, technical design, implementation backlog, and evaluation plan share the v0.2 direction. Historical A00 observations remain evidence only and cannot satisfy a B-series release gate.
