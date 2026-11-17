# Issue tracker

Use `gh` to read, create, and update issues in `sysung/piarre`. Link each issue to the relevant OpenSpec spec or change and its verification section when available. If an issue conflicts with OpenSpec, surface the conflict before proceeding with work that depends on it. Record the resolution in OpenSpec and update the issue link.

## GitHub operations

- Create an issue with `gh issue create --repo sysung/piarre --title "..." --body "..."`.
- Read an issue and its discussion with `gh issue view <number> --repo sysung/piarre --json number,title,body,labels,comments`.
- List issues with `gh issue list --repo sysung/piarre` and the relevant state and label filters. Its default limit is 30. For a complete open queue, use `gh api --paginate "repos/sysung/piarre/issues?state=open&per_page=100" --jq '.[] | select(has("pull_request") | not) | {number, title, labels: [.labels[].name]}'`.
- Apply or remove a triage label with `gh issue edit <number> --repo sysung/piarre --add-label <label>` or `--remove-label <label>`.
- Record the reason with `gh issue comment <number> --repo sysung/piarre --body-file <path>` before closing an issue with `gh issue close <number> --repo sysung/piarre`. Use `--body-file` for multiline issue bodies and comments.

- **Make an issue a sub-issue of a parent**: `gh issue create --repo sysung/piarre --parent <parent> ...`, or `gh issue edit <parent> --repo sysung/piarre --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `gh api --method POST repos/sysung/piarre/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, as in **Blocking** below). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh issue create --repo sysung/piarre --blocked-by <n>,<n> ...` or `gh issue edit <child> --repo sysung/piarre --add-blocked-by <blocker>` (`gh` 2.94+). Older `gh`: `gh api --method POST repos/sysung/piarre/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/sysung/piarre/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. GitHub shows a ticket as unblocked when every blocker is closed. Explicit acceptance gates still require their own evidence; closure alone does not establish acceptance.
- **Count open blockers**: `gh api repos/sysung/piarre/issues/<n> --jq .issue_dependencies_summary.blocked_by` (open blockers only). Use the REST summary for the complete native count. If a ticket uses the `Blocked by` text fallback, read every listed blocker and require each to be closed, even when the native count is zero. A missing count or unreadable blocker requires resolving that uncertainty before treating the ticket as unblocked.

