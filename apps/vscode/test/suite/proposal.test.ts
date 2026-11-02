import { parseProposalOutput } from "../../../../packages/core/src/contracts.js";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { assertStorageOutsideRepository } from "../../src/storage-boundary.js";

const completeDraft = {
  tasks: [
    {
      key: "pricing-page",
      title: "Add the pricing page",
      requirements: [
        { key: "pricing-content", text: "Show the available plans." },
      ],
      proposedScope: {
        included: ["src/pages/pricing.tsx"],
        excluded: ["src/billing/**"],
      },
      checks: [
        {
          key: "pricing-visible",
          requirementKeys: ["pricing-content"],
          description: "Confirm the page shows each available plan.",
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
};

suite("Goal interpreter proposal contract", () => {
  test("creates an explicitly incomplete deterministic draft without a provider", async () => {
    const proposal = await new GoalInterpreter().propose("Add a pricing page");
    const [task] = proposal.tasks;

    assert.equal(proposal.goal, "Add a pricing page");
    assert.equal(proposal.tasks.length, 1);
    assert.ok(task);
    assert.deepEqual(task.proposedScope.included, []);
    assert.match(task.title, /review/i);
    assert.equal(task.checks.length, 1);
  });
  test("creates a complete unapproved draft from a typed goal", async () => {
    const interpreter = ((goal: string) => Promise.resolve().then(() => parseProposalOutput(goal, completeDraft)));

    const proposal = await interpreter("Add a pricing page");

    assert.deepEqual(proposal, {
      goal: "Add a pricing page",
      source: "deterministic-draft",
      tasks: completeDraft.tasks,
    });
  });

  test("keeps the submitted goal authoritative", async () => {
    const interpreter = ((goal: string) => Promise.resolve().then(() => parseProposalOutput(goal, ({
      ...completeDraft,
      goal: "Replace the user's goal",
    }))));

    await assert.rejects(
      interpreter("Add a pricing page"),
      /Invalid interpreter output/,
    );
  });

  test("rejects authority supplied by the interpreter", async () => {
    const interpreter = ((goal: string) => Promise.resolve().then(() => parseProposalOutput(goal, ({
      ...completeDraft,
      approved: true,
    }))));

    await assert.rejects(
      interpreter("Add a pricing page"),
      /Invalid interpreter output/,
    );
  });

  test("rejects unknown and cyclic task dependencies", async () => {
    const unknownDependency = ((goal: string) => Promise.resolve().then(() => parseProposalOutput(goal, ({
      tasks: [
        { ...completeDraft.tasks[0], dependsOn: ["missing-task"] },
      ],
    }))));
    const cyclicDependency = ((goal: string) => Promise.resolve().then(() => parseProposalOutput(goal, ({
      tasks: [
        { ...completeDraft.tasks[0], dependsOn: ["second-task"] },
        {
          ...completeDraft.tasks[0],
          key: "second-task",
          dependsOn: ["pricing-page"],
        },
      ],
    }))));

    await assert.rejects(
      unknownDependency("Add a pricing page"),
      /Invalid interpreter output/,
    );
    await assert.rejects(
      cyclicDependency("Add a pricing page"),
      /Invalid interpreter output/,
    );
  });

  test("requires every requirement to have a manual check", async () => {
    const interpreter = ((goal: string) => Promise.resolve().then(() => parseProposalOutput(goal, ({
      tasks: [
        {
          ...completeDraft.tasks[0],
          checks: [
            {
              key: "pricing-visible",
              requirementKeys: [],
              description: "Confirm the page shows each available plan.",
            },
          ],
        },
      ],
    }))));

    await assert.rejects(
      interpreter("Add a pricing page"),
      /Invalid interpreter output/,
    );
  });
  test("rejects duplicate check keys", async () => {
    const interpreter = ((goal: string) => Promise.resolve().then(() => parseProposalOutput(goal, ({
      tasks: [
        {
          ...completeDraft.tasks[0],
          checks: [
            {
              key: "pricing-visible",
              requirementKeys: ["pricing-content"],
              description: "Confirm the page shows each available plan.",
            },
            {
              key: "pricing-visible",
              requirementKeys: ["pricing-content"],
              description: "Confirm the page shows each available plan.",
            },
          ],
        },
      ],
    }))));

    await assert.rejects(
      interpreter("Add a pricing page"),
      /Invalid interpreter output/,
    );
  });
  test("rejects storage nested inside the selected repository", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "piarre-boundary-"));
    try {
      const repositoryRoot = path.join(directory, "repository");
      await mkdir(repositoryRoot);

      await assert.rejects(
        assertStorageOutsideRepository({
          repositoryRoot,
          storagePath: path.join(repositoryRoot, ".vscode-data", "piarre"),
        }),
        /outside the selected repository/,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test("rejects storage symlinked into the selected repository", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "piarre-boundary-"));
    try {
      const repositoryRoot = path.join(directory, "repository");
      const userData = path.join(directory, "user-data");
      await mkdir(repositoryRoot);
      await mkdir(userData);
      await symlink(repositoryRoot, path.join(userData, "linked-storage"));

      await assert.rejects(
        assertStorageOutsideRepository({
          repositoryRoot,
          storagePath: path.join(userData, "linked-storage", "piarre"),
        }),
        /outside the selected repository/,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
