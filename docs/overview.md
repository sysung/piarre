# Project overview

Piarre is a centralized AI orchestrator for seeing, directing and verifying agent work. Agent visibility is the primary product direction; typed discussion is a supporting tool and voice is deferred. Piarre aims to reduce supervision effort. Evaluation must establish whether it does.

Piarre initially serves developers working on their own projects. The self-use candidate should preserve continuity across sessions, business context and inspectable decisions while reducing repeated explanation and reading.

## Current direction and architecture

The VS Code extension presents recorded project state, task proposals, agent ownership and available controls. Its runtime owns domain events and SQLite-backed project state. The webview presents records and requests explicit commands; it does not grant authority. A retrieval index helps find evidence and does not replace the underlying source records.

Start with [project state](../openspec/specs/project-state/spec.md), [goal proposals](../openspec/specs/goal-proposals/spec.md), [approved execution](../openspec/specs/approved-execution/spec.md), [knowledge](../openspec/specs/project-knowledge/spec.md), [typed discussion](../openspec/specs/typed-discussion/spec.md), [result review](../openspec/specs/result-review/spec.md), and [recovery](../openspec/specs/workspace-recovery/spec.md). The [imported acceptance baseline](../openspec/specs/imported-acceptance-baseline/spec.md) preserves four existing automated contracts without broadening their claims. [Pending delivery criteria](../openspec/changes/2026-11-13-061200-retained-delivery-scope/design.md) remain unverified.

## Requirements, discovery and evidence

OpenSpec main specs hold adopted requirements; active changes hold their own proposed scope and decisions. A newer proposal does not automatically override an adopted requirement. GitHub issues track feasibility, priority, work and evidence. If an issue conflicts with OpenSpec, present both sources to the user, record the resolution in the change, and only then continue work depending on that decision.

Discovery branches may make reversible experimental decisions. Record their scope and outcome; abandoned experiments must not synchronize unaccepted deltas into main specs. Preserve useful findings in history. The [design principles](USER_DESIGN_PRINCIPLE.md) retain open ideas and source limitations. In particular, the trigger for automatic memory capture remains unresolved; requiring provenance does not choose that trigger.

Code and tests describe actual implementation and observations at their recorded revisions. A plan, a passing structural check or an automated catalog label does not establish current runtime correctness.

## Using Piarre

Installation, development, first-use, isolated candidate and diagnostic instructions remain in the [code README](../README.md). Use the README from the revision you are running.

## Optional reflection

Optional session reflection uses `.artifacts/sessions/<encoded-reflection-id>/reflection.md` for an exported work artifact. **Piarre: End Session (Optional Reflection)** offers decline, inspection, feedback, or deferred review. **Piarre: Review Reflection** reopens pending or historical records. Reflection and explanation preferences live in the canonical project event history. A generated reflection opens as an unsaved document; the developer chooses whether to save it. Source revisions and user corrections remain inspectable. Documentation and improvement proposals do not apply changes or approve work. Use **Piarre: Explanation Preference** to inspect, skip, or reset the optional reflection explanation detail and self-reported component familiarity.
