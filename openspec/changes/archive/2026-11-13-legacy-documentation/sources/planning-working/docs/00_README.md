# Piarre documentation

Piarre centralizes agent visibility, work coordination, and evidence so users can direct and verify work without reconstructing status from conversations.

OpenSpec records current behavior as requirements and scenarios. Start with the capability you want to change:

- [Project state](../openspec/specs/project-state/spec.md)
- [Goal proposals](../openspec/specs/goal-proposals/spec.md)
- [Project knowledge](../openspec/specs/project-knowledge/spec.md)
- [Typed discussion](../openspec/specs/typed-discussion/spec.md)
- [Approved execution](../openspec/specs/approved-execution/spec.md)
- [Result review](../openspec/specs/result-review/spec.md)
- [Workspace recovery](../openspec/specs/workspace-recovery/spec.md)

Use `openspec list --specs` to discover capabilities. Describe proposed behavior changes under `openspec/changes/` and reconcile accepted changes into the main specs when archiving.

The supporting documents are:

- [Product PRD](01_PRODUCT_PRD.md). Who Piarre serves, the business problem, product principles, and required behavior.
- [Technical design](02_TECHNICAL_DESIGN.md). UI, architecture, trust boundaries, and verification requirements.
- [User design principles](03_USER_DESIGN_PRINCIPLES.md). The human-agent collaboration goals that guide design choices and experiments.
- This README. Documentation ownership and navigation.

Keep product direction and architecture rationale in these documents. Update the relevant OpenSpec capability when its specified behavior changes.

[GitHub Project 8](https://github.com/users/sysung/projects/8/views/1) and its linked issues own implementation scope, dependencies, status, acceptance criteria, and delivery evidence. The [integrated candidate epic (#51)](https://github.com/sysung/piarre/issues/51) groups current delivery work. Work-specific plans, historical snapshots, recordings, test results, and handoffs belong in `.artifacts` or the associated issue and PR. `.artifacts` is ignored by Git; evidence that must be shared belongs in GitHub or a durable artifact store.

An artifact can preserve a past plan. OpenSpec records current behavior, the PRD records product direction, and the technical design explains architecture decisions. Link run evidence when it supports a claim about observed results.

The user design principles retain open design questions and source limitations. They guide decisions without replacing the authoritative delivery backlog.
