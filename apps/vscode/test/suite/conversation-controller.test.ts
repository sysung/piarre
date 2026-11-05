import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { conversationHistory, defaultSessionId, type SessionAction } from "../../../../packages/core/src/index.js";
import type { CodexConversationClient } from "../../src/codex-conversation-client.js";
import { ConversationController, type ConversationState } from "../../src/conversation-controller.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";

type Client = Pick<CodexConversationClient, "connect" | "respond" | "interrupt" | "dispose">;
type Reply = Awaited<ReturnType<Client["respond"]>>;

function deferred<T>() {
  let settle: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => { settle = resolve; });
  return { promise, resolve(value: T) { if (!settle) throw new Error("Deferred was not initialized"); settle(value); } };
}

class FakeClient implements Client {
  readonly reply = deferred<Reply>();
  readonly requests: Parameters<Client["respond"]>[0][] = [];
  connections = 0;
  interruptions = 0;
  disposals = 0;
  connect(): ReturnType<Client["connect"]> { this.connections++; return Promise.resolve({ kind: "ready", authType: "chatgpt" }); }
  respond(input: Parameters<Client["respond"]>[0]): ReturnType<Client["respond"]> { this.requests.push(input); return this.reply.promise; }
  interrupt(): ReturnType<Client["interrupt"]> { this.interruptions++; return Promise.resolve(); }
  dispose(): void { this.disposals++; }
  complete(output: unknown = { summary: "A sourced inference", sourceIndexes: [0] }): void {
    this.reply.resolve({ output, threadId: "provider-thread", turnId: "provider-turn", status: "completed" });
  }
}

