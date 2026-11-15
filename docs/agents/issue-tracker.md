# Issue tracker

Use `gh` to read, create, and update issues in `sysung/piarre`. Link each issue to the relevant OpenSpec spec or change and its verification section when available. If an issue conflicts with OpenSpec, surface the conflict before proceeding with work that depends on it. Record the resolution in OpenSpec and update the issue link.

## GitHub operations

- Create an issue with `gh issue create --repo sysung/piarre --title "..." --body "..."`.
- Read an issue and its discussion with `gh issue view <number> --repo sysung/piarre --json number,title,body,labels,comments`.
- List issues with `gh issue list --repo sysung/piarre` and the relevant state and label filters. Its default limit is 30. For a complete open queue, use `gh api --paginate "repos/sysung/piarre/issues?state=open&per_page=100" --jq '.[] | select(has("pull_request") | not) | {number, title, labels: [.labels[].name]}'`.
- Apply or remove a triage label with `gh issue edit <number> --repo sysung/piarre --add-label <label>` or `--remove-label <label>`.
- Record the reason with `gh issue comment <number> --repo sysung/piarre --body-file <path>` before closing an issue with `gh issue close <number> --repo sysung/piarre`. Use `--body-file` for multiline issue bodies and comments.

- **Make an issue a sub-issue of a parent**: `gh issue create --repo sysung/piarre --parent <parent> ...`, or `gh issue edit <parent> --repo sysung/piarre --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `gh api --method POST repos/sysung/piarre/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, as in **Blocking** below). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh issue create --repo sysung/piarre --blocked-by <n>,<n> ...` or `gh issue edit <child> --repo sysung/piarre --add-blocked-by <blocker>` (`gh` 2.94+). Older `gh`: `gh api --method POST repos/sysung/piarre/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/sysung/piarre/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
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
