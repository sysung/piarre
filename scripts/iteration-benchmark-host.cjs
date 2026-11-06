const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
const { mkdtempSync, mkdirSync, rmSync } = require("node:fs");
const { performance } = require("node:perf_hooks");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const vscode = require("vscode");

module.exports = ({ ConversationController, resolveConversationContext, SqliteProjectRepository,
  DockerModelRunnerConversationClient, localDiscussionDefaults, parseLocalDiscussionConfiguration, currentKnowledge, defaultSessionId, resolveRecordReference }) => {
  return async function runCase({ scenario, condition, endpoint, deadline, markAttempt, emit }) {
    assert(vscode.workspace.isTrusted);
    const configuration = parseLocalDiscussionConfiguration({ ...localDiscussionDefaults, endpoint });
    const directory = mkdtempSync(path.join(tmpdir(), "piarre-bench-"));
    const root = path.join(directory, "workspace");
    mkdirSync(root);
    const identity = { name: scenario.project, repositoryUri: pathToFileURL(root).href };
    const databasePath = path.join(directory, "project.sqlite");
    let repository = new SqliteProjectRepository(databasePath);
    let controller;
    let state;
    const send = action => {
      const { projectId, revision } = repository.read();
      const result = repository.dispatch({ commandId: randomUUID(), projectId, expectedProjectRevision: revision, action });
      assert.equal(result.kind, "applied");
    };
    const apply = ({ topic, text }) => {
      const { projectId, revision } = repository.read();
      const submitted = { requestId: randomUUID(), projectId, contextRevision: revision, originalStatement: text };
      const prior = currentKnowledge(repository.read()).find(entry => entry.topic === topic);
      const target = entry => ({ projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision });
      send(prior
        ? { kind: "correct-knowledge", target: target(prior), submitted, affectedTaskIds: [] }
        : { kind: "observe-knowledge", topic, category: "business", submitted, affectedTaskIds: [] });
      const observed = currentKnowledge(repository.read()).find(entry => entry.topic === topic && entry.standing.kind !== "confirmed");
      if (observed) send({ kind: "confirm-knowledge", target: target(observed) });
    };
    const reopen = () => {
      controller?.dispose();
      controller = undefined;
      const snapshot = repository.read();
      repository.close();
      repository = new SqliteProjectRepository(databasePath);
      assert.deepEqual(repository.read(), snapshot);
    };
    try {
      repository.open(identity);
      if (scenario.kind === "control") {
        apply({ topic: "Current policy", text: "The limit is 30 days." });
        const old = currentKnowledge(repository.read())[0];
        const [oldSource] = resolveConversationContext(repository.read(), [old.knowledgeId]);
        if (scenario.control === "stale-source") {
          apply({ topic: "Current policy", text: "The limit is 45 days." });
          reopen();
          const current = currentKnowledge(repository.read())[0];
          assert.notEqual(current.recordedAtRevision, old.recordedAtRevision);
          assert.equal(resolveRecordReference(repository.read(), oldSource.reference).kind, "stale");
          const [source] = resolveConversationContext(repository.read(), [old.knowledgeId]);
          assert.equal(source.reference.revision, current.recordedAtRevision);
          assert.match(source.text, /45 days/);
        } else {
          const other = new SqliteProjectRepository(path.join(directory, "other.sqlite"));
          try {
            other.open({ name: "Other project", repositoryUri: pathToFileURL(directory).href });
            assert.throws(() => resolveConversationContext(other.read(), [old.knowledgeId]));
            assert.equal(resolveRecordReference(other.read(), oldSource.reference).kind, "wrong-project");
          } finally {
            other.close();
          }
        }
        emit({ status: "passed", control: scenario.control });
        return true;
      }
      const turns = condition === "retained" ? scenario.turns : scenario.turns.slice(-1);
      for (const [index, turn] of turns.entries()) {
        if (Date.now() + 60_000 > deadline) return false;
        if (index) reopen();
        if (condition === "reset") {
          for (const fact of scenario.turns[0].facts ?? []) apply(fact);
          reopen();
          repository.close();
          repository = new SqliteProjectRepository(path.join(directory, "reset.sqlite"));
          repository.open(identity);
          assert.deepEqual(currentKnowledge(repository.read()), []);
        }
        if (condition === "retained") {
          for (const fact of turn.facts ?? []) apply(fact);
        }
        const snapshot = repository.read();
        const knowledge = currentKnowledge(snapshot).filter(entry => entry.standing.kind === "confirmed");
        const sources = resolveConversationContext(snapshot, knowledge.map(entry => entry.knowledgeId));
        controller = new ConversationController(repository, (_project, next) => { state = next; }, route => {
          assert.equal(route, "docker-model-runner");
          const client = new DockerModelRunnerConversationClient(configuration);
          const respond = client.respond.bind(client);
          client.respond = input => respond({ ...input, beforeSend: () => {
            input.beforeSend();
            markAttempt();
          } });
          return client;
        });
        await controller.connect("docker-model-runner");
        if (state?.kind !== "ready") {
          emit({ index, status: "blocked", reason: state?.message });
          return false;
        }
        const reviewed = controller.review(snapshot, turn.question, sources, defaultSessionId, configuration.model);
        const start = performance.now();
        await controller.send(turn.question, [], snapshot.revision, { sessionId: defaultSessionId, model: configuration.model,
          recordSources: sources, reviewed });
        const elapsedMs = Math.round(performance.now() - start);
        const after = repository.read();
        const reply = after.conversation.at(-1);
        const localIdentity = reply?.replyOrigin?.kind === "docker-model-runner" &&
          reply.replyOrigin.observedModel.includes(`/bundles/sha256/${configuration.digest}/model/`);
        const noEffects = ["tasks", "proposals", "executionRuns"].every(key => after[key].length === 0) && after.coordination.groups.length === 0;
        reopen();
        emit({ index, status: reply?.kind === "answered" && localIdentity ? "answered" : "failed",
          elapsedMs, reply, noEffects, activeSources: sources.map(source => ({ reference: source.reference,
            topic: knowledge.find(entry => entry.knowledgeId === source.reference.recordId)?.topic })),
          promptSha256: createHash("sha256").update(reviewed.prompt).digest("hex"),
          prompt: reviewed.prompt, reason: state?.message });
        if (reply?.kind !== "answered" || !localIdentity || !noEffects) return false;
      }
      return true;
    } finally {
      controller?.dispose();
      repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  };
};
