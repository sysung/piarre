# Plan v0.2 architecture rationale

## Synthesis decision

The plan uses an evidence-gated vertical slice. Candidate B supplied the 23-story B00 through B22 graph and the B15 release boundary. Candidate A supplied optimistic project revisions, capability-driven worker observation, explicit evidence outcomes, separate speech and work cancellation, and milestone re-estimation.

The chosen shape makes a durable typed supervision loop work before voice and makes voice use the same proposal boundary. It proves one supervised writer before it introduces read-only concurrency, isolated writers, scheduling, or integration.

## Core ownership

- The event-backed project aggregate owns plans, tasks, approvals, budgets, and evidence freshness.
- The runtime is the only component that appends domain events.
- Worker adapters own external execution attempts and report observed capabilities.
- Workspace adapters own disk, diff, preview, and approved-command observations.
- Models emit untrusted proposals. They do not authorize actions or accept evidence.

## Rejected shapes

- A layer-first platform delayed the first observable supervision loop.
- A voice-first demo emphasized the part most similar to existing voice chat before proving Piarre's control-plane difference.
- A multi-agent-first scheduler multiplied recovery and integration risk before one writer was trustworthy.
- The A00 package layout was an experiment and was not promoted into product architecture.

## Verification

The reviewed backlog has unique IDs, known dependencies, an acyclic graph, issue evidence fields, consistent estimate totals, and a B15 dependency for every P1 story. GitHub publication must independently read back issue markers, project fields, and native dependency edges before A-series retirement.
