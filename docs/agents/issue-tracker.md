# Issue tracker

Use `gh` to read, create, and update issues in `sysung/piarre`. Link each issue to the relevant OpenSpec spec or change and its verification section when available. If an issue conflicts with OpenSpec, surface the conflict before proceeding with work that depends on it. Record the resolution in OpenSpec and update the issue link.

## GitHub operations

- Create an issue with `gh issue create --repo sysung/piarre --title "..." --body "..."`.
- Read an issue and its discussion with `gh issue view <number> --repo sysung/piarre --json number,title,body,labels,comments`.
- List issues with `gh issue list --repo sysung/piarre` and the relevant state and label filters.
- Apply or remove a triage label with `gh issue edit <number> --repo sysung/piarre --add-label <label>` or `--remove-label <label>`.
- Record the reason with `gh issue comment` before closing an issue with `gh issue close`.

**PRs as a request surface: no.**
