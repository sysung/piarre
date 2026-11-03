import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import path from "node:path";
import { CodexConversationClient } from "../../src/codex-conversation-client";
import { parseDefaultModel, parseObservedUsage, parseThreadMetadata } from "../../src/codex-account-context";

function client(mode = "success"): CodexConversationClient {
  return new CodexConversationClient({ command: process.env.PIARRE_TEST_NODE ?? process.execPath, args: [path.resolve(__dirname, "../../test/fixtures/fake-codex-account-context.mjs"), mode] });
}

suite("Codex public execution metadata", () => {
  test("reads bounded public model pages and observed windows explicitly", async () => {
    const connection = client();
    try {
      await assert.rejects(connection.readExecutionContext(), /Connect Codex explicitly/);
      assert.deepEqual(await connection.connect(), { kind: "ready", authType: "chatgpt" });
      const pending = connection.readExecutionContext();
      await assert.rejects(connection.readExecutionContext(), /no turn may be active/);
      await assert.rejects(connection.respond({ prompt: "hello", cwd: process.cwd() }), /Connect Codex explicitly/);
      const result = await pending;
      assert.deepEqual(result.model, { kind: "resolved-default", model: "public-model" });
      assert.deepEqual(result.usage, { kind: "observed", source: "account/rateLimits/read", windows: [
        { source: "primary", usedPercent: 23, windowDurationMins: 90, resetsAt: 1800000000 },
        { source: "secondary", usedPercent: 5, windowDurationMins: null, resetsAt: null },
      ] });
      assert.equal("taskForecast" in result, false);
      assert.equal(new Date(result.observedAt).toISOString(), result.observedAt);
      assert.doesNotMatch(JSON.stringify(result), /private-account|discard-account|balance|displayName|weekly|five.hour/);
    } finally { connection.dispose(); }
  });

  for (const mode of ["unsupported", "empty", "endless"]) {
    test(`leaves unavailable model discovery unknown: ${mode}`, async () => {
      const connection = client(mode);
      try {
        await connection.connect();
        const result = await connection.readExecutionContext();
        assert.deepEqual(result.model, { kind: "unknown" });
        if (mode !== "endless") assert.deepEqual(result.usage, { kind: "unknown" });
        assert.doesNotMatch(JSON.stringify(result), /private-account|raw-error/);
      } finally { connection.dispose(); }
    });
  }

  test("exposes startup metadata before turn submission without changing response shape", async () => {
    const connection = client();
    try {
      await connection.connect();
      await assert.rejects(connection.respond({ prompt: "hello", cwd: process.cwd(), onThreadMetadata: (metadata) => {
        assert.deepEqual(metadata, { model: "public-model", modelProvider: "openai" });
        throw new Error("Prepared model mismatch blocks execution");
      } }), /Prepared model mismatch/);
    } finally { connection.dispose(); }
  });

  test("standard per-turn override uses exact supported wire key despite inherited fast tier", async () => {
    const connection = client("tier-dispatch");
    try {
      await connection.connect(); let inherited: string | null | undefined;
      const result = await connection.proposePatch({ prompt: "Inspect", cwd: process.cwd(), serviceTierForTurn: "default", effort: "medium", onThreadMetadata: metadata => { inherited = metadata.serviceTier; assert.equal(metadata.reasoningEffort, "medium"); } });
      assert.equal(inherited, "fast"); assert.equal(result.status, "completed");
    } finally { connection.dispose(); }
  });

  test("final metadata await rechecks actual account context and blocks turn/start", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "piarre-preflight-")); const log = path.join(directory, "requests");
    const connection = new CodexConversationClient({ command: process.env.PIARRE_TEST_NODE ?? process.execPath, args: [path.resolve(__dirname, "../../test/fixtures/fake-codex-account-context.mjs"), "success", log] });
    try {
      await connection.connect(); let observed = false;
      await assert.rejects(connection.proposePatch({ prompt: "Inspect", cwd: process.cwd(), serviceTierForTurn: "default", onBeforeTurnStart: context => {
        assert.equal(context.authType, "chatgpt"); observed = true; throw new Error("Account/reset/configuration no longer matches approved forecast");
      } }), /no longer matches/);
      const requests = readFileSync(log, "utf8").trim().split("\n"); assert.equal(observed, true); assert.equal(requests.filter(method => method === "turn/start").length, 0); assert.equal(requests.filter(method => method === "account/rateLimits/read").length, 1); assert.equal(requests.filter(method => method === "thread/start").length, 1);
    } finally { connection.dispose(); rmSync(directory, { recursive: true, force: true }); }
  });

  test("only resolves one reported default from a complete catalog", () => {
    assert.deepEqual(parseDefaultModel([{ data: [{ isDefault: false, model: "not-default" }] }], true), { kind: "unknown" });
    assert.deepEqual(parseDefaultModel([{ data: [{ isDefault: true, model: "a" }, { isDefault: true, model: "b" }] }], true), { kind: "unknown" });
    assert.deepEqual(parseDefaultModel([{ data: [{ isDefault: true, model: "a" }] }], false), { kind: "unknown" });
    assert.deepEqual(parseDefaultModel([{ data: [{ isDefault: true, model: "email@example.com" }] }], true), { kind: "unknown" });
    assert.deepEqual(parseDefaultModel([null], true), { kind: "unknown" });
  });

  test("rejects malformed windows and preserves unknown duration/reset instead of guessing", () => {
    for (const value of [null, {}, { rateLimits: {} }, { rateLimits: { primary: { usedPercent: -1 } } },
      { rateLimits: { primary: { usedPercent: 101 } } }, { rateLimits: { primary: { usedPercent: 1.5 } } },
      { rateLimits: { primary: { usedPercent: 1, resetsAt: "tomorrow" } } },
      { rateLimits: { primary: { usedPercent: 1, resetsAt: Number.MAX_SAFE_INTEGER } } },
      { rateLimits: { primary: { usedPercent: 1, windowDurationMins: 0 } } }]) {
      assert.deepEqual(parseObservedUsage(value), { kind: "unknown" });
    }
    assert.deepEqual(parseObservedUsage({ rateLimits: { primary: { usedPercent: 0 } } }), {
      kind: "observed", source: "account/rateLimits/read", windows: [{ source: "primary", usedPercent: 0, windowDurationMins: null, resetsAt: null }],
    });
    assert.deepEqual(parseThreadMetadata({ model: "account@example.com", modelProvider: { secret: "key" } }), { model: null, modelProvider: null });
  });
});
