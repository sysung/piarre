import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { DockerModelRunnerConversationClient, localDiscussionDefaults, parseLocalDiscussionConfiguration } from "../../src/docker-model-runner-conversation-client.js";

suite("Bounded local discussion transport", () => {
  let reply: (response: ServerResponse) => void;
  let received: { readonly path: string; readonly body: string; readonly authorization: string | undefined }[];
  let server: ReturnType<typeof createServer>;
  let client: DockerModelRunnerConversationClient;
  const configured = localDiscussionDefaults;
  const observedModel = `/Users/fixture/.docker/models/bundles/sha256/${configured.digest}/model/Qwen3.5-4B-Q6_K.gguf`;
  const output = { summary: "A local inference", sourceIndexes: [0] };
  const envelope = (changes: object = {}) => ({ id: "observed-id", model: observedModel,
    choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify({ reply: output.summary, sourceIndexes: output.sourceIndexes }) } }], ...changes });
  const request = () => client.respond({ cwd: "/must-not-be-transmitted", model: configured.model, prompt: "Exact reviewed bytes\n한글", beforeSend: () => {} });
  setup(async () => {
    received = [];
    reply = response => { response.setHeader("Content-Type", "application/json"); response.end(received.at(-1)?.path.endsWith("/models") ? '{"data":[]}' : JSON.stringify(envelope())); };
    server = createServer((incoming, response) => {
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk: Buffer) => { chunks.push(chunk); });
      incoming.on("end", () => { received.push({ path: incoming.url ?? "", body: Buffer.concat(chunks).toString("utf8"), authorization: incoming.headers.authorization }); reply(response); });
    });
    await new Promise<void>(resolve => { server.listen(0, "127.0.0.1", resolve); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing fixture address");
    client = new DockerModelRunnerConversationClient({ ...configured, endpoint: `http://127.0.0.1:${String(address.port)}/engines/v1` }, 150);
  });
  teardown(async () => { client.dispose(); server.closeAllConnections(); await new Promise<void>(resolve => { server.close(() => { resolve(); }); }); });

  test("sends only the exact reviewed prompt with bounded non-thinking generation", async () => {
    const result = await request();
    assert.equal(result.status, "completed");
    assert.deepEqual(result.origin, { kind: "docker-model-runner", observedModel, responseId: "observed-id" });
    assert.deepEqual(result.output, output);
    assert.equal(received.length, 1); assert.equal(received[0]?.authorization, undefined);
    const body: unknown = JSON.parse(received[0]?.body ?? "");
    assert.deepEqual(body, { model: configured.model, messages: [{ role: "user", content: "Exact reviewed bytes\n한글" }], stream: false, temperature: 0, max_tokens: 1024,
      chat_template_kwargs: { enable_thinking: false } });
  });

  test("accepts a conversational JSON reply without forcing summary decoding", async () => {
    const question = "Is the order domestic or international?";
    reply = response => {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(envelope({
        choices: [{ finish_reason: "stop", message: { role: "assistant",
          content: JSON.stringify({ reply: question, sourceIndexes: [0] }) } }],
      })));
    };
    const result = await request();
    assert.equal(result.status, "completed");
    assert.deepEqual(result.output, { summary: question, sourceIndexes: [0] });
    const body: unknown = JSON.parse(received[0]?.body ?? "");
    assert.ok(typeof body === "object" && body !== null);
    assert.equal("response_format" in body, false, "A forced summary grammar suppressed actual clarification replies");
  });

  test("configured model works when the catalog omits its alias and response id is absent", async () => {
    reply = response => { response.setHeader("Content-Type", "application/json"); response.end(received.length === 1 ? '{"data":[]}' : JSON.stringify(envelope({ id: undefined }))); };
    await client.connect(); assert.deepEqual(await client.models(), [{ model: configured.model }]);
    assert.deepEqual((await request()).origin, { kind: "docker-model-runner", observedModel, responseId: null });
  });

  test("rejects prohibited endpoints and model identities before any network request", async () => {
    for (const endpoint of ["https://127.0.0.1/engines/v1", "http://localhost/engines/v1", "http://example.com/engines/v1", "http://192.168.1.2/engines/v1", "http://model-runner.docker.internal:80/engines/v1", "http://127.0.0.1/engines/v1?x=1", "http://127.0.0.1/engines/v1#x", "http://u:p@127.0.0.1/engines/v1", "http://127.1/engines/v1", "http://127.0.0.1/elsewhere"]) {
      assert.throws(() => parseLocalDiscussionConfiguration({ ...configured, endpoint }), endpoint);
    }
    await assert.rejects(client.respond({ cwd: "", prompt: "test", model: "foreign", beforeSend: () => {} }), /configured/);
    assert.equal(received.length, 0);
  });

  test("rechecks approval before opening a socket and refuses oversized complete prompt", async () => {
    await assert.rejects(client.respond({ cwd: "", model: configured.model, prompt: "test", beforeSend: () => { throw new Error("stale review"); } }), /stale review/);
    assert.equal(received.length, 0);
    await client.connect(); received = [];
    await assert.rejects(client.respond({ cwd: "", model: configured.model, prompt: "한".repeat(2001), beforeSend: () => {} }), /6,000/);
    assert.equal(received.length, 0);
  });

  test("rejects redirect without following it or retrying", async () => {
    reply = response => { response.writeHead(302, { location: "/other" }); response.end(); };
    await assert.rejects(request()); assert.equal(received.length, 1);
    await assert.rejects(request(), /Reconnect/); assert.equal(received.length, 1);
  });

  test("bounds chunked response bytes while reading", async () => {
    reply = response => { response.setHeader("Content-Type", "application/json"); response.write(' {"padding":"'); response.write("x".repeat(65_536)); response.end('"}'); };
    await assert.rejects(request(), /65,536/); assert.equal(received.length, 1);
  });

  test("timeout does not retry or silently reuse the transport", async () => {
    reply = () => {};
    await assert.rejects(request()); await assert.rejects(request(), /Reconnect/); assert.equal(received.length, 1);
  });

  test("cancellation is unconfirmed and requires explicit reconnect", async () => {
    const started = new Promise<void>(resolve => { reply = () => { resolve(); }; });
    const operation = request();
    const rejected = assert.rejects(operation);
    await started; assert.deepEqual(await client.interrupt(), { kind: "unconfirmed" }); await rejected;
    await assert.rejects(request(), /Reconnect/);
    reply = response => { response.setHeader("Content-Type", "application/json"); response.end(received.at(-1)?.path.endsWith("/models") ? '{"data":[]}' : JSON.stringify(envelope())); };
    await client.connect(); assert.equal((await request()).status, "completed");
  });

  for (const [name, content] of [
    ["non-JSON reply", "A reply without the requested JSON object"],
    ["extra reply fields", JSON.stringify({ reply: "Unsafe extra field", sourceIndexes: [0], approved: true })],
    ["non-text reply", JSON.stringify({ reply: 7, sourceIndexes: [0] })],
    ["non-array indexes", JSON.stringify({ reply: "Malformed indexes", sourceIndexes: "0" })],
  ] as const) test(`rejects ${name}`, async () => {
    reply = response => {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(envelope({
        choices: [{ finish_reason: "stop", message: { role: "assistant", content } }],
      })));
    };
    await assert.rejects(request());
    assert.equal(received.length, 1);
  });

  for (const [name, body] of [
    ["foreign model", envelope({ model: "/foreign/model.gguf" })],
    ["tool calls", envelope({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "{}", tool_calls: [] } }] })],
    ["truncated output", envelope({ choices: [{ finish_reason: "length", message: { role: "assistant", content: "{}" } }] })],
    ["reasoning", envelope({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "{}", reasoning_content: "hidden reasoning" } }] })],
    ["malformed envelope", {}],
  ] as const) test(`rejects ${name}`, async () => {
    reply = response => { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(body)); };
    await assert.rejects(request()); assert.equal(received.length, 1);
  });
});
