import { createInterface } from "node:readline";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers";
const mode = process.argv[2];
assert.equal(process.env.OPENAI_API_KEY, undefined);
assert.equal(process.env.AWS_SECRET_ACCESS_KEY, undefined);
const send = (frame) => process.stdout.write(`${JSON.stringify(frame)}\n`);
const item = { id: "answer", type: "agentMessage", phase: "final_answer", text: JSON.stringify({ summary: "Safe answer", sourceIndexes: [0] }) };
const complete = (status = "completed") => send({ method: "turn/completed", params: { threadId: mode === "mismatch" ? "wrong" : "thread-1", turn: { id: "turn-1", items: [item], status } } });
let start;
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  const reply = (result) => send({ id: request.id, result });
  switch (request.method) {
    case "initialize": {
      if (mode === "timeout") break;
      const encoded = `${JSON.stringify({ id: request.id, result: {} })}\n`;
      process.stdout.write(encoded.slice(0, 8)); process.stdout.write(encoded.slice(8)); break;
    }
    case "initialized": break;
    case "account/read":
      assert.equal(request.params.refreshToken, false);
      reply({ account: mode === "login" ? null : { type: "chatgpt", email: "must-not-escape@example.com", planType: "plus" }, requiresOpenaiAuth: true }); break;
    case "mcpServerStatus/list": reply({ data: mode === "mcp" ? [{ name: "unexpected" }] : [], nextCursor: null }); break;
    case "thread/start":
      assert.equal(request.params.ephemeral, true); assert.equal(request.params.sandbox, "read-only"); assert.equal(request.params.approvalPolicy, "never");
      reply({ thread: { id: "thread-1" }, sandbox: { type: "readOnly", networkAccess: false }, approvalPolicy: "never" }); break;
    case "turn/start":
      assert.deepEqual(request.params.sandboxPolicy, { type: "readOnly", networkAccess: false });
      assert.deepEqual(request.params.outputSchema, { type: "object", additionalProperties: false, required: ["summary", "sourceIndexes"], properties: { summary: { type: "string", minLength: 1 }, sourceIndexes: { type: "array", minItems: 1, items: { type: "integer", minimum: 0 } } } });
      start = request;
      if (mode === "inline-terminal") { reply({ turn: { id: "turn-1", status: "completed", items: [item] } }); break; }
      if (mode === "disconnect") process.exit(0);
      if (mode === "malformed") { process.stdout.write("garbage\n"); break; }
      if (mode === "oversize") { process.stdout.write("x".repeat(1024 * 1024 + 1)); break; }
      if (mode?.startsWith("deny:")) { send({ id: "approval", method: mode.slice(5), params: {} }); break; }
      if (mode === "interrupt") { reply({ turn: { id: "turn-1" } }); break; }
      send({ method: "item/completed", params: { threadId: "thread-1", turnId: "turn-1", item: { id: "secret", type: "reasoning", summary: ["Do not surface"] } } });
      if (mode === "bad-output") item.text = "This is private provider content, not JSON";
      if (mode === "tool") item.type = "commandExecution";
      complete(mode === "failed" || mode === "cancelled" ? mode : "completed"); reply({ turn: { id: "turn-1" } }); break;
    case "turn/interrupt": reply({}); item.text = "Partial answer is not JSON"; setTimeout(() => complete("interrupted"), 60); break;
    default:
      if (request.id === "approval") { assert.equal(request.error.code, -32601); send({ id: start.id, result: { turn: { id: "turn-1" } } }); complete("interrupted"); }
      else throw new Error("Unexpected fake-server request");
  }
}
