# Piarre PoC — Design and Delivery Package

**Status:** Draft v0.1 | **Scenario:** “Create me a website” | **Target:** VS Code extension, editor-neutral core

## Document map
- `01_PRODUCT_PRD.md`: user journey, features, UX behavior, functional/nonfunctional requirements, acceptance criteria.
- `02_TECHNICAL_DESIGN.md`: architecture, contracts, state machines, privacy, security, failure handling.
- `03_IMPLEMENTATION_BACKLOG.md`: dependency-ordered engineering tasks with definitions of done.
- `04_TEST_EVALUATION.md`: recorded dogfooding, replay, edge cases, release gates.

## Non-negotiable PoC outcome
A developer starts a voice session, requests a website, clarifies requirements, approves a plan, watches an agent implement it, changes a requirement mid-build, previews and verifies the result, and receives an accurate recap. No per-turn push-to-talk required.

## Scope boundaries
One user, one local workspace, one active coding worker, optional read-only research worker. No standalone IDE fork, no marketplace release, no shared cloud workspace, no autonomous deployment, no always-on background microphone outside an explicitly active session.

## Suggested execution order
Architecture spike → extension shell → full-duplex voice → session/task contracts → coding worker → interruption/steering → preview/verification → durable artifacts → replay/evaluation → Cursor compatibility smoke test.
