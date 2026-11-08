# Manual resumption baseline

This is the first, manual gate of the approved prototype plan. It is a source-backed rehearsal pack, not a passing user study. User effort and comfort have not been measured. Do not fill them in from agent timings.

## Five actual project decisions

| ID | Current intent | Source and status |
| --- | --- | --- |
| goal | Reduce repeated explanation, reading and verification while preserving control. | Product requirements, Purpose and audience; user-approved prototype plan. |
| focus | Pause local-model optimization and test resuming after a decision changes. | User's current planning request and approved plan. Supersedes the earlier open-ended Qwen optimization direction for this slice. |
| documents | Inspect and edit ordinary repository Markdown. | User selected Repository documents in the planning questions. |
| adoption | A saved or committed edit is proposed intent until explicitly reviewed. Adoption does not approve coding execution. | User selected After explicit review; technical design Ownership and data retains operational authority in runtime events. |
| pilot | Test on Piarre for the owner first. Aim for less effort with the same trust and cap participation around 120 minutes. | User selected You first, Testable prototype, Less effort same trust, About two hours; approved plan. |

The conversation choices above have no exported public permalink. They are explicitly attributed to the current conversation, not presented as independently fetched external evidence. Repository requirements are intent, not proof that the implementation already behaves accordingly.

## Rehearsal

Start a fresh session of the existing coding agent and provide only this pack and the repository documents it references. Ask:

> We are returning to Piarre after changing direction. What is the current goal, what earlier direction was superseded, what work is paused, what would require my review, and what should we do next? Show your sources. What do we still not know?

Expected: identify all five decisions; distinguish pending edits from accepted direction; keep coding approval separate; propose the manual trial and smallest review/handoff gap. Do not invent customer demand, completed interviews, lower fatigue, or everyday readiness. Do not resume the Qwen benchmark or keyword rollout.

Then introduce a clearly labeled pending proposal to restart model tuning. The agent must not treat that proposal as accepted. Include an unrelated task: correcting one document must not imply all work is stale.

## Record the human result before claiming value

Budget 20 minutes including preparation, reading, correction and updates. Record active minutes by category and any repeated explanations or missing constraints. If this ordinary Markdown workflow meets the owner's needs comfortably, stop application work. Otherwise record the specific missing behavior.

Observed engineering gaps to investigate, not evidence of user benefit: the existing application has no Markdown adoption reader; no exact-version document receipt; no portable resumption handoff. Plain Markdown can describe review status but cannot by itself enforce Piarre's adoption boundary. The isolated prototype may test these gaps; its utility remains unproven until the manual result is recorded.

## Pilot worksheet

Use two matched, distinct exercises in each workflow: plain Git Markdown plus the existing agent, OpenSpec plus the same agent, and Piarre plus that agent. Rotate order. Give each workflow equivalent facts. Count setup and record maintenance, not only answer reading. Stop at the approved overall 120-minute participation budget.

| Workflow / exercise | Setup | Update | Read | Review | Correct | Total active minutes | Missed constraints / unsupported claims | Preference |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Manual baseline | pending | pending | pending | pending | pending | pending | pending | pending |
| Markdown exercise A | pending | pending | pending | pending | pending | pending | pending | pending |
| OpenSpec exercise A | pending | pending | pending | pending | pending | pending | pending | pending |
| Piarre exercise A | pending | pending | pending | pending | pending | pending | pending | pending |
| Piarre exercise B | pending | pending | pending | pending | pending | pending | pending | pending |
| OpenSpec exercise B | pending | pending | pending | pending | pending | pending | pending | pending |
| Markdown exercise B | pending | pending | pending | pending | pending | pending | pending | pending |
| Real resumption 1 | pending | pending | pending | pending | pending | pending | pending | pending |
| Real resumption 2 | pending | pending | pending | pending | pending | pending | pending | pending |
| Real resumption 3 | pending | pending | pending | pending | pending | pending | pending | pending |

Follow with three genuine resumptions within one week. Continue only if total effort falls without consequential lost constraints and the owner prefers the prototype in at least two real resumptions. Narrow to a handoff helper if that is the only useful part. Stop or use an existing approach if it is easier. Incomplete or conflicting evidence stays inconclusive; do not extend the experiment automatically.
