# Issue template design review

The Arena compared two independent designs for a readable, low-ceremony issue template. Both recommended one Markdown template, native GitHub relationships, and separate approval and dependency states. No candidate dropped out.

| Criterion (1–5) | Parent: candidate 1 | Parent: candidate 2 | Cross-judge: candidate 1 | Cross-judge: candidate 2 |
| --- | ---: | ---: | ---: | ---: |
| Clarity | 4 | 5 | 4 | 5 |
| GitHub correctness | 4 | 5 | 4 | 5 |
| Low ceremony | 5 | 5 | 5 | 4 |
| Approval safety | 5 | 5 | 4 | 5 |
| Maintainability | 5 | 4 | 5 | 4 |
| Total | 23 | 24 | 22 | 23 |

Both reviewers chose candidate 2: its explicit distinction between approval, dependency closure, and acceptance evidence prevents an agent from starting prematurely. Candidate 1 contributed a shorter contract prompt, a “Not applicable” option, and preservation of existing checkbox state during migration. Label definitions live in one document.

Rejected for this first pass: mandatory Issue Forms, duplicated parent/blocker labels, multiple author-specific templates, automatic approval, and new bots or Actions. Native project auto-add and required form fields remain options if actual intake problems justify them. Forms support project assignment subject to author permissions; the chosen Markdown template leaves tracking setup explicit.

The migration covers PKM issues #185–198. It reorganizes their existing contracts into the requested six sections, with tracking and authorization notes retained. It does not approve children, change milestones, alter dependency edges, or authorize product implementation. #185 retains its existing conditional approval. Issue edits are live independently of the template PR.

Verification: reviewed both proposals and the synthesis, checked GitHub's documented template/dependency capabilities, checked the diff for whitespace errors, and read back all 14 issue bodies and their tracking metadata after migration. Template activation in the hosted chooser remains a post-merge check because templates are loaded from the default branch.

## Verification refinement

The maintainer approved the Interrogate recommendation to keep one compact Agent Verification Plan immediately before OpenSpec Contract. Acceptance checkboxes have no AC-number prefixes. Human walkthroughs are generated on request or at a required human acceptance handoff, using actual artifacts and commands rather than premature placeholders. Human decision criteria and prerequisite acceptance gates remain in the issue from triage. Generic evidence-reporting rules live in the workflow guide instead of being repeated on every issue.
