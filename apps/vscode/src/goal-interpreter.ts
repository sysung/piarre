import { parseProposalOutput } from "../../../packages/core/src/contracts.js";
import type { ProposalDraft } from "../../../packages/core/src/index.js";

const deterministicProvider = (goal: string) => ({
  tasks: [
    {
      key: "review-goal",
      title: "Review and refine the proposed goal",
      requirements: [{ key: "submitted-goal", text: goal }],
      proposedScope: { included: [], excluded: [] },
      checks: [
        {
          key: "goal-reviewed",
          requirementKeys: ["submitted-goal"],
          description: "Confirm the proposal matches the submitted goal.",
        },
      ],
      proposedBudget: {
        maxAttempts: 1,
        maxElapsedMinutes: 15,
        maxTokens: 20_000,
      },
      dependsOn: [],
    },
  ],
});

export class GoalInterpreter {
  propose(goal: string): Promise<ProposalDraft> {
    return Promise.resolve().then(() => parseProposalOutput(goal, deterministicProvider(goal)));
  }
}
