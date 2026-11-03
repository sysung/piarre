import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { CoordinationAction } from "../../../../packages/core/src/index.js";
import { CoordinationController } from "../../src/coordination-controller.js";
import { parseCoordinationMessage } from "../../src/coordination-actions.js";
import { renderCoordination } from "../../src/coordination-view.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { CodexConversationClient } from "../../src/codex-conversation-client.js";

type Client = Pick<CodexConversationClient, "connect" | "respond" | "interrupt" | "dispose">;
type Reply = Awaited<ReturnType<Client["respond"]>>;
class FixtureClient implements Client {
  request?: Parameters<Client["respond"]>[0];
  resolve?: (reply: Reply) => void;
  reject?: (error: Error) => void;
  interruptions = 0;
  disposals = 0;
  constructor(readonly id: string) {}
  connect(): ReturnType<Client["connect"]> { return Promise.resolve({ kind: "ready", authType: "unknown" }); }
  respond(input: Parameters<Client["respond"]>[0]): Promise<Reply> {
    this.request = input;
    input.onThreadMetadata?.({ model: "fixture-model", modelProvider: "fixture-provider" });
    input.onServiceTier?.("thread-priority-observed");
    input.onThreadStarted?.(`thread-${this.id}`); input.onTurnStarted?.(`thread-${this.id}`, `turn-${this.id}`);
    return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
  }
  complete(summary = "First sourced finding", sourceIndexes = [0]): void { this.resolve?.({ threadId: `thread-${this.id}`, turnId: `turn-${this.id}`, status: "completed", output: { summary, sourceIndexes } }); }
  interrupt(): Promise<void> { this.interruptions++; this.resolve?.({ threadId: `thread-${this.id}`, turnId: `turn-${this.id}`, status: "interrupted", output: null }); return Promise.resolve(); }
  dispose(): void { this.disposals++; this.reject?.(new Error("Fixture disconnected")); }
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
suite("Canonical bounded read-only coordination", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  let controller: CoordinationController;
  let clients: FixtureClient[];
  let taskId: string;
  let dbPath: string;
  const createClient = () => { const client = new FixtureClient(String(clients.length)); clients.push(client); return client; };
  const readGroup = () => { const group = repository.read().coordination.groups[0]; assert.ok(group); return group; };
  const prepare = (workers = 2, requestId = "message-from-work-view") => controller.prepare({ requestId, parentTaskId: taskId, purpose: "Investigate refund requirement", scope: "Only supplied project records", model: "fixture-model", workers, durationMs: 120_000, maxTokens: 4_000 });
  const record = (action: CoordinationAction, commandId = `test-${String(repository.read().revision)}`) => {
    const snapshot = repository.read();
    return repository.dispatch({ commandId, projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision, action });
  };
  setup(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-coordination-")); dbPath = path.join(directory, "project.sqlite");
    repository = new SqliteProjectRepository(dbPath);
    const snapshot = repository.open({ repositoryUri: pathToFileURL(directory).href, name: "Coordination fixture" });
    const draft = await new GoalInterpreter().propose("Set the refund window to 45 days");
    repository.dispatch({ commandId: "parent-fixture", projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision, action: { kind: "propose-tasks", draft } });
    const task = repository.read().tasks[0]; assert.ok(task); taskId = task.taskId;
    clients = []; controller = new CoordinationController(repository, () => undefined, createClient);
  });
  teardown(() => { controller.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true }); });
  test("captures and returns a linked idea durably without calls or parent mutation", () => {
    const before = repository.read();
    const idea = { requestId: "idea-message", parentTaskId: taskId, text: "Consider calendar support <untrusted>", returnPoint: "Review criterion 1 on refund task" };
    controller.captureIdea(idea); controller.captureIdea(idea);
    assert.equal(repository.read().coordination.ideas.length, 1); assert.equal(clients.length, 0);
    assert.throws(() => { controller.captureIdea({ ...idea, text: "conflicting duplicate" }); }, /Conflicting/);
    controller.dispose(); repository.close(); repository = new SqliteProjectRepository(dbPath);
    repository.open({ repositoryUri: pathToFileURL(directory).href, name: "Coordination fixture" });
    controller = new CoordinationController(repository, () => undefined, createClient);
    assert.equal(repository.read().coordination.ideas[0]?.returnPoint, idea.returnPoint);
    controller.returnIdea(idea.requestId);
    assert.ok(repository.read().coordination.ideas[0]?.returnedAt);
    assert.deepEqual(repository.read().tasks, before.tasks); assert.deepEqual(repository.read().executionRuns, []);
    assert.equal(clients.length, 0);
  });
  test("bounds fanout and requires exact explicit batch consent; prepared work makes zero calls", () => {
    assert.throws(() => prepare(0), /1–3/); assert.throws(() => prepare(4), /1–3/);
    const group = prepare(); assert.equal(clients.length, 0);
    assert.equal(prepare().groupId, group.groupId);
    assert.throws(() => controller.prepare({ requestId: group.requestId, parentTaskId: taskId, purpose: "changed", scope: "Only supplied project records", model: "fixture-model", workers: 2, durationMs: 120_000, maxTokens: 4_000 }), /Conflicting/);
    assert.throws(() => record({ kind: "coordinate", operation: "start", groupId: group.groupId, assignmentId: group.assignments[0]?.assignmentId ?? "", observedAt: Date.now() }), /unapproved/);
    const before = repository.read();
    assert.throws(() => repository.dispatch({ commandId: "forged", projectId: before.projectId, expectedProjectRevision: before.revision, action: { kind: "coordinate", operation: "approve", groupId: group.groupId, preparedAtRevision: group.preparedAtRevision, approvalId: "forged", observedAt: Date.now(), consent: "included-only" } }), /approval/);
    assert.deepEqual(repository.read(), before); assert.equal(clients.length, 0);
  });
  test("causal message→assignment→independent worker→sourced evidence, steering and targeted stop", async () => {
    const before = repository.read(); const group = prepare(); const first = group.assignments[0]; const second = group.assignments[1]; assert.ok(first); assert.ok(second);
    controller.steer(group.groupId, first.assignmentId, "steering-message", "Check the exact 45-day source");
    assert.throws(() => record({ kind: "coordinate", operation: "approve", groupId: group.groupId, preparedAtRevision: group.preparedAtRevision, approvalId: "stale", observedAt: Date.now(), consent: "unknown-cost-and-shared-context" }), /stale/);
    const current = readGroup();
    const operation = controller.approveAndRun(group.groupId, current.preparedAtRevision, "explicit-native-batch-approval");
    await tick(); assert.equal(clients.length, 2);
    const one = clients[0]; const two = clients[1]; assert.ok(one); assert.ok(two); assert.ok(one.request); assert.ok(two.request);
    assert.equal(one.request.serviceTierForTurn, "default"); assert.equal(one.request.model, first.requestedModel);
    assert.ok(one.request.prompt.includes(group.requestId)); assert.ok(one.request.prompt.includes(first.assignmentId)); assert.ok(one.request.prompt.includes("steering-message"));
    assert.equal(two.request.prompt.includes("steering-message"), false, "An instruction to one worker is not broadcast");
    assert.equal(one.request.prompt.includes("unsent-secret"), false);
    const started = readGroup().assignments[0]; assert.ok(started); assert.equal(started.state.kind, "active");
    assert.deepEqual(started.state.deliveredMessageIds, ["steering-message"]);
    await controller.stop(group.groupId, second.assignmentId);
    one.complete("Observed 45-day proposal", [0]); await operation;
    assert.equal(one.interruptions, 0); assert.equal(two.interruptions, 1);
    const completed = readGroup(); assert.equal(completed.assignments[0]?.state.kind, "terminal");
    assert.equal(completed.assignments[1]?.state.kind, "terminal");
    const html = renderCoordination(repository.read());
    assert.ok(html.includes("thread-0 / turn-0")); assert.ok(html.includes("interrupted")); assert.ok(html.includes("per-turn tier observation unavailable"));
    assert.deepEqual(repository.read().tasks, before.tasks); assert.deepEqual(repository.read().executionPlans, before.executionPlans);
    assert.deepEqual(repository.read().executionRuns, before.executionRuns);
  });
  test("keeps conflicting findings, failures and resource uncertainty visible without synthesis calls", async () => {
    const group = prepare(3); const operation = controller.approveAndRun(group.groupId, group.preparedAtRevision, "explicit"); await tick();
    clients[0]?.complete("Requirement permits 45 days"); clients[1]?.complete("Requirement may conflict with 30 days"); clients[2]?.dispose(); await operation;
    assert.equal(clients.length, 3);
    const html = renderCoordination(repository.read()); assert.ok(html.includes("Different reported conclusions")); assert.ok(html.includes("unknown"));
    assert.ok(html.includes("Requirement permits 45 days")); assert.ok(html.includes("Requirement may conflict")); assert.ok(html.includes("Agreement does not prove correctness"));
    controller.compare(group.groupId, "disagreement", "The two sourced findings report incompatible refund windows; review original sources.");
    assert.ok(renderCoordination(repository.read()).includes("User assessment: disagreement"));
    const before = repository.read(); controller.dispose(); repository.close(); repository = new SqliteProjectRepository(dbPath);
    repository.open({ repositoryUri: pathToFileURL(directory).href, name: "Coordination fixture" }); controller = new CoordinationController(repository, () => undefined, createClient);
    assert.deepEqual(repository.read(), before); assert.equal(clients.length, 3);
  });
  test("restart marks active requests unknown and never retries approved queued or active assignments", async () => {
    const group = prepare();
    record({ kind: "coordinate", operation: "approve", groupId: group.groupId, preparedAtRevision: group.preparedAtRevision, approvalId: "explicit", observedAt: Date.now(), consent: "unknown-cost-and-shared-context" });
    const worker = group.assignments[0]; assert.ok(worker);
    record({ kind: "coordinate", operation: "start", groupId: group.groupId, assignmentId: worker.assignmentId, observedAt: Date.now() });
    controller.dispose(); repository.close(); repository = new SqliteProjectRepository(dbPath);
    repository.open({ repositoryUri: pathToFileURL(directory).href, name: "Coordination fixture" }); controller = new CoordinationController(repository, () => undefined, createClient);
    assert.equal(readGroup().assignments[0]?.state.kind, "terminal"); assert.equal(readGroup().assignments[1]?.state.kind, "queued"); assert.equal(clients.length, 0);
    await assert.rejects(controller.approveAndRun(group.groupId, group.preparedAtRevision, "replay"), /stale|unconfirmed/);
    assert.equal(clients.length, 0);
  });
  test("rejects unavailable citations and leaves unknown instead of laundering findings", async () => {
    const group = prepare(1); const operation = controller.approveAndRun(group.groupId, group.preparedAtRevision, "explicit"); await tick(); clients[0]?.complete("Invented claim", [99]); await operation;
    const state = readGroup().assignments[0]?.state; assert.equal(state?.kind, "terminal"); assert.equal(state.outcome, "unknown"); assert.deepEqual(state.sourceIndexes, []);
    assert.equal(renderCoordination(repository.read()).includes("Invented claim"), false);
  });
  test("canonical scheduling pause blocks coordination while local capture still works", async () => {
    const group = prepare(1); const snapshot = repository.read();
    repository.dispatch({ commandId: "pause", projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision, action: { kind: "set-scheduling-paused", paused: true } });
    await assert.rejects(controller.approveAndRun(group.groupId, group.preparedAtRevision, "blocked"), /paused/);
    controller.captureIdea({ requestId: "offline-idea", parentTaskId: taskId, text: "Keep this intent", returnPoint: "Review this parent" });
    assert.equal(clients.length, 0); assert.equal(repository.read().coordination.ideas.length, 1);
  });
  test("canonical command receipts are idempotent and reject changed payload", () => {
    const snapshot = repository.read();
    const command = { commandId: "idempotent-idea", projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision, action: { kind: "coordinate", operation: "capture-idea", ideaId: "idempotent", parentTaskId: taskId, text: "A local idea", returnPoint: "Parent criterion" } };
    assert.equal(repository.dispatch(command).kind, "applied"); assert.equal(repository.dispatch(command).kind, "duplicate");
    assert.equal(repository.dispatch({ ...command, action: { ...command.action, text: "different" } }).kind, "command-conflict");
    assert.equal(repository.read().coordination.ideas.length, 1);
  });

  test("hard local deadline records unknown, disposes only its client and requires explicit review before new spending", async function () {
    this.timeout(5_000);
    const group = controller.prepare({ requestId: "deadline-message", parentTaskId: taskId, purpose: "Bound elapsed work", scope: "Supplied sources", model: "fixture-model", workers: 1, durationMs: 1_000, maxTokens: 100 });
    await controller.approveAndRun(group.groupId, group.preparedAtRevision, "deadline-explicit");
    const worker = readGroup().assignments[0]; assert.ok(worker); assert.equal(worker.state.kind, "terminal"); assert.equal(worker.state.outcome, "unknown");
    assert.equal(clients[0]?.disposals, 2);
    const next = prepare(1, "next-after-unknown");
    await assert.rejects(controller.approveAndRun(next.groupId, next.preparedAtRevision, "denied-pending-review"), /unconfirmed/);
    assert.equal(clients.length, 1);
    controller.reviewUnknown(group.groupId, worker.assignmentId);
    assert.ok(renderCoordination(repository.read()).includes("completion and usage remain unknown"));
    const operation = controller.approveAndRun(next.groupId, next.preparedAtRevision, "new-explicit-after-review"); await tick();
    clients[1]?.complete(); await operation;
    assert.equal(clients.length, 2);
  });
  test("linked idea investigation findings and pending decision survive return and restart", async () => {
    controller.captureIdea({ requestId: "linked-child", parentTaskId: taskId, text: "Investigate the exception", returnPoint: "Resume criterion review" });
    const group = controller.prepare({ ideaId: "linked-child", requestId: "idea-assignment-message", parentTaskId: taskId, purpose: "Investigate the exception", scope: "Supplied records", model: "fixture-model", workers: 1, durationMs: 120_000, maxTokens: 100 });
    assert.equal(group.ideaId, "linked-child"); assert.ok(renderCoordination(repository.read()).includes("batch approval pending"));
    const operation = controller.approveAndRun(group.groupId, group.preparedAtRevision, "idea-batch-explicit"); await tick();
    assert.ok(clients[0]?.request?.prompt.includes("Resume criterion review")); clients[0]?.complete("Linked child finding"); await operation;
    controller.returnIdea("linked-child"); controller.dispose(); const before = repository.read(); repository.close(); repository = new SqliteProjectRepository(dbPath);
    repository.open({ repositoryUri: pathToFileURL(directory).href, name: "Coordination fixture" }); controller = new CoordinationController(repository, () => undefined, createClient);
    assert.deepEqual(repository.read(), before); const html = renderCoordination(repository.read()); assert.ok(html.includes("Linked child finding")); assert.ok(html.includes("Resume criterion review"));
  });
  test("global fanout limit rejects another batch before any extra provider call", async () => {
    const group = prepare(3); const operation = controller.approveAndRun(group.groupId, group.preparedAtRevision, "batch-one"); await tick();
    const next = prepare(1, "second-batch"); await assert.rejects(controller.approveAndRun(next.groupId, next.preparedAtRevision, "batch-two"), /fanout/);
    assert.equal(clients.length, 3); for (const client of clients) client.complete(); await operation;
  });
  test("deleted parent invalidates previously prepared approval without mutating history", async () => {
    const group = prepare(1); const snapshot = repository.read(); const task = snapshot.tasks.find(task => task.taskId === taskId); assert.ok(task);
    repository.dispatch({ commandId: "remove-parent", projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision, action: { kind: "delete-proposal", groupId: task.groupId } });
    await assert.rejects(controller.approveAndRun(group.groupId, group.preparedAtRevision, "stale-parent"), /Parent/);
    assert.equal(clients.length, 0); assert.equal(readGroup().parentTaskId, taskId);
  });
  test("real fake-process readOnly protocol binds sessions and exact per-turn standard wire key", async () => {
    controller.dispose();
    controller = new CoordinationController(repository, () => undefined, () => new CodexConversationClient({ command: process.env.PIARRE_TEST_NODE ?? process.execPath, args: [path.resolve(__dirname, "../../test/fixtures/fake-codex-conversation.mjs"), "standard-tier"] }));
    const group = prepare(1); const assignment = group.assignments[0]; assert.ok(assignment);
    controller.steer(group.groupId, assignment.assignmentId, "protocol-steering", "Use exact sources");
    await controller.approveAndRun(group.groupId, readGroup().preparedAtRevision, "fixture-protocol-consent");
    const worker = readGroup().assignments[0]; assert.ok(worker); assert.equal(worker.state.kind, "terminal"); assert.equal(worker.state.outcome, "completed");
    assert.deepEqual(worker.state.session, { kind: "turn", threadId: "thread-1", turnId: "turn-1" });
    assert.equal(worker.state.observation, "Safe answer"); assert.equal(worker.providerObservation.serviceTier, null);
    assert.deepEqual(worker.state.deliveredMessageIds, ["protocol-steering"]);
  });
  test("provider-observed failure remains failed rather than completion or dropped worker", async () => {
    controller.dispose();
    controller = new CoordinationController(repository, () => undefined, () => new CodexConversationClient({ command: process.env.PIARRE_TEST_NODE ?? process.execPath, args: [path.resolve(__dirname, "../../test/fixtures/fake-codex-conversation.mjs"), "failed"] }));
    const group = prepare(1); await controller.approveAndRun(group.groupId, group.preparedAtRevision, "failure-fixture-consent");
    const state = readGroup().assignments[0]?.state; assert.equal(state?.kind, "terminal"); assert.equal(state.outcome, "failed"); assert.deepEqual(state.sourceIndexes, []);
    assert.ok(renderCoordination(repository.read()).includes("Provider reported failure"));
  });
  test("last pre-turn callback blocks corrected parent after capability checks and preserves observed thread", async () => {
    controller.dispose(); let turns = 0;
    controller = new CoordinationController(repository, () => undefined, () => ({
      connect: () => Promise.resolve({ kind: "ready", authType: "unknown" }),
      respond: input => {
        const snapshot = repository.read(); const task = snapshot.tasks.find(task => task.taskId === taskId); assert.ok(task);
        repository.dispatch({ commandId: "changed-during-capability", projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision, action: { kind: "delete-proposal", groupId: task.groupId } });
        input.onThreadStarted?.("thread-created-before-source-correction");
        turns++;
        return Promise.resolve({ status: "completed", threadId: "forbidden-thread", turnId: "forbidden-turn", output: { summary: "Should never be requested", sourceIndexes: [0] } });
      }, interrupt: () => Promise.resolve(), dispose: () => undefined,
    }));
    const group = prepare(1); const assignment = group.assignments[0]; assert.ok(assignment);
    controller.steer(group.groupId, assignment.assignmentId, "blocked-steering", "Use corrected parent");
    await controller.approveAndRun(group.groupId, readGroup().preparedAtRevision, "pre-turn-explicit");
    assert.equal(turns, 0); const state = readGroup().assignments[0]?.state; assert.equal(state?.kind, "terminal"); assert.equal(state.outcome, "unknown");
    assert.deepEqual(state.session, { kind: "thread", threadId: "thread-created-before-source-correction" });
    assert.deepEqual(state.deliveredMessageIds, []);
  });
  test("failed login retains queued steering without claiming outbound delivery", async () => {
    controller.dispose(); let outbound = 0;
    controller = new CoordinationController(repository, () => undefined, () => ({
      connect: () => Promise.resolve({ kind: "login-required" }),
      respond: () => { outbound++; return Promise.reject(new Error("No outbound permitted")); },
      interrupt: () => Promise.resolve(), dispose: () => undefined,
    }));
    const group = prepare(1); const worker = group.assignments[0]; assert.ok(worker);
    controller.steer(group.groupId, worker.assignmentId, "login-steer", "Check uncertainty");
    await controller.approveAndRun(group.groupId, readGroup().preparedAtRevision, "login-approval");
    assert.equal(outbound, 0);
    const state = readGroup().assignments[0]?.state; assert.ok(state?.kind === "terminal");
    assert.equal(state.outcome, "failed"); assert.deepEqual(state.deliveredMessageIds, []);
    assert.equal(renderCoordination(repository.read()).includes("Delivered to this request: login-steer"), false);
  });
  test("completion remains historical while parent freshness updates during and after work", async () => {
    const group = prepare(1); const operation = controller.approveAndRun(group.groupId, group.preparedAtRevision, "freshness-approval");
    await tick();
    const snapshot = repository.read(); const task = snapshot.tasks.find(task => task.taskId === taskId); assert.ok(task);
    repository.dispatch({ commandId: "delete-while-pending", projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision,
      action: { kind: "delete-proposal", groupId: task.groupId } });
    clients[0]?.complete("Historical correlated finding"); await operation;
    const state = readGroup().assignments[0]?.state; assert.ok(state?.kind === "terminal"); assert.equal(state.outcome, "completed");
    const html = renderCoordination(repository.read());
    assert.ok(html.includes("Historical correlated finding")); assert.ok(html.includes("Parent freshness: stale (changed or missing)"));
    assert.ok(html.includes("Supplied source freshness: stale"));
  });
  test("completed findings become stale after a later parent deletion", async () => {
    const group = prepare(1); const operation = controller.approveAndRun(group.groupId, group.preparedAtRevision, "completed-approval");
    await tick(); clients[0]?.complete("Completed before parent change"); await operation;
    assert.ok(renderCoordination(repository.read()).includes("Parent freshness: current"));
    const snapshot = repository.read(); const task = snapshot.tasks.find(task => task.taskId === taskId); assert.ok(task);
    repository.dispatch({ commandId: "delete-after-completion", projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision,
      action: { kind: "delete-proposal", groupId: task.groupId } });
    const html = renderCoordination(repository.read()); assert.ok(html.includes("Completed before parent change"));
    assert.ok(html.includes("Parent freshness: stale"));
    assert.ok(readGroup().assignments[0]?.state.kind === "terminal");
  });
  test("strict message parser cannot accept authority or private draft payload", () => {
    const message = { kind: "coordination", action: "prepare", requestId: "visible-click-message" };
    assert.deepEqual(parseCoordinationMessage(message), message);
    assert.equal(parseCoordinationMessage({ ...message, approved: true }), undefined);
    assert.equal(parseCoordinationMessage({ ...message, text: "unsent-secret" }), undefined);
    assert.equal(parseCoordinationMessage({ kind: "coordination", action: "stop", requestId: "targeted", id: "group", assignmentId: "worker" })?.assignmentId, "worker");
  });
});
