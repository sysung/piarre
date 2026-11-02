import { createInterface } from "node:readline";
import assert from "node:assert/strict";
const mode = process.argv[2];
let page = 0;
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  const reply = (result) => process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
  const reject = () => process.stdout.write(`${JSON.stringify({ id: request.id, error: { code: -32601, message: "private-account@example.com raw-error" } })}\n`);
  switch (request.method) {
    case "initialize": reply({}); break;
    case "initialized": break;
    case "account/read": reply({ requiresOpenaiAuth: true, account: { type: "chatgpt", email: "private-account@example.com" } }); break;
    case "mcpServerStatus/list": reply({ data: [], nextCursor: null }); break;
    case "model/list":
      assert.equal(request.params.limit, 100);
      assert.equal(request.params.includeHidden, false);
      if (mode === "unsupported") { reject(); break; }
      if (mode === "empty") { reply({ data: [], nextCursor: null }); break; }
      if (mode === "endless") { reply({ data: [{ isDefault: true, model: "public-model" }], nextCursor: String(++page) }); break; }
      if (!request.params.cursor) reply({ data: [{ isDefault: false, model: "other-model" }], nextCursor: "next" });
      else { assert.equal(request.params.cursor, "next"); reply({ data: [{ isDefault: true, model: "public-model", displayName: "Discard" }], nextCursor: null }); }
      break;
    case "account/rateLimits/read":
      assert.deepEqual(request.params, {});
      if (mode === "unsupported") { reject(); break; }
      reply({ rateLimits: mode === "empty" ? {} : { primary: { usedPercent: 23, windowDurationMins: 90, resetsAt: 1800000000 }, secondary: { usedPercent: 5, windowDurationMins: null, resetsAt: null }, credits: { hasCredits: true, unlimited: false, balance: "100" } }, accountId: "discard-account" }); break;
    case "thread/start":
      reply({ thread: { id: "metadata-thread" }, model: "public-model", modelProvider: "openai", sandbox: { type: "readOnly", networkAccess: false }, approvalPolicy: "never" }); break;
    case "turn/start":
      throw new Error("Metadata callback must block before turn/start");
    default: throw new Error("Unexpected metadata fixture request");
  }
}
