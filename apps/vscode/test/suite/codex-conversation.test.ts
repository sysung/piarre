import assert from "node:assert/strict";
import path from "node:path";
import { CodexConversationClient } from "../../src/codex-conversation-client";

function client(mode = "success"): CodexConversationClient {
  return new CodexConversationClient({ command: process.execPath, args: [path.resolve(__dirname, "../../test/fixtures/fake-codex-conversation.mjs"), mode] });
}

suite("Codex conversation process adapter", () => {
  test("requires explicit connection and returns only public auth type", async () => {
    const connection = client();
    try {
      await assert.rejects(connection.respond({ prompt: "hello", cwd: process.cwd() }), /Connect Codex explicitly/);
      assert.deepEqual(await connection.connect(), { kind: "ready", authType: "chatgpt" });
      await assert.rejects(connection.connect(), /already active/);
    } finally { connection.dispose(); }
  });

  test("handles partial frames and terminal notifications before start acknowledgement", async () => {
    const connection = client();
    const progress: string[] = [];
    try {
      await connection.connect();
      const result = await connection.respond({ prompt: "hello", cwd: process.cwd(), onProgress: (text) => progress.push(text) });
      assert.deepEqual(result, { output: { summary: "Safe answer", sourceIndexes: [0] }, threadId: "thread-1", turnId: "turn-1", status: "completed" });
      assert.equal(progress.length, 1);
      assert.doesNotMatch(progress.join(""), /Do not surface/);
    } finally { connection.dispose(); }
  });

  test("accepts a correlated terminal turn in the start response", async () => {
    const connection = client("inline-terminal");
    try {
      await connection.connect();
      assert.equal((await connection.respond({ prompt: "hello", cwd: process.cwd() })).status, "completed");
    } finally { connection.dispose(); }
  });

  test("reports login required without starting a turn", async () => {
    const connection = client("login");
    try { assert.deepEqual(await connection.connect(), { kind: "login-required" }); }
    finally { connection.dispose(); }
  });

  test("fails closed when external tools are configured", async () => {
    const connection = client("mcp");
    try { await assert.rejects(connection.connect(), /External Codex tools/); }
    finally { connection.dispose(); }
  });

  for (const mode of ["failed", "cancelled", "disconnect", "malformed", "oversize", "mismatch", "tool", "bad-output"]) {
    test(`rejects ${mode} without a successful result`, async () => {
      const connection = client(mode);
      try {
        await connection.connect();
        await assert.rejects(connection.respond({ prompt: "hello", cwd: process.cwd() }));
      } finally { connection.dispose(); }
    });
  }

  for (const method of ["item/commandExecution/requestApproval", "item/fileChange/requestApproval", "item/permissions/requestApproval", "item/tool/call", "account/chatgptAuthTokens/refresh", "future/tool"]) {
    test(`denies server request ${method}`, async () => {
      const connection = client(`deny:${method}`);
      try {
        await connection.connect();
        assert.equal((await connection.respond({ prompt: "hello", cwd: process.cwd() })).status, "interrupted");
      } finally { connection.dispose(); }
    });
  }

  test("dispose rejects a pending conversation without claiming it completed", async () => {
    const connection = client("interrupt");
    try {
      await connection.connect();
      const response = connection.respond({ prompt: "hello", cwd: process.cwd() });
      const rejection = assert.rejects(response, /disposed|disconnected/);
      connection.dispose();
      await rejection;
    } finally { connection.dispose(); }
  });

  test("request timeout rejects with unknown completion", async function () {
    this.timeout(20_000);
    const connection = client("timeout");
    try { await assert.rejects(connection.connect(), /request timed out; completion is unknown/); }
    finally { connection.dispose(); }
  });

  test("interrupt acknowledgement keeps the turn active until terminal notification", async () => {
    const connection = client("interrupt");
    try {
      await connection.connect();
      let settled = false;
      const response = connection.respond({ prompt: "hello", cwd: process.cwd() });
      void response.then(() => { settled = true; });
      for (let attempt = 0; ; attempt++) {
        try { await connection.interrupt(); break; } catch (error) {
          if (attempt >= 100 || !(error instanceof Error) || !error.message.includes("No acknowledged")) throw error;
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }
      assert.equal(settled, false);
      await assert.rejects(connection.respond({ prompt: "overlap", cwd: process.cwd() }), /Connect Codex explicitly/);
      assert.deepEqual(await response, { output: null, threadId: "thread-1", turnId: "turn-1", status: "interrupted" });
    } finally { connection.dispose(); }
  });
});
