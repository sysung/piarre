# Triage labels

Use the GitHub label mapped to each role.

| Triage role | GitHub label | Meaning |
|---|---|---|
| `needs-triage` | `needs-triage` | Maintainer review has not concluded |
| `needs-info` | `needs-info` | A named unanswered question prevents approval |
| `ready-for-agent` | `ready-for-agent` | Approved for agent execution, subject to blockers and explicit gates |
| `ready-for-human` | `ready-for-human` | Approved for human work or decision, subject to blockers and explicit gates |
| `wontfix` | `wontfix` | Work declined; record why before closing |

Use exactly one current triage label; retain descriptive labels such as `bug` or `enhancement`. Natural-language feedback is enough: the maintainer can say “looks good for an agent,” “needs this change,” or “we need an answer first.” Translate the decision into the appropriate label and keep the body consistent with it. Do not turn an ambiguous reaction into approval.

Approval, priority, and execution status are separate. An approved issue may remain blocked and in the backlog. Review the next milestone and actionable children first; distant roadmap items can stay in `needs-triage`. A parent approval does not approve its children. Check applicable parent gates when starting a child; GitHub does not propagate that approval through the hierarchy.
