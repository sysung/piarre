import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defaultSessionId } from "../../../../packages/core/src/conversation.js";
import { ConversationController, type ConversationState } from "../../src/conversation-controller.js";
import { DockerModelRunnerConversationClient, localDiscussionDefaults } from "../../src/docker-model-runner-conversation-client.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";

suite("Local discussion controller and real HTTP boundary", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  let server: ReturnType<typeof createServer>;
  let controller: ConversationController;
  let state: ConversationState;
  let posts: string[];
  let reply: (response: ServerResponse) => void;
  const model = localDiscussionDefaults.model;
  setup(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-local-discussion-"));
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    repository.open({ name: "Local", repositoryUri: pathToFileURL(directory).href });
    posts = [];
    reply = response => { response.end(JSON.stringify({ model, choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify({ summary: "Local sourced inference", sourceIndexes: [0] }) } }] })); };
    server = createServer((incoming, response) => {
      response.setHeader("Content-Type", "application/json");
      if (incoming.method === "GET") { response.end('{"data":[]}'); return; }
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk: Buffer) => { chunks.push(chunk); });
      incoming.on("end", () => { posts.push(Buffer.concat(chunks).toString("utf8")); reply(response); });
    });
    await new Promise<void>(resolve => { server.listen(0, "127.0.0.1", resolve); });
    const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing fixture address");
    const endpoint = `http://127.0.0.1:${String(address.port)}/engines/v1`;
    state = { kind: "disconnected", message: "" };
    controller = new ConversationController(repository, (_snapshot, next) => { state = next; }, () => new DockerModelRunnerConversationClient({ ...localDiscussionDefaults, endpoint }, 500));
  });
  teardown(async () => {
    controller.dispose(); repository.close(); server.closeAllConnections();
    await new Promise<void>(resolve => { server.close(() => { resolve(); }); }); rmSync(directory, { recursive: true, force: true });
  });

  test("approved exact prompt reaches local HTTP and durable honest provenance without Codex", async () => {
    await controller.connect("docker-model-runner");
    const snapshot = repository.read();
    const reviewed = controller.review(snapshot, "What is known?", [], defaultSessionId, model);
    await controller.send("What is known?", [], snapshot.revision, { model, recordSources: [], reviewed });
    assert.equal(posts.length, 1); assert.equal(state.kind, "ready");
    const envelope: unknown = JSON.parse(posts[0] ?? "");
    assert.ok(typeof envelope === "object" && envelope !== null && "messages" in envelope && Array.isArray(envelope.messages));
    assert.deepEqual(envelope.messages, [{ role: "user", content: reviewed.prompt }]);
    const turn = repository.read().conversation[0]; assert.equal(turn?.kind, "answered"); assert.equal(turn.origin?.kind, "docker-model-runner");
    assert.ok("replyOrigin" in turn); assert.deepEqual(turn.replyOrigin, { kind: "docker-model-runner", observedModel: model, responseId: null });
    assert.equal("providerThreadId" in turn, false); assert.equal("providerTurnId" in turn, false);
    assert.equal(repository.read().tasks.length, 0); assert.equal(repository.read().proposals.length, 0);
  });

  for (const indexes of [[-1], [1], [0.5], ["0"], []]) test(`independently rejects invalid source indexes ${JSON.stringify(indexes)}`, async () => {
    reply = response => { response.end(JSON.stringify({ model, choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify({ summary: "Invalid", sourceIndexes: indexes }) } }] })); };
    await controller.connect("docker-model-runner");
    await controller.send("Ground this", [], repository.read().revision, { model, recordSources: [] });
    assert.equal(posts.length, 1); assert.equal(repository.read().conversation[0]?.kind, "unknown"); assert.equal(state.kind, "disconnected");
    await controller.send("Do not retry", [], undefined, { model }); assert.equal(posts.length, 1);
  });

  test("local cancellation saves unknown and explicit reconnect is the sole recovery path", async () => {
    const started = new Promise<void>(resolve => { reply = () => { resolve(); }; });
    await controller.connect("docker-model-runner");
    const operation = controller.send("Stop this", [], repository.read().revision, { model, recordSources: [] });
    await started; await controller.interrupt(); await operation;
    const turn = repository.read().conversation[0]; assert.equal(turn?.kind, "unknown"); assert.equal(turn.origin?.kind, "docker-model-runner");
    assert.match(state.message, /Backend compute may continue/); assert.equal(state.kind, "disconnected");
    const count = posts.length;
    await controller.send("No implicit reconnect", [], undefined, { model }); assert.equal(posts.length, count);
    await controller.connect("docker-model-runner"); assert.equal(state.kind, "ready");
  });

  test("route changes during review reject before local HTTP", async () => {
    await controller.connect("docker-model-runner"); const snapshot = repository.read();
    const reviewed = controller.review(snapshot, "Ground this", [], defaultSessionId, model);
    controller.selectRoute("codex"); controller.selectRoute("docker-model-runner"); await controller.connect("docker-model-runner");
    await assert.rejects(controller.send("Ground this", [], snapshot.revision, { model, recordSources: [], reviewed }), /changed during review/);
    assert.equal(posts.length, 0); assert.equal(repository.read().conversation.length, 0);
  });
});
