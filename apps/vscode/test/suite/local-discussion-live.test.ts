import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as vscode from "vscode";
import { isDeepStrictEqual } from "node:util";
import { defaultSessionId } from "../../../../packages/core/src/conversation.js";
import { currentKnowledge } from "../../../../packages/core/src/knowledge.js";
import { resolveRecordReference } from "../../../../packages/core/src/inspection.js";
import { sourceCollectionVersion } from "../../../../packages/core/src/supplied-source.js";
import { ConversationController, type ConversationState } from "../../src/conversation-controller.js";
import { resolveConversationContext } from "../../src/conversation-context.js";
import { DockerModelRunnerConversationClient, localDiscussionDefaults, parseLocalDiscussionConfiguration } from "../../src/docker-model-runner-conversation-client.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";

if (process.env.PIARRE_LIVE_LOCAL === "1") {
  suite("Explicit live local discussion", () => {
    test("records a sourced real Docker Model Runner answer and reopens identical SQLite provenance", async function () {
      this.timeout(75_000);
      const reportPath = process.env.PIARRE_LIVE_LOCAL_REPORT;
      assert.ok(typeof reportPath === "string" && reportPath.trim(), "PIARRE_LIVE_LOCAL_REPORT must name a readable proof output file");
      assert.ok(vscode.workspace.isTrusted, "Run this explicitly gated fixture in a trusted isolated native VS Code host");
      const configuration = parseLocalDiscussionConfiguration({ ...localDiscussionDefaults,
        endpoint: process.env.PIARRE_LIVE_LOCAL_ENDPOINT ?? localDiscussionDefaults.endpoint });
      const directory = mkdtempSync(path.join(tmpdir(), "piarre-live-local-"));
      const databasePath = path.join(directory, "project.sqlite");
      const identity = { name: "Synthetic local discussion proof", repositoryUri: pathToFileURL(directory).href };
      let repository = new SqliteProjectRepository(databasePath);
      let controller: ConversationController | undefined;
      let observedTurn: ReturnType<SqliteProjectRepository["read"]>["conversation"][number] | undefined;
      const startedAt = new Date().toISOString();
      const start = performance.now();
      const writeReport = (value: unknown) => {
        mkdirSync(path.dirname(reportPath), { recursive: true });
        writeFileSync(reportPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      };
      try {
        repository.open(identity);
        let snapshot = repository.read();
        const observe = repository.dispatch({ commandId: "live-blue-observation", projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision,
          action: { kind: "observe-knowledge", topic: "Approved launch banner color", category: "business", affectedTaskIds: [],
            submitted: { requestId: "live-blue-statement", projectId: snapshot.projectId, contextRevision: snapshot.revision,
              originalStatement: "The approved launch banner color is blue. This is a synthetic test project requirement." } } });
        assert.equal(observe.kind, "applied");
        snapshot = repository.read();
        const observed = currentKnowledge(snapshot)[0]; assert.ok(observed);
        const confirm = repository.dispatch({ commandId: "live-blue-confirmation", projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision,
          action: { kind: "confirm-knowledge", target: { projectId: snapshot.projectId, knowledgeId: observed.knowledgeId, recordedAtRevision: observed.recordedAtRevision } } });
        assert.equal(confirm.kind, "applied");
        snapshot = repository.read();
        const confirmed = currentKnowledge(snapshot)[0]; assert.ok(confirmed); assert.equal(confirmed.standing.kind, "confirmed");
        const sources = resolveConversationContext(snapshot, [confirmed.knowledgeId]);
        assert.equal(sources.length, 1);
        const source = sources[0]; assert.ok(source);
        assert.notEqual(source.reference.kind, "file");
        if (source.reference.kind === "file") throw new Error("Expected canonical project knowledge");
        const resolved = resolveRecordReference(snapshot, source.reference);
        assert.equal(resolved.kind, "resolved"); assert.equal(resolved.text, source.text); assert.match(source.text, /blue/);
        const states: ConversationState[] = [];
        controller = new ConversationController(repository, (_project, state) => { states.push(state); }, route => {
          assert.equal(route, "docker-model-runner", "The live fixture must never construct a Codex client");
          return new DockerModelRunnerConversationClient(configuration);
        });
        await controller.connect("docker-model-runner");
        assert.equal(states.at(-1)?.kind, "ready", states.at(-1)?.message ?? "Missing ready state");
        assert.deepEqual(await controller.models(), [{ model: configuration.model }]);
        const question = "According to the confirmed project knowledge, what color is the approved launch banner? Answer directly and cite that supplied knowledge.";
        const reviewed = controller.review(snapshot, question, sources, defaultSessionId, configuration.model);
        let accepted = false;
        await controller.send(question, [], snapshot.revision, { sessionId: defaultSessionId, model: configuration.model, recordSources: sources,
          reviewed, accepted: () => { accepted = true; } });
        assert.equal(accepted, true);
        const saved = repository.read();
        const turn = saved.conversation[0]; observedTurn = turn; assert.equal(turn?.kind, "answered", states.at(-1)?.message ?? "Missing answered turn");
        assert.match(turn.text, /\bblue\b/i);
        assert.ok(turn.citations.some(reference => isDeepStrictEqual(reference, source.reference)), "The real reply must cite the confirmed blue knowledge, not only the user's question");
        assert.deepEqual(turn.origin, { kind: "docker-model-runner", endpoint: configuration.endpoint, requestedModel: configuration.model, configuredDigest: configuration.digest });
        assert.ok("replyOrigin" in turn); assert.equal(turn.replyOrigin.kind, "docker-model-runner");
        assert.ok(turn.replyOrigin.observedModel.startsWith("/"));
        assert.ok(turn.replyOrigin.observedModel.includes(`/bundles/sha256/${configuration.digest}/model/`));
        assert.match(turn.replyOrigin.observedModel, /\.gguf$/);
        assert.ok(turn.replyOrigin.responseId === null || (typeof turn.replyOrigin.responseId === "string" && turn.replyOrigin.responseId.trim().length > 0));
        assert.equal("providerThreadId" in turn, false); assert.equal("providerTurnId" in turn, false);
        assert.deepEqual(saved.tasks, []); assert.deepEqual(saved.proposals, []); assert.deepEqual(saved.executionRuns, []); assert.deepEqual(saved.coordination.groups, []);
        controller.dispose(); controller = undefined; repository.close();
        repository = new SqliteProjectRepository(databasePath);
        assert.deepEqual(repository.read(), saved);
        writeReport({ result: "passed", fixtureId: randomUUID(), startedAt, completedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - start),
          host: { vscodeVersion: vscode.version, nodeVersion: process.version, platform: process.platform, architecture: process.arch },
          explanation: "One actual Docker Model Runner HTTP reply traveled through the production ConversationController and SQLite event log. This synthetic fixture does not establish general model quality, exact token fit, installed weight verification, GPU use, or backend cancellation.",
          reviewed: { ...reviewed, promptUtf8Bytes: Buffer.byteLength(reviewed.prompt), promptSha256: createHash("sha256").update(reviewed.prompt).digest("hex"), sourceCollectionVersion: sourceCollectionVersion(snapshot) },
          source, turn, reopenedSnapshotEqual: true, effects: { tasks: saved.tasks.length, proposals: saved.proposals.length, executionRuns: saved.executionRuns.length, coordinationGroups: saved.coordination.groups.length },
          limits: { promptUtf8Bytes: 6000, requestedOutputTokens: 1024, runtimeContextTokens: "operator-configured 8192; not independently observed by this fixture", generalTokenizerTemplateGuarantee: "unverified" } });
      } catch (error) {
        writeReport({ result: "failed", startedAt, completedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - start), configuration,
          observedTurn, error: error instanceof Error ? error.stack ?? error.message : String(error), explanation: "No passing live integration claim is made. No retry or cloud fallback was attempted." });
        throw error;
      } finally { controller?.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true }); }
    });
  });
}
