import type {
  ProjectCommand,
  ProjectEvent,
  ProposalCheck,
  ProposalDraft,
  ProposalRequirement,
  ProposalTaskDraft,
  ProposedBudget,
  ProposedScope,
  ProposedTask,
} from "./index.js";

function invalid(): never {
  throw new Error("Invalid interpreter output");
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: object, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => allowed.has(key));
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

export function parseProposalOutput(goal: string, value: unknown): ProposalDraft {
  const canonicalGoal = nonblank(goal);
  if (!isObject(value) || !hasOnlyKeys(value, ["tasks"]) || !("tasks" in value))
    invalid();
  return {
    goal: canonicalGoal,
    source: "deterministic-draft",
    tasks: parseTasks(value.tasks),
  };
}

function assertProposalDraft(value: unknown): asserts value is ProposalDraft {
  if (!isObject(value) || !hasOnlyKeys(value, ["goal", "source", "tasks"]) ||
      !("goal" in value) || !("source" in value) || !("tasks" in value) ||
      value.source !== "deterministic-draft") invalid();
  nonblank(value.goal);
  parseTasks(value.tasks);
}

export function validateProjectCommand(value: unknown): ProjectCommand {
  if (!isObject(value) ||
      !hasOnlyKeys(value, ["commandId", "projectId", "expectedProjectRevision", "action"]) ||
      !("commandId" in value) || !("projectId" in value) ||
      !("expectedProjectRevision" in value) || !("action" in value) ||
      !isObject(value.action) || !("kind" in value.action))
    throw new Error("Invalid project command");
  const commandId = nonblank(value.commandId);
  const projectId = nonblank(value.projectId);
  const expectedProjectRevision = positiveInteger(value.expectedProjectRevision);
  const action = value.action;
  if (action.kind === "rename-project" && hasOnlyKeys(action, ["kind", "name"]) && "name" in action) {
    const name = nonblank(action.name);
    if (name.length > 200) throw new Error("Invalid project command");
    return { commandId, projectId, expectedProjectRevision, action: { kind: action.kind, name } };
  }
  if (action.kind === "propose-tasks" && hasOnlyKeys(action, ["kind", "draft"]) && "draft" in action) {
    assertProposalDraft(action.draft);
    // Existing receipts fingerprint the valid draft's original property order.
    return { commandId, projectId, expectedProjectRevision, action: { kind: action.kind, draft: action.draft } };
  }
  throw new Error("Unsupported or invalid project action");
}

function storedTask(value: unknown): ProposedTask {
  if (!isObject(value) ||
      !hasOnlyKeys(value, ["taskId", "groupId", "planVersion", "state", "title", "requirements", "proposedScope", "checks", "proposedBudget", "dependsOn"]) ||
      !("taskId" in value) || !("groupId" in value) || !("planVersion" in value) ||
      !("state" in value) || !("title" in value) || !("requirements" in value) ||
      !("proposedScope" in value) || !("checks" in value) ||
      !("proposedBudget" in value) || !("dependsOn" in value) ||
      value.planVersion !== 1 || !isObject(value.state) ||
      !hasOnlyKeys(value.state, ["kind"]) || !("kind" in value.state) || value.state.kind !== "unapproved") invalid();
  const draft = parseTask({ key: value.taskId, title: value.title, requirements: value.requirements,
    proposedScope: value.proposedScope, checks: value.checks,
    proposedBudget: value.proposedBudget, dependsOn: value.dependsOn });
  return { taskId: draft.key, groupId: nonblank(value.groupId), planVersion: 1,
    state: { kind: "unapproved" }, title: draft.title, requirements: draft.requirements,
    proposedScope: draft.proposedScope, checks: draft.checks,
    proposedBudget: draft.proposedBudget, dependsOn: draft.dependsOn };
}

export function parseProjectEvent(value: unknown): ProjectEvent {
  if (!isObject(value) || !("kind" in value)) invalid();
  if (value.kind === "project-created" && hasOnlyKeys(value, ["kind", "projectId", "repositoryUri", "name"]) &&
      "projectId" in value && "repositoryUri" in value && "name" in value)
    return { kind: value.kind, projectId: nonblank(value.projectId),
      repositoryUri: nonblank(value.repositoryUri), name: nonblank(value.name) };
  if (value.kind === "project-renamed" && hasOnlyKeys(value, ["kind", "name"]) && "name" in value)
    return { kind: value.kind, name: nonblank(value.name) };
  if (value.kind !== "proposal-created" || !hasOnlyKeys(value, ["kind", "group", "tasks"]) ||
      !("group" in value) || !("tasks" in value) || !isObject(value.group) || !Array.isArray(value.tasks)) invalid();
  const group = value.group;
  if (!hasOnlyKeys(group, ["groupId", "goal", "source", "taskIds"]) ||
      !("groupId" in group) || !("goal" in group) || !("source" in group) || !("taskIds" in group) ||
      group.source !== "deterministic-draft") invalid();
  const tasks = value.tasks.map(storedTask);
  parseTasks(tasks.map((task) => ({ key: task.taskId, title: task.title,
    requirements: task.requirements, proposedScope: task.proposedScope,
    checks: task.checks, proposedBudget: task.proposedBudget, dependsOn: task.dependsOn })));
  const taskIds = stringList(group.taskIds);
  const groupId = nonblank(group.groupId);
  const membership = new Set(taskIds);
  if (membership.size !== taskIds.length || taskIds.length !== tasks.length ||
      tasks.some((task) => task.groupId !== groupId || !membership.has(task.taskId))) invalid();
  return { kind: "proposal-created", group: { groupId, goal: nonblank(group.goal),
    source: group.source, taskIds }, tasks };
}
