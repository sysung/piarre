# Piarre documentation

Piarre centralizes agent visibility, work coordination, and evidence so users can direct and verify work without reconstructing status from conversations.

The lasting documents are:

- [Product PRD](01_PRODUCT_PRD.md). Who Piarre serves, the business problem, product principles, and required behavior.
- [Technical design](02_TECHNICAL_DESIGN.md). UI, architecture, trust boundaries, and verification requirements.
- [User design principles](04_USER_DESIGN_PRINCIPLES.md). The human-agent collaboration goals that guide design choices and experiments.
- This README. Documentation ownership and navigation.

Update these documents as the product changes. Merge lasting decisions into the relevant document instead of adding another design summary.

[GitHub Project 8](https://github.com/users/sysung/projects/8/views/1) and its linked issues own implementation scope, dependencies, status, acceptance criteria, and delivery evidence. The [integrated candidate epic (#51)](https://github.com/sysung/piarre/issues/51) groups current delivery work. Work-specific plans, historical snapshots, recordings, test results, and handoffs belong in `.artifacts` or the associated issue and PR. `.artifacts` is ignored by Git; evidence that must be shared belongs in GitHub or a durable artifact store.

An artifact can preserve a past plan. The PRD and technical design preserve its lasting intent and accepted conclusions. Link the records when useful, keep one authority for each fact, and distinguish planned outcomes from observed results.

The user design principles retain open design questions and source limitations. They guide decisions without replacing the authoritative delivery backlog.

Optional session reflection uses `.artifacts/sessions/<encoded-reflection-id>/reflection.md` for an exported work artifact. **Piarre: End Session (Optional Reflection)** offers decline, inspection, feedback, or deferred review. **Piarre: Review Reflection** reopens pending or historical records. Reflection and explanation preferences live in the canonical project event history. A generated reflection opens as an unsaved document; the developer chooses whether to save it. Source revisions and user corrections remain inspectable. Documentation and improvement proposals do not apply changes or approve work. Use **Piarre: Explanation Preference** to inspect, skip, or reset the optional reflection explanation detail and self-reported component familiarity.
