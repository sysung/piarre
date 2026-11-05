import assert from "node:assert/strict";
import { parseProjectEvent } from "../../../../packages/core/src/contracts.js";
import { conversationHistory, replay, type ProjectEvent } from "../../../../packages/core/src/index.js";
import { localDiscussionDefaults } from "../../src/docker-model-runner-conversation-client.js";

suite("Additive discussion provenance", () => {
  const created: ProjectEvent = { kind: "project-created", projectId: "project", repositoryUri: "file:///fixture", name: "Fixture" };
  const submitted = { requestId: "legacy", projectId: "project", contextRevision: 1, originalStatement: "  Original 한글\n" };
  const legacy: readonly ProjectEvent[] = [created, { kind: "conversation-started", submitted, sources: [] },
    { kind: "conversation-replied", requestId: "legacy", text: "Legacy inference", citations: [], providerThreadId: "actual-thread", providerTurnId: "actual-turn" }];
  const origin = { kind: "docker-model-runner", endpoint: localDiscussionDefaults.endpoint, requestedModel: localDiscussionDefaults.model, configuredDigest: localDiscussionDefaults.digest } as const;
  const start: ProjectEvent = { kind: "provider-conversation-started", submitted: { ...submitted, requestId: "local", contextRevision: 3 }, sources: [], origin };
  const reply: ProjectEvent = { kind: "provider-conversation-replied", requestId: "local", text: "Local inference", citations: [], origin: { kind: "docker-model-runner", observedModel: origin.requestedModel, responseId: null } };

  test("strict legacy replay retains the exact old projection without invented model identity", () => {
    assert.deepEqual(replay(legacy.map(parseProjectEvent)).conversation, [{ kind: "answered", submitted, sources: [], recordedAtRevision: 2,
      text: "Legacy inference", citations: [], providerThreadId: "actual-thread", providerTurnId: "actual-turn" }]);
    assert.throws(() => parseProjectEvent({ ...legacy[2], origin: { kind: "codex" } }));
    assert.throws(() => parseProjectEvent({ ...legacy[1], origin }));
  });

  test("new local events roundtrip with configured request identity and observed reply identity", () => {
    const events = [...legacy, start, reply];
    assert.deepEqual(events.map(parseProjectEvent), events);
    const turns = replay(events).conversation;
    assert.deepEqual(turns[0], replay(legacy).conversation[0]);
    const local = turns[1]; assert.equal(local?.kind, "answered");
    assert.deepEqual(local.origin, origin); assert.ok("replyOrigin" in local); assert.deepEqual(local.replyOrigin, reply.origin);
    assert.equal("providerThreadId" in local, false); assert.equal("providerTurnId" in local, false);
  });

  test("unknown terminal/restart state retains the chosen local request identity", () => {
    const snapshot = replay([...legacy, start, { kind: "conversation-ended", requestId: "local", outcome: "unknown", reason: "Restarted; no retry" }]);
    assert.deepEqual(snapshot.conversation[1]?.origin, origin); assert.equal(snapshot.conversation[1].kind, "unknown");
  });

  test("rejects provider mismatches and malformed additive provenance", () => {
    assert.throws(() => replay([...legacy, start, { ...reply, origin: { kind: "docker-model-runner", observedModel: "foreign", responseId: null } }]));
    assert.throws(() => replay([...legacy, start, { ...reply, origin: { kind: "codex", threadId: "fake", turnId: "fake" } }]));
    assert.throws(() => replay([...legacy, start, { kind: "conversation-replied", requestId: "local", text: "Forged", citations: [], providerThreadId: "fake", providerTurnId: "fake" }]));
    assert.throws(() => parseProjectEvent({ ...start, origin: { ...origin, providerThreadId: "fake" } }));
    assert.throws(() => parseProjectEvent({ ...start, origin: { ...origin, configuredDigest: "wrong" } }));
    assert.throws(() => parseProjectEvent({ ...reply, origin: { kind: "docker-model-runner", observedModel: "x", responseId: null, threadId: "fake" } }));
  });

  test("forked sessions retain mixed-provider history at the exact fork revision", () => {
    const snapshot = replay([...legacy, start, reply, { kind: "session-recorded", action: { kind: "create-session", id: "fork", title: "Fork", parentId: "project-chat" } },
      { kind: "provider-conversation-started", sessionId: "fork", submitted: { ...submitted, requestId: "codex-new", contextRevision: 6 }, sources: [], origin: { kind: "codex", requestedModel: null } },
      { kind: "provider-conversation-replied", requestId: "codex-new", text: "Codex inference", citations: [], origin: { kind: "codex", threadId: "observed-thread", turnId: "observed-turn" } }]);
    assert.deepEqual(conversationHistory(snapshot, "fork").map(turn => turn.submitted.requestId), ["legacy", "local", "codex-new"]);
  });
});
