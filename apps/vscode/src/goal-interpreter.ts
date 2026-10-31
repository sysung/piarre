import type {
  ProposalCheck,
  ProposalDraft,
  ProposalRequirement,
  ProposalTaskDraft,
  ProposedBudget,
  ProposedScope,
} from "../../../packages/core/src/index.js";

type RawProvider = (goal: string) => unknown;

const deterministicProvider: RawProvider = (goal) => ({
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

function invalid(): never {
  throw new Error("Invalid interpreter output");
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: object, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function nonblank(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) invalid();
  return value;
}

function stringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) invalid();
  return value.map(nonblank);
}

function positiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value < 1)
    invalid();
  return value;
}

function parseRequirement(value: unknown): ProposalRequirement {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["key", "text"]) ||
    !("key" in value) ||
    !("text" in value)
  )
    invalid();
  return { key: nonblank(value.key), text: nonblank(value.text) };
}

function parseCheck(value: unknown): ProposalCheck {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["key", "requirementKeys", "description"]) ||
    !("key" in value) ||
    !("requirementKeys" in value) ||
    !("description" in value)
  )
    invalid();
  return {
    key: nonblank(value.key),
    requirementKeys: stringList(value.requirementKeys),
    description: nonblank(value.description),
  };
}

function parseScope(value: unknown): ProposedScope {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["included", "excluded"]) ||
    !("included" in value) ||
    !("excluded" in value)
  )
    invalid();
  return {
    included: stringList(value.included),
    excluded: stringList(value.excluded),
  };
}

function parseBudget(value: unknown): ProposedBudget {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["maxAttempts", "maxElapsedMinutes", "maxTokens"]) ||
    !("maxAttempts" in value) ||
    !("maxElapsedMinutes" in value) ||
    !("maxTokens" in value)
  )
    invalid();
  return {
    maxAttempts: positiveInteger(value.maxAttempts),
    maxElapsedMinutes: positiveInteger(value.maxElapsedMinutes),
    maxTokens: positiveInteger(value.maxTokens),
  };
}

function parseTask(value: unknown): ProposalTaskDraft {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, [
      "key",
      "title",
      "requirements",
      "proposedScope",
      "checks",
      "proposedBudget",
      "dependsOn",
    ]) ||
    !("key" in value) ||
    !("title" in value) ||
    !("requirements" in value) ||
    !("proposedScope" in value) ||
    !("checks" in value) ||
    !("proposedBudget" in value) ||
    !("dependsOn" in value) ||
    !Array.isArray(value.requirements) ||
    !Array.isArray(value.checks)
  )
    invalid();
  const requirements = value.requirements.map(parseRequirement);
  const checks = value.checks.map(parseCheck);
  if (requirements.length === 0 || checks.length === 0) invalid();
  const requirementKeys = new Set(requirements.map(({ key }) => key));
  if (requirementKeys.size !== requirements.length) invalid();
  const checkKeys = new Set(checks.map(({ key }) => key));
  if (checkKeys.size !== checks.length) invalid();
  const covered = new Set<string>();
  for (const check of checks) {
    if (check.requirementKeys.length === 0) invalid();
    for (const key of check.requirementKeys) {
      if (!requirementKeys.has(key)) invalid();
      covered.add(key);
    }
  }
  if (covered.size !== requirementKeys.size) invalid();
  return {
    key: nonblank(value.key),
    title: nonblank(value.title),
    requirements,
    proposedScope: parseScope(value.proposedScope),
    checks,
    proposedBudget: parseBudget(value.proposedBudget),
    dependsOn: stringList(value.dependsOn),
  };
}

function parseTasks(value: unknown): readonly ProposalTaskDraft[] {
  if (!Array.isArray(value) || value.length === 0) invalid();
  const tasks = value.map(parseTask);
  const taskKeys = new Set(tasks.map(({ key }) => key));
  if (taskKeys.size !== tasks.length) invalid();
  for (const task of tasks)
    for (const dependency of task.dependsOn)
      if (!taskKeys.has(dependency) || dependency === task.key) invalid();

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byKey = new Map(tasks.map((task) => [task.key, task]));
  const visit = (key: string): void => {
    if (visiting.has(key)) invalid();
    if (visited.has(key)) return;
    visiting.add(key);
    const task = byKey.get(key);
    if (!task) invalid();
    for (const dependency of task.dependsOn) visit(dependency);
    visiting.delete(key);
    visited.add(key);
  };
  for (const task of tasks) visit(task.key);
  return tasks;
}

export class GoalInterpreter {
  constructor(private readonly rawProvider: RawProvider = deterministicProvider) {}

  async propose(goal: string): Promise<ProposalDraft> {
    const canonicalGoal = nonblank(goal);
    const value = await this.rawProvider(canonicalGoal);
    if (
      !isObject(value) ||
      !hasOnlyKeys(value, ["tasks"]) ||
      !("tasks" in value)
    )
      invalid();
    return {
      goal: canonicalGoal,
      source: "deterministic-draft",
      tasks: parseTasks(value.tasks),
    };
  }
}