**PRs as a request surface: no.**

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --repo sysung/piarre --label wayfinder:map --title "..." --body-file <path>`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: see **Blocking** under GitHub operations.
- **Frontier query**: enumerate the map's children with `gh api --paginate repos/sysung/piarre/issues/<map>/sub_issues --jq '.[] | select(.state == "open" and (.assignees | length) == 0) | {number, title}'`. For each candidate, run **Count open blockers** and keep only tickets with no open native or text-fallback blockers. Preserve the returned child order. With the task-list fallback, read each linked issue and apply the same state, assignee, and blocker checks in task-list order. The first remaining ticket is the frontier choice.
- **Claim**: `gh issue edit <n> --repo sysung/piarre --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --repo sysung/piarre --body-file <path>`, then `gh issue close <n> --repo sysung/piarre`, then read the latest map body and append a short summary and link to its Decisions-so-far using `gh issue edit <map> --repo sysung/piarre --body-file <path>`. Preserve the other map sections. Record product requirements and design decisions in the relevant OpenSpec artifact and link to it from the map.

## Writing and triaging work items

Use [the Work item template](../../.github/ISSUE_TEMPLATE/work-item.md) for new work. Keep its six core sections in order, followed by Verification. Use bullets except for the numbered human walkthrough. One bullet per section is enough for small changes; do not invent detail to fill space. Agents using `gh --body-file` must use the same body structure (without the template's YAML frontmatter); CLI and API submissions do not enforce the web template.

- Explain the problem and expected value before implementation terminology. Give research tasks a concrete decision or report as their deliverable.
- Give each acceptance checkbox an observable outcome without AC-number prefixes. Put procedures in Verification and refer to outcomes by their descriptive wording. Link a child beside the outcome when helpful, but keep parent integration acceptance separate from child closure. Closing a child is not proof the parent's behavior passed.
- Link the actual OpenSpec source and verification section. Use “Pending” with a specific question when unresolved, or “Not applicable” with a reason for work without contract impact. Preserve the distinction between proposed and adopted requirements.
- AI-generated triage bodies and comments start with `> *This was generated by AI during triage.*`. Human-authored issues do not need that disclosure.
- Follow [triage labels](triage-labels.md). Editing a description does not approve implementation. Update stale approval wording when the maintainer explicitly approves an issue.

## GitHub tracking responsibilities

| Feature | Purpose | How to use it |
| --- | --- | --- |
| Native sub-issues | Divide an outcome into independently owned/reviewed work | Attach children to the parent. Do not create a ticket for every acceptance checkbox. |
| Native blocked-by / blocking | Express required execution order | Set the actual prerequisite edge. GitHub exposes the inverse relationship; avoid duplicate `blocked` or `is-blocking` labels. |
| Milestone | Group a delivery checkpoint | Assign scheduled work to its M-numbered milestone. A milestone is not an approval or dependency. |
| Project #8 | Show delivery progress and ownership | Add the issue to the Piarre project and use existing statuses/fields. Approved but blocked work stays out of In Progress. |
| Triage label | Record review decision and intended implementer | Use one current triage label, independently for parent and children. |
| Descriptive labels | Classify the work | Reuse existing labels such as `bug` and `enhancement`; do not duplicate milestone or relationship data. |
| Assignee and linked PR | Identify active ownership and implementation evidence | Assign when work is claimed. Link the implementation PR to the issue it actually resolves; do not close a parent before integrated acceptance. |

Configure native relationships after creating an issue; Markdown references alone do not create them. Keep body tracking notes only for rationale, explicit gates, or a documented fallback, and reconcile them with native edges when editing. Read dependencies before starting work, including explicit acceptance gates and applicable parent constraints. Missing relationship data is not evidence of zero blockers.

For example, #185 is approved for an agent but must wait for #138 and #165 with recorded M3 acceptance. Its children still need their own triage decisions. No label, project status, milestone completion, or automatic issue closure substitutes for that acceptance.

For CLI authors, use the existing commands above for relationships and labels. Add project membership explicitly with `gh project item-add 8 --owner sysung --url ISSUE_URL`; set the chosen existing milestone with `gh issue edit NUMBER --repo sysung/piarre --milestone "MILESTONE_TITLE"`. Read back the issue and project membership after publishing. Do not assume an issue template assigned either field.

## Template activation and limits

The Markdown template becomes available in the issue chooser after merge to the default branch. It suggests `needs-triage`; it does not validate every body, create dependencies, assign a milestone, or add project membership. Existing issues need an explicit update. Keep blank intake available so incomplete reports can be triaged without fabricated answers.

If repeated incomplete intake becomes a problem, evaluate an Issue Form with required fields. Forms support a `projects` setting, but the author needs write access to that project. A native project auto-add workflow is another option to evaluate with a narrow filter. Neither is required for this first template. Do not add a bot, Actions workflow, automatic approval, or automatic implementation trigger just to maintain this format.

References: [template activation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository), [native dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies), and [Issue Form capabilities and project permissions](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms).

## Verification handoff

Keep Agent Verification Plan and Human Verification Plan under one Verification section. Agent checks must be precise even when technical: action or existing procedure, expected observation, and evidence tied to the relevant revision/configuration. Record failed, blocked, and unrun checks honestly. Do not equate a plan with executed evidence or agent success with human acceptance.

Human plans are short numbered walkthroughs. Supply the starting state, a prepared safe sample, exact input or UI actions, and expected observations. Aim for one to three substantive steps without hiding essential setup. Provide the launch/restart commands or links at handoff rather than asking the reviewer to discover them. Where implementation details do not yet exist, explicitly mark them pending; the issue is not ready for a human verification handoff until they are supplied. Research walkthroughs point to the findings, the supporting observations, and the decision requested. Do not require humans to rerun the entire technical suite. If no human check applies, explain why without waiving an existing acceptance gate.