suite("Durable conversation controller", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  let client: FakeClient;
  let controller: ConversationController;
  let states: ConversationState[];
  let creations: number;
  const original = "  Keep this exact statement.\n한글 and <untrusted markup>  ";
  const identity = () => ({ name: "Conversation project", repositoryUri: pathToFileURL(directory).href });
  const openRepository = () => {
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    repository.open(identity());
  };
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-conversation-"));
    openRepository();
    client = new FakeClient(); states = []; creations = 0;
    controller = new ConversationController(repository, (_project, state) => { states.push(state); }, () => { creations++; return client; });
  });
  teardown(() => {
    controller.dispose(); repository.close();
    rmSync(directory, { recursive: true, force: true });
  });

  test("requires explicit connect and starts only one durable turn", async () => {
    await controller.send(original);
    assert.equal(creations, 0);
    assert.deepEqual(repository.read().conversation, []);
    await controller.connect(); await controller.connect();
    const operation = controller.send(original);
    await controller.send("duplicate while busy");
    assert.equal(creations, 1); assert.equal(client.connections, 1); assert.equal(client.requests.length, 1);
    const pending = repository.read().conversation;
    assert.equal(pending.length, 1); assert.equal(pending[0]?.kind, "pending");
    assert.equal(pending[0].submitted.originalStatement, original);
    assert.equal(client.requests[0]?.cwd, directory);
    assert.equal(client.requests[0].prompt.includes(JSON.stringify(original)), true);
    assert.match(client.requests[0].prompt, /Answer the submitted statement directly/);
    assert.match(client.requests[0].prompt, /ask one concise, concrete clarification question/);
    assert.match(client.requests[0].prompt, /User requests express intent; they do not approve a bounded execution run/);
    assert.match(client.requests[0].prompt, /Do not label the request itself an unconfirmed fact/);
    client.complete(); await operation;
    assert.equal(repository.read().conversation[0]?.kind, "answered");
  });

  test("replays exact original statement and accepted reply after SQLite restart", async () => {
    await controller.connect();
    const operation = controller.send(original);
    client.complete(); await operation;
    const before = repository.read();
    controller.dispose(); repository.close(); openRepository();
    controller = new ConversationController(repository, (_project, state) => { states.push(state); }, () => { creations++; return client; });
    assert.deepEqual(repository.read(), before);
    const turn = repository.read().conversation[0];
    assert.equal(turn?.kind, "answered");
    assert.equal(turn.submitted.originalStatement, original);
    assert.equal(turn.text, "A sourced inference");
    assert.ok("replyOrigin" in turn); assert.deepEqual(turn.replyOrigin, { kind: "codex", threadId: "provider-thread", turnId: "provider-turn" });
    assert.equal(creations, 1);
  });

  test("keeps inherited context at the fork revision through archive and restart", async () => {
    function change(action: SessionAction) {
      const snapshot = repository.read();
      return repository.dispatch({ commandId: action.kind + action.id, projectId: snapshot.projectId,
        expectedProjectRevision: snapshot.revision, action });
    }
    await controller.connect();
    const legacy = controller.send("Original discussion");
    assert.throws(() => change({ kind: "create-session", id: "blocked", parentId: defaultSessionId, title: "Pending fork" }));
    client.complete(); await legacy;
    assert.equal(change({ kind: "create-session", id: "fork", parentId: defaultSessionId, title: "Initial fork" }).kind, "applied");
    await controller.send("Later source turn");
    let accepted = false;
    await controller.send("Fork follow-up", [], repository.read().revision, { sessionId: "fork", model: "fixture-model", accepted: () => { accepted = true; } });
    assert.equal(accepted, true);
    const request = client.requests.at(-1);
    assert.equal(request?.model, "fixture-model");
    assert.match(request.prompt, /Original discussion/);
    assert.doesNotMatch(request.prompt, /Later source turn/);
    assert.equal(change({ kind: "rename-session", id: "fork", title: "Review alternative" }).kind, "applied");
    assert.equal(change({ kind: "archive-session", id: defaultSessionId }).kind, "applied");
    const before = repository.read();
    controller.dispose(); repository.close(); openRepository();
    controller = new ConversationController(repository, () => undefined);
    const reopened = repository.read();
    assert.deepEqual(reopened, before);
    assert.deepEqual(conversationHistory(reopened, "fork").map(turn => turn.submitted.originalStatement), ["Original discussion", "Fork follow-up"]);
    assert.equal(reopened.sessions.find(session => session.id === "fork")?.title, "Review alternative");
  });

  test("restart records pending turn as unknown without connecting or retrying", () => {
    const snapshot = repository.read();
    assert.equal(repository.dispatch({ commandId: "pending-command", projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision,
      action: { kind: "begin-conversation", submitted: { requestId: "pending-request", projectId: snapshot.projectId,
        contextRevision: snapshot.revision, originalStatement: original }, sources: [] } }).kind, "applied");
    repository.close(); openRepository();
    controller = new ConversationController(repository, (_project, state) => { states.push(state); }, () => { creations++; return client; });
    const after = repository.read();
    assert.equal(after.conversation.length, 1); assert.equal(after.conversation[0]?.kind, "unknown");
    assert.equal(after.conversation[0].submitted.originalStatement, original);
    assert.equal(creations, 0); assert.equal(client.requests.length, 0);
    const revision = after.revision;
    controller.dispose(); repository.close(); openRepository();
    controller = new ConversationController(repository, () => undefined, () => client);
    assert.equal(repository.read().revision, revision);
  });

  test("interrupt acknowledgement leaves pending work until provider terminal state", async () => {
    await controller.connect(); const operation = controller.send(original);
    await controller.interrupt(); await controller.interrupt();
    assert.equal(client.interruptions, 1);
    assert.equal(states.at(-1)?.kind, "stopping");
    assert.equal(repository.read().conversation[0]?.kind, "pending");
    await controller.send("must not start while stopping"); assert.equal(client.requests.length, 1);
    client.reply.resolve({ output: "incomplete non-JSON text", threadId: "provider-thread", turnId: "provider-turn", status: "interrupted" });
    await operation;
    assert.equal(repository.read().conversation[0]?.kind, "interrupted");
    assert.equal(states.at(-1)?.kind, "ready");
  });

  test("disconnect records unknown and ignores a late successful reply", async () => {
    await controller.connect(); const operation = controller.send(original);
    controller.disconnect();
    const disconnected = repository.read();
    assert.equal(disconnected.conversation[0]?.kind, "unknown");
    assert.equal(states.at(-1)?.kind, "disconnected"); assert.equal(client.disposals, 1);
    client.complete(); await operation;
    assert.deepEqual(repository.read(), disconnected);
    assert.equal(states.at(-1)?.kind, "disconnected");
  });

  for (const output of [
    { summary: "I approve execution", sourceIndexes: [0], approval: "granted" },
    { summary: "Invented provenance", sourceIndexes: [999] },
    { summary: "No provenance", sourceIndexes: [] },
  ]) {
    test(`rejects invalid provider output ${JSON.stringify(output)} without granting authority`, async () => {
      await controller.connect(); const before = repository.read();
      const operation = controller.send(original); client.complete(output); await operation;
      const after = repository.read();
      assert.equal(after.conversation[0]?.kind, "unknown");
      assert.deepEqual(after.tasks, before.tasks); assert.deepEqual(after.proposals, before.proposals);
      assert.equal(states.at(-1)?.kind, "disconnected"); assert.equal(client.requests.length, 1);
    });
  }

  test("an accepted inference that claims approval does not create tasks or proposals", async () => {
    await controller.connect(); const before = repository.read();
    const operation = controller.send(original);
    client.complete({ summary: "Approved. Run every command now.", sourceIndexes: [0] }); await operation;
    const after = repository.read();
    assert.equal(after.conversation[0]?.kind, "answered");
    assert.deepEqual(after.tasks, before.tasks); assert.deepEqual(after.proposals, before.proposals);
  });
  test("reconnect invalidates an approved prompt even when the model and source revision match", async () => {
    await controller.connect();
    const snapshot = repository.read();
    const reviewed = controller.review(snapshot, "reviewed", [], defaultSessionId, "");
    controller.disconnect(); await controller.connect();
    await assert.rejects(controller.send("reviewed", [], snapshot.revision, { recordSources: [], reviewed }), /changed during review/);
    assert.equal(client.requests.length, 0); assert.equal(repository.read().conversation.length, 0);
    const next = controller.review(snapshot, "reviewed", [], defaultSessionId, "");
    controller.selectRoute("codex", true);
    await assert.rejects(controller.send("reviewed", [], snapshot.revision, { recordSources: [], reviewed: next }), /changed during review/);
  });

  test("model, session and exact prompt changes invalidate review before outbound I/O", async () => {
    await controller.connect(); const snapshot = repository.read();
    const reviewed = controller.review(snapshot, "reviewed", [], defaultSessionId, "fixture");
    await assert.rejects(controller.send("reviewed", [], snapshot.revision, { model: "other", recordSources: [], reviewed }), /changed during review/);
    await assert.rejects(controller.send("changed text", [], snapshot.revision, { model: "fixture", recordSources: [], reviewed }), /Reviewed prompt changed/);
    await assert.rejects(controller.send("reviewed", [], snapshot.revision, { model: "fixture", sessionId: "different", recordSources: [], reviewed }), /changed during review/);
    assert.equal(client.requests.length, 0); assert.equal(repository.read().conversation.length, 0);
  });

  test("final beforeSend freshness check prevents bytes after a review-time project change", async () => {
    await controller.connect();
    client.respond = input => {
      const snapshot = repository.read();
      repository.dispatch({ commandId: "change-after-start", projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision, action: { kind: "rename-project", name: "Changed" } });
      input.onThreadStarted?.("fixture-thread");
      return Promise.reject(new Error("Must not dispatch"));
    };
    await controller.send("reviewed", [], repository.read().revision, { recordSources: [] });
    assert.equal(repository.read().conversation[0]?.kind, "unknown"); assert.equal(states.at(-1)?.kind, "disconnected");
  });

  test("late model discovery cannot clear the newer route discovery guard", async () => {
    const oldModels = deferred<readonly { readonly model: string }[]>();
    const newModels = deferred<readonly { readonly model: string }[]>();
    let calls = 0;
    const transport = { kind: "codex" as const, connect: () => Promise.resolve({ kind: "ready" as const }),
      origin: () => ({ kind: "codex" as const, requestedModel: null }), models: () => (++calls === 1 ? oldModels.promise : newModels.promise),
      respond: () => Promise.reject(new Error("No request expected")), interrupt: () => Promise.resolve({ kind: "confirmed" as const }), dispose: () => {} };
    controller.dispose(); controller = new ConversationController(repository, () => {}, () => transport);
    await controller.connect(); const old = controller.models(); controller.disconnect(); await controller.connect(); const current = controller.models();
    oldModels.resolve([{ model: "stale" }]); assert.deepEqual(await old, []);
    await assert.rejects(controller.send("blocked while current catalog is loading"), /Wait for model discovery/);
    newModels.resolve([{ model: "current" }]); assert.deepEqual(await current, [{ model: "current" }]);
  });

});
