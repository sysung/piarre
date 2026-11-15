# Issue tracker

Use `gh` to read, create, and update issues in `sysung/piarre`. Link each issue to the relevant OpenSpec spec or change and its verification section when available. If an issue conflicts with OpenSpec, surface the conflict before proceeding with work that depends on it. Record the resolution in OpenSpec and update the issue link.

## GitHub operations

- Create an issue with `gh issue create --repo sysung/piarre --title "..." --body "..."`.
- Read an issue and its discussion with `gh issue view <number> --repo sysung/piarre --json number,title,body,labels,comments`.
- List issues with `gh issue list --repo sysung/piarre` and the relevant state and label filters.
- Apply or remove a triage label with `gh issue edit <number> --repo sysung/piarre --add-label <label>` or `--remove-label <label>`.
- Record the reason with `gh issue comment` before closing an issue with `gh issue close`.

- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `gh api --method POST repos/sysung/piarre/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, as in **Blocking** below). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh issue create --blocked-by <n>,<n> ...` or `gh issue edit <child> --add-blocked-by <blocker>` (`gh` 2.94+). Older `gh`: `gh api --method POST repos/sysung/piarre/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/sysung/piarre/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Count open blockers**: `gh api repos/sysung/piarre/issues/<n> --jq .issue_dependencies_summary.blocked_by` (open blockers only; 0 means startable). `gh issue view <n> --json blockedBy` also lists closed blockers, so filter it: `--jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'`.
- **Blocking**: see **Blocking** under Conventions.

**PRs as a request surface: no.**

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: see **Blocking** under GitHub operations.
- **Frontier query**: list the map's open children using `gh api --paginate repos/sysung/piarre/issues/<map>/sub_issues` or the map's task list, drop any with an open blocker (see **Count open blockers**, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a short summary and link to the map's Decisions-so-far. Record product requirements and design decisions in the relevant OpenSpec artifact and link to it from the map.
