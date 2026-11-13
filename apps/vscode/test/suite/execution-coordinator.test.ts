import type { ProviderConfiguration } from "../../../../packages/core/src/inspection.js";
import type { CodexExecutionContext } from "../../../../packages/core/src/provider-account-context.js";
import type { CalibrationSample } from "../../../../packages/core/src/execution-forecast.js";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ExecutionCoordinator } from "../../src/execution-coordinator.js";
import { CandidateCheckRunner } from "../../src/candidate-check-runner.js";
import type { CodexConversationClient } from "../../src/codex-conversation-client.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { currentKnowledge, planFreshness, ownsExecutionLease, type ProjectCommand } from "../../../../packages/core/src/index.js";
import { renderExecutionResult } from "../../src/execution-view.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";

const nodeExecutable = process.env.PIARRE_TEST_NODE ?? process.execPath;
type Client = Pick<CodexConversationClient, "connect" | "readExecutionContext" | "proposePatch" | "interrupt" | "dispose">;
suite("Execution coordinator actual backend", () => {
  let directory: string; let source: string; let storage: string; let repository: SqliteProjectRepository; let taskId: string;
  let shared: ExecutionCoordinator | undefined;
  let requests: number; let dirty: boolean; let loseAcknowledgment: boolean; let desiredWindow: "30" | "45";
  const createClient = (): Client => ({
    connect: () => Promise.resolve({ kind: "ready", authType: "unknown" }),
    readExecutionContext: () => Promise.resolve({ observedAt: new Date().toISOString(), model: { kind: "resolved-default", model: "fixture-model" }, usage: { kind: "unknown" } }),
    proposePatch: input => {
      requests++; input.onThreadMetadata?.({ model: "fixture-model", modelProvider: "openai" }); input.onThreadStarted?.("fixture-thread");
      if (loseAcknowledgment) throw new Error("Fixture lost acknowledgment");
      input.onTurnStarted?.("fixture-thread", "fixture-turn");
      const prompt: unknown = JSON.parse(input.prompt);
      assert.ok(typeof prompt === "object" && prompt !== null && "files" in prompt && Array.isArray(prompt.files));
      const first: unknown = prompt.files[0]; assert.ok(typeof first === "object" && first !== null && "baseline" in first);
      const baseline = first.baseline; assert.ok(typeof baseline === "object" && baseline !== null && "fileId" in baseline && typeof baseline.fileId === "string");
      return Promise.resolve({ status: "completed", threadId: "fixture-thread", turnId: "fixture-turn", output: { summary: `Change refund window to ${desiredWindow} days`, operations: [{ fileId: baseline.fileId, content: `${desiredWindow}\n` }] } });
    }, interrupt: () => Promise.resolve(), dispose: () => undefined,
  });
  const coordinator = () => shared ??= new ExecutionCoordinator({ confirmSpending: () => Promise.resolve("consent"), repository, storageDirectory: storage, createClient, publish: () => undefined, hasDirtyDocuments: () => dirty });
  const prepare = () => coordinator().prepare({ taskId, relativePaths: ["refund.txt"], objective: "Set refund window to 45 days", criteria: [{ criterionId: "days", text: "Window is 45 days" }], checks: [{ checkId: "value", argv: [nodeExecutable, "-e", "require('node:assert/strict').equal(require('node:fs').readFileSync('refund.txt','utf8'),'45\\n')"], criterionIds: ["days"] }] });
  setup(async () => {
    shared = undefined; requests = 0; dirty = false; loseAcknowledgment = false; desiredWindow = "45";
    directory = mkdtempSync(path.join(tmpdir(), "piarre-coordinator-")); source = path.join(directory, "source"); storage = path.join(directory, "storage"); mkdirSync(source); mkdirSync(storage);
    writeFileSync(path.join(source, "refund.txt"), "30\n"); writeFileSync(path.join(source, "private.txt"), "private undisclosed");
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite")); const project = repository.open({ repositoryUri: pathToFileURL(source).href, name: "Fixture" });
    const draft = await new GoalInterpreter().propose("Implement refund policy"); repository.dispatch({ commandId: "proposal", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "propose-tasks", draft } });
    const first = repository.read().tasks[0]; assert.ok(first); taskId = first.taskId;
  });
  teardown(() => { shared?.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true }); });
  test("Stop All runs during native candidate publication, retains the lease and cannot start a check", async () => {
    let checksStarted = false;
    let stopCompletion: Promise<void> | undefined;
    const control = new ExecutionCoordinator({ repository, storageDirectory: storage, createClient, confirmSpending: () => Promise.resolve("consent"),
      createRunner: () => ({ capability: () => Promise.resolve({ kind: "unsupported", reason: "Fixture must stop before checking" }), interrupt: () => Promise.resolve({ kind: "not-running" }), run: () => { checksStarted = true; throw new Error("Stopped publication cannot start a check"); } }),
      publish: snapshot => {
        if (!stopCompletion && snapshot.executionRuns.some(run => run.state.kind === "applying")) {
          stopCompletion = new Promise<void>((resolve, reject) => setImmediate(() => {
            try {
              const run = repository.read().executionRuns.at(-1); assert.ok(run);
              assert.equal(run.state.kind, "applying"); assert.equal(ownsExecutionLease(run), true);
              void control.stopAll().then(resolve, reject);
            } catch (error) { reject(error instanceof Error ? error : new Error("Control callback failed")); }
          }));
        }
      },
    });
    shared = control;
    const prepared = await control.prepare({ taskId, relativePaths: ["refund.txt"], objective: "Responsive publication", criteria: [{ criterionId: "days", text: "45 days" }], checks: [{ checkId: "never", argv: [nodeExecutable, "-e", "process.exit(0)"], criterionIds: ["days"] }] });
    const result = await control.approveAndRun({ planId: prepared.plan.planId, planRevision: prepared.plan.recordedAtRevision, approvalId: "stop-native-publication" });
    assert.ok(stopCompletion); await stopCompletion;
    assert.equal(repository.read().schedulingPaused, true); assert.equal(checksStarted, false);
    assert.equal(result.state.kind, "unknown"); assert.equal(ownsExecutionLease(result), true);
    assert.equal(requests, 1);
    assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n");
  });
  for (const acceptBeforeCorrection of [false, true]) {
    test(`confirmed correction replaces ${acceptBeforeCorrection ? "accepted" : "unaccepted"} 30-day evidence through fresh 45-day approval`, async function () {
      this.timeout(8000);
      if ((await new CandidateCheckRunner().capability()).kind === "unsupported") { this.skip(); return; }
      let sequence = 0;
      const send = (action: ProjectCommand["action"]) => {
        const snapshot = repository.read();
        return repository.dispatch({ commandId: `correction-journey-${String(++sequence)}`, projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision, action });
      };
      writeFileSync(path.join(source, "refund.txt"), "15\n");
      let snapshot = repository.read();
      send({ kind: "observe-knowledge", topic: "Refund window", category: "business", affectedTaskIds: [taskId], submitted: { projectId: snapshot.projectId, requestId: "rule-30", contextRevision: snapshot.revision, originalStatement: "Refunds are allowed for 30 days." } });
      let knowledge = currentKnowledge(repository.read())[0]; assert.ok(knowledge);
      send({ kind: "confirm-knowledge", target: { projectId: knowledge.projectId, knowledgeId: knowledge.knowledgeId, recordedAtRevision: knowledge.recordedAtRevision } });
      knowledge = currentKnowledge(repository.read())[0]; assert.ok(knowledge); const originalKnowledgeRevision = knowledge.recordedAtRevision;
      const control = coordinator();
      const prepareRule = (days: "30" | "45") => control.prepare({ taskId, relativePaths: ["refund.txt"], objective: `Apply the confirmed ${days}-day refund rule`, criteria: [{ criterionId: `window-${days}`, text: `Refund window is ${days} days` }],
        checks: [{ checkId: `check-${days}`, argv: [nodeExecutable, "-e", `require('node:assert/strict').equal(require('node:fs').readFileSync('refund.txt','utf8'),${JSON.stringify(`${days}\n`)})`], criterionIds: [`window-${days}`] }] });
      desiredWindow = "30"; const before = await prepareRule("30");
      const oldRun = await control.approveAndRun({ planId: before.plan.planId, planRevision: before.plan.recordedAtRevision, approvalId: "approve-rule-30" });
      assert.equal(oldRun.state.kind, "terminal"); assert.equal(oldRun.state.result.outcome, "needs-review");
      assert.equal(oldRun.evidence[0]?.kind, "passed"); assert.equal(oldRun.evidence[0].manifestHash, oldRun.state.result.manifestHash);
      assert.equal(oldRun.grant.plan.knowledge[0]?.recordedAtRevision, originalKnowledgeRevision);
      const oldReview = control.reviewResult(oldRun.runId).binding;
      if (acceptBeforeCorrection) await control.confirmResult(oldReview);
      assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), acceptBeforeCorrection ? "30\n" : "15\n");
      assert.equal(planFreshness(repository.read(), before.plan), "current");
      snapshot = repository.read();
      send({ kind: "correct-knowledge", target: { projectId: knowledge.projectId, knowledgeId: knowledge.knowledgeId, recordedAtRevision: knowledge.recordedAtRevision }, submitted: { projectId: snapshot.projectId, requestId: "correct-to-45", contextRevision: snapshot.revision, originalStatement: "Refunds are allowed for 45 days." }, affectedTaskIds: [taskId] });
      const corrected = currentKnowledge(repository.read())[0]; assert.ok(corrected); assert.equal(corrected.standing.kind, "confirmed"); assert.ok(corrected.recordedAtRevision > originalKnowledgeRevision);
      assert.equal(planFreshness(repository.read(), before.plan), "stale");
      const historical = renderExecutionResult(repository.read(), oldRun.runId);
      assert.match(historical, /Historical evidence: Passed scoped checks/); assert.doesNotMatch(historical, /data-execution-action="apply-accept"/);
      await assert.rejects(control.approveAndRun({ planId: before.plan.planId, planRevision: before.plan.recordedAtRevision, approvalId: "reuse-stale-approval" }));
      if (!acceptBeforeCorrection) await assert.rejects(control.confirmResult(oldReview));
      assert.equal(requests, 1);
      desiredWindow = "45"; const after = await prepareRule("45");
      assert.equal(after.plan.knowledge[0]?.recordedAtRevision, corrected.recordedAtRevision);
      assert.equal(requests, 1, "Preparing the corrected plan cannot start generation");
      const newRun = await control.approveAndRun({ planId: after.plan.planId, planRevision: after.plan.recordedAtRevision, approvalId: "approve-rule-45" });
      assert.equal(newRun.state.kind, "terminal"); assert.equal(newRun.state.result.outcome, "needs-review"); assert.equal(requests, 2);
      assert.notEqual(newRun.state.result.resultId, oldRun.state.result.resultId);
      assert.deepEqual(newRun.evidence[0]?.criterionIds, ["window-45"]); assert.equal(newRun.evidence[0].kind, "passed");
      assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), acceptBeforeCorrection ? "30\n" : "15\n", "Fresh passing evidence alone does not apply changes");
      await assert.rejects(control.confirmResult({ ...control.reviewResult(newRun.runId).binding, resultId: oldRun.state.result.resultId, resultRevision: oldRun.state.result.recordedAtRevision }));
      const accepted = await control.confirmResult(control.reviewResult(newRun.runId).binding);
      assert.equal(accepted.acceptance.kind, "accepted"); assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "45\n");
      if (acceptBeforeCorrection) await control.confirmResult(oldReview);
      assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "45\n", "Replaying old review cannot restore obsolete behavior");
      const durable = repository.read(); control.dispose(); shared = undefined; repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
      assert.deepEqual(repository.read(), durable); assert.match(renderExecutionResult(repository.read(), oldRun.runId), /Historical evidence/);
    });
  }
  for (const route of ["apiKey", "chatgpt"] as const) test(`configured ${route} scenario is shown in native consent and retained unchanged in SQLite result`, async () => {
    const now = Date.now(); const accountHash = "b".repeat(64);
    const sample: CalibrationSample = { kind: "reviewed-v1", sampleId: "isolated", provider: "codex", accountHash, plan: "plus", model: "fixture-model", profile: { kind: "named", effort: "medium" }, serviceTier: "default", contextMethod: "serialized-prompt-utf8-v1", contextBand: "up-to-16KiB", bucketId: "codex", durationMins: 90, before: { observedAt: now - 120000, resetsAt: Math.floor(now / 1000) + 3600, usedPercent: 10 }, after: { observedAt: now - 60000, resetsAt: Math.floor(now / 1000) + 3600, usedPercent: 12 }, tokensUsed: 8000, attribution: "reviewed-isolated", provenance: "User-reviewed isolated fixture" };
    const billing = route === "apiKey" ? { kind: "api", name: "Configured API", inputUsdPerMillion: 2, outputUsdPerMillion: 8 } as const : { kind: "subscription", name: "plus", samples: [sample] } as const;
    const configuration: ProviderConfiguration = { kind: "valid", selections: [{ role: "coding", provider: "codex", model: "fixture-model", billing }] };
    let disclosure = ""; let count = 0;
    const context = (): CodexExecutionContext => ({ observedAt: new Date().toISOString(), authType: route, model: { kind: "resolved-default", model: "fixture-model" }, modelProfiles: [{ model: "fixture-model", defaultEffort: "medium", supportedEfforts: ["medium"] }], facts: { accountHash, planType: "plus", bucketId: "codex", ordinaryUsageAllowed: true }, usage: { kind: "observed", source: "account/rateLimits/read", windows: [{ source: "primary", usedPercent: 23, windowDurationMins: 90, resetsAt: Math.floor(now / 1000) + 3600 }] } });
    const control = new ExecutionCoordinator({ repository, storageDirectory: storage, publish: () => undefined, readProviderConfiguration: () => configuration, confirmSpending: detail => { disclosure = detail; return Promise.resolve("consent"); }, createClient: () => ({ ...createClient(), connect: () => Promise.resolve({ kind: "ready", authType: route }), readExecutionContext: () => Promise.resolve(context()), proposePatch: input => {
      count++; assert.equal(input.serviceTierForTurn, "default"); assert.equal(input.effort, "medium");
      input.onThreadMetadata?.({ model: "fixture-model", modelProvider: "openai", reasoningEffort: "medium", serviceTier: "fast" }); input.onThreadStarted?.("thread"); input.onTurnStarted?.("thread", "turn"); return Promise.resolve({ threadId: "thread", turnId: "turn", status: "completed", output: { summary: "No change", operations: [] } });
    } }) });
    const { plan } = await control.prepare({ taskId, relativePaths: ["refund.txt"], objective: "Inspect", criteria: [{ criterionId: "criterion", text: "Inspect" }], checks: [], maxTokens: 16000 });
    assert.equal(plan.forecast.kind, "configured-v1"); assert.equal(plan.forecast.estimate.kind, route === "apiKey" ? "api" : "subscription");
    if (plan.forecast.estimate.kind === "subscription") assert.equal(plan.forecast.estimate.windows[0]?.kind, "scenario");
    const frozen = JSON.stringify(plan.forecast);
    const run = await control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: `consent-${route}` });
    assert.equal(count, 1); assert.equal(run.state.kind, "terminal"); assert.equal(run.state.result.outcome, "no-change"); assert.equal(run.grant.spendingConsent?.kind, "native-uncertain-one-attempt"); assert.equal(run.accountObservations.length, 2);
    assert.equal(JSON.stringify(run.grant.plan.forecast), frozen); assert.match(disclosure, /No monetary cap/); assert.match(disclosure, /provider has no supported per-turn included-only/); assert.match(disclosure, /Exact files: refund.txt/);
    if (route === "apiKey") assert.match(disclosure, /0.032.*0.128/); else assert.match(disclosure, /4 to 4 percentage points/);
    const rendered = renderExecutionResult(repository.read(), run.runId); assert.match(rendered, /Actual per-task cost and isolated allowance consumption remain unknown/); assert.match(rendered, /inherited thread tier fast/);
    const snapshot = repository.read(); control.dispose(); repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite")); assert.deepEqual(repository.read(), snapshot);
  });
  for (const change of ["cancel", "configuration", "account", "reset", "pause", "dirty", "model-profile"] as const) test(`native spending review refuses ${change} before any generation request`, async () => {
    let reviewed = false; let generated = 0;
    const now = Date.now(); let config: ProviderConfiguration = { kind: "valid", selections: [] };
    const observed = (): CodexExecutionContext => ({ observedAt: new Date().toISOString(), authType: "chatgpt", model: { kind: "resolved-default", model: "fixture-model" }, modelProfiles: reviewed && change === "model-profile" ? [{ model: "fixture-model", defaultEffort: "high", supportedEfforts: ["high"] }] : [], facts: { accountHash: (reviewed && change === "account" ? "c" : "b").repeat(64), planType: "plus", bucketId: "codex", ordinaryUsageAllowed: true }, usage: { kind: "observed", source: "account/rateLimits/read", windows: [{ source: "primary", usedPercent: 23, windowDurationMins: 90, resetsAt: Math.floor(now / 1000) + (reviewed && change === "reset" ? 120 : 60) }] } });
    const control = new ExecutionCoordinator({ repository, storageDirectory: storage, publish: () => undefined, hasDirtyDocuments: () => dirty, readProviderConfiguration: () => config, confirmSpending: detail => {
      assert.match(detail, /attempt run:review/); reviewed = true;
      if (change === "configuration") config = { kind: "valid", selections: [{ role: "coding", provider: "codex", model: "fixture-model", billing: { kind: "api", name: "changed", inputUsdPerMillion: 1, outputUsdPerMillion: 1 } }] };
      if (change === "pause") void control.stopAll();
      if (change === "dirty") dirty = true;
      return Promise.resolve(change === "cancel" ? "cancel" : "consent");
    }, createClient: () => ({ ...createClient(), connect: () => Promise.resolve({ kind: "ready", authType: "chatgpt" }), readExecutionContext: () => Promise.resolve(observed()), proposePatch: () => { generated++; return Promise.reject(new Error("Must not generate")); } }) });
    const { plan } = await control.prepare({ taskId, relativePaths: ["refund.txt"], objective: "Inspect", criteria: [{ criterionId: "criterion", text: "Inspect" }], checks: [] });
    await assert.rejects(control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "review" }));
    assert.equal(reviewed, true); assert.equal(generated, 0); assert.equal(repository.read().executionRuns.length, 0); control.dispose();
  });
  test("configuration changes after thread capability await cannot submit generation", async () => {
    let count = 0; let changed = false;
    const config = (): ProviderConfiguration => ({ kind: "valid", selections: changed ? [{ role: "coding", provider: "codex", model: "fixture-model", billing: { kind: "api", name: "different-tier-provenance", inputUsdPerMillion: 1, outputUsdPerMillion: 1 } }] : [] });
    const control = new ExecutionCoordinator({ repository, storageDirectory: storage, publish: () => undefined, readProviderConfiguration: config, confirmSpending: () => Promise.resolve("consent"), createClient: () => ({ ...createClient(), proposePatch: input => {
      assert.equal(input.serviceTierForTurn, "default"); input.onThreadMetadata?.({ model: "fixture-model", modelProvider: "openai" }); changed = true; input.onThreadStarted?.("thread"); count++; return Promise.reject(new Error("Must not request turn"));
    } }) });
    const { plan } = await control.prepare({ taskId, relativePaths: ["refund.txt"], objective: "Inspect", criteria: [{ criterionId: "criterion", text: "Inspect" }], checks: [] });
    const run = await control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "boundary" }); assert.equal(count, 0); assert.equal(run.state.kind, "terminal"); control.dispose();
  });
  test("missing default model requires an explicit selection before persisting approval scope", async () => {
    const control = new ExecutionCoordinator({ confirmSpending: () => Promise.resolve("consent"), repository, storageDirectory: storage, publish: () => undefined,
      createClient: () => ({ ...createClient(), readExecutionContext: () => Promise.resolve({ observedAt: new Date().toISOString(), model: { kind: "unknown" }, usage: { kind: "unknown" } }) }) });
    const input: Parameters<ExecutionCoordinator["prepare"]>[0] = { taskId, relativePaths: ["refund.txt"], objective: "45 days", criteria: [{ criterionId: "days", text: "45 days" }], checks: [{ checkId: "value", argv: [nodeExecutable, "--version"], criterionIds: ["days"] }] };
    await assert.rejects(control.prepare(input), /explicit coding model/);
    assert.equal(repository.read().executionPlans.length, 0); assert.equal(requests, 0);
    const prepared = await control.prepare({ ...input, requestedModel: "fixture-model" });
    assert.equal(prepared.plan.provider.requestedModel, "fixture-model");
    assert.equal(prepared.plan.accountContext.model.kind, "unknown");
    assert.equal(requests, 0);
  });
  test("provider model mismatch is recorded without starting a turn or applying source", async () => {
    let turnStarted = false;
    const control = new ExecutionCoordinator({ confirmSpending: () => Promise.resolve("consent"), repository, storageDirectory: storage, publish: () => undefined,
      createClient: () => ({ ...createClient(), proposePatch: input => {
        input.onThreadMetadata?.({ model: "different-model", modelProvider: "openai" });
        turnStarted = true; return Promise.reject(new Error("Generation must not start"));
      } }) });
    const { plan } = await control.prepare({ taskId, relativePaths: ["refund.txt"], objective: "45 days", criteria: [{ criterionId: "days", text: "45 days" }], checks: [] });
    const run = await control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "mismatch" });
    assert.equal(turnStarted, false); assert.equal(run.providerObservation.kind, "unobserved");
    assert.equal(run.state.kind, "terminal"); assert.match(run.state.result.summary, /differs from the approved plan/);
    assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n");
  });
  test("preparation generates nothing; manual edits and dirty buffers block approval", async () => {
    const prepared = await prepare(); assert.equal(requests, 0);
    dirty = true;
    await assert.rejects(coordinator().approveAndRun({ planId: prepared.plan.planId, planRevision: prepared.plan.recordedAtRevision, approvalId: "dirty" }), /dirty/);
    dirty = false; writeFileSync(path.join(source, "refund.txt"), "manual edit");
    await assert.rejects(coordinator().approveAndRun({ planId: prepared.plan.planId, planRevision: prepared.plan.recordedAtRevision, approvalId: "manual" }), /changed/);
    assert.equal(requests, 0); assert.equal(repository.read().executionRuns.length, 0);
  });
  test("lost acknowledgment retains ownership across restart and blocks replacement requests", async () => {
    const { plan } = await prepare(); loseAcknowledgment = true;
    const input = { planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "lost" };
    const control = coordinator(); const run = await control.approveAndRun(input);
    assert.equal(requests, 1); assert.equal(run.state.kind, "unknown");
    assert.equal(ownsExecutionLease(run), true);
    assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n");
    control.dispose(); shared = undefined; repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    const recovered = coordinator(); await recovered.reconcile();
    assert.equal(repository.read().executionRuns[0]?.state.kind, "unknown");
    await recovered.approveAndRun(input); assert.equal(requests, 1);
    await assert.rejects(recovered.approveAndRun({ ...input, approvalId: "replacement" }));
    assert.equal(requests, 1);
    await assert.rejects(recovered.approveAndRun({ ...input, planRevision: 1 }), /conflicts/);
    const resolved = recovered.abandonProvider({ runId: run.runId, reason: "Explicit fixture review acknowledges possible continuing provider usage." });
    assert.equal(resolved.providerOutcome.kind, "abandoned"); assert.equal(resolved.state.kind, "terminal");
    assert.equal(resolved.state.result.outcome, "unknown"); assert.equal(ownsExecutionLease(resolved), false);
    assert.match(resolved.state.result.summary, /Remote activity and charges may continue/);
    assert.throws(() => recovered.abandonProvider({ runId: run.runId, reason: "Repeated consent" }));
    const fresh = await prepare();
    const replacement = await recovered.approveAndRun({ planId: fresh.plan.planId, planRevision: fresh.plan.recordedAtRevision, approvalId: "explicit-replacement" });
    assert.equal(requests, 2); assert.equal(replacement.state.kind, "unknown");
  });
  test("real sandbox checks gate review, integration preserves source until approval, restore protects newer bytes", async function () {
    if ((await new CandidateCheckRunner().capability()).kind === "unsupported") { this.skip(); return; }
    const control = coordinator(); const { plan } = await control.prepare({ taskId, relativePaths: ["refund.txt"], objective: "45 days", criteria: [{ criterionId: "days", text: "45 days" }], checks: [{ checkId: "value", argv: [nodeExecutable, "-e", "require('node:assert/strict').equal(require('node:fs').readFileSync('refund.txt','utf8'),'45\\n')"], criterionIds: ["days"] }] });
    const input = { planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "approved" };
    const run = await control.approveAndRun(input); assert.equal(run.state.kind, "terminal");
    assert.equal(run.state.result.outcome, "needs-review"); assert.equal(run.evidence[0]?.kind, "passed");
    assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n"); assert.equal(control.inspection({ runId: run.runId }).diff.length, 1);
    await control.approveAndRun(input); assert.equal(requests, 1);
    const review = control.reviewResult(run.runId).binding;
    assert.equal((await control.confirmResult(review)).acceptance.kind, "accepted"); assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "45\n");
    writeFileSync(path.join(source, "refund.txt"), "new manual work");
    await control.confirmResult(review); assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "new manual work");
    const preview = await control.previewRecovery({ runId: run.runId, selection: { kind: "snapshot", target: "source", versionId: `before:${review.operationId}` } });
    const restored = await control.recover({ previewId: preview.previewId, intendedPaths: ["refund.txt"], operationId: "restore" });
    const preserved = control.savedVersions(run.runId).versions.find(version => version.version.versionId === "preserved:restore");
    assert.equal(preserved?.kind, "available"); assert.equal(preserved.images[0]?.content, "new manual work");
    assert.equal(restored.reviewFreshness.kind, "stale"); assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n");
    assert.equal(readFileSync(path.join(source, "private.txt"), "utf8"), "private undisclosed");
  });
  test("stop reaches the real running watchdog and records interruption without passing evidence", async function () {
    if ((await new CandidateCheckRunner().capability()).kind === "unsupported") { this.skip(); return; }
    let requestedStop = false;
    const control = new ExecutionCoordinator({ confirmSpending: () => Promise.resolve("consent"), repository, storageDirectory: storage, createClient,
      publish: snapshot => {
        const running = snapshot.executionRuns.find(run => run.process.kind === "running");
        if (running && !requestedStop) { requestedStop = true; queueMicrotask(() => { void control.stop({ runId: running.runId }); }); }
      } });
    const { plan } = await control.prepare({ taskId, relativePaths: ["refund.txt"], objective: "45 days", durationMs: 5000,
      criteria: [{ criterionId: "days", text: "45 days" }], checks: [{ checkId: "wait", argv: [nodeExecutable, "-e", "setTimeout(()=>{},30000)"], criterionIds: ["days"] }] });
    const run = await control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "stop" });
    assert.equal(requestedStop, true); assert.equal(run.state.kind, "terminal");
    assert.equal(run.state.result.outcome, "failed"); assert.equal(run.evidence[0]?.kind, "failed");
    assert.equal(run.evidence[0].termination, "observed"); assert.equal(run.process.kind, "none");
    assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n");
  });
  test("candidate edits after a real passing check invalidate review and block integration", async function () {
    if ((await new CandidateCheckRunner().capability()).kind === "unsupported") { this.skip(); return; }
    const control = coordinator(); const { plan } = await prepare();
    const run = await control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "stale" });
    assert.equal(run.state.kind, "terminal"); assert.equal(run.state.result.outcome, "needs-review");
    const review = control.reviewResult(run.runId).binding;
    writeFileSync(path.join(control.candidateForRun(run.runId).root, "refund.txt"), "unverified manual candidate edit");
    control.refreshWorkspaceFreshness();
    assert.equal(repository.read().executionRuns[0]?.reviewFreshness.kind, "stale");
    await assert.rejects(control.confirmResult(review), /changed/);
    assert.equal(readFileSync(path.join(source, "refund.txt"), "utf8"), "30\n");
  });
  test("disposal persists uncertain ownership and late provider rejection does not access a closed database", async () => {
    let rejectTurn: (error: Error) => void = () => undefined;
    let started: () => void = () => undefined;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const pending = new Promise<never>((_, reject) => { rejectTurn = reject; });
    const control = new ExecutionCoordinator({ confirmSpending: () => Promise.resolve("consent"), repository, storageDirectory: storage, publish: () => undefined,
      createClient: () => ({ ...createClient(), proposePatch: input => { input.onThreadMetadata?.({ model: "fixture-model", modelProvider: "openai" }); input.onThreadStarted?.("pending-thread"); started(); return pending; }, dispose: () => { rejectTurn(new Error("Disposed provider")); } }) });
    const { plan } = await control.prepare({ taskId, relativePaths: ["refund.txt"], objective: "45 days", criteria: [{ criterionId: "days", text: "45 days" }], checks: [] });
    const completion = control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "disposing" });
    await ready; control.dispose();
    const before = repository.read(); assert.equal(before.executionRuns[0]?.state.kind, "unknown");
    repository.close();
    const run = await completion; assert.equal(run.state.kind, "unknown");
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    assert.deepEqual(repository.read(), before);
    await coordinator().reconcile();
    assert.equal(repository.read().executionRuns[0]?.state.kind, "unknown");
    assert.equal(repository.read().executionRuns.some(ownsExecutionLease), true);
    assert.equal(requests, 0);
  });
  test("a throwing provider disposer still interrupts the runner and makes retirement terminal", async () => {
    let rejectTurn: (error: Error) => void = () => {};
    let started = () => {};
    const ready = new Promise<void>(resolve => { started = resolve; });
    const pending = new Promise<never>((_, reject) => { rejectTurn = reject; });
    let disposals = 0;
    let interrupts = 0;
    const control = new ExecutionCoordinator({ confirmSpending: () => Promise.resolve("consent"), repository, storageDirectory: storage, publish: () => undefined,
      createRunner: () => ({ capability: () => Promise.resolve({ kind: "unsupported", reason: "Fixture only" }), interrupt: () => { interrupts++; throw new Error("Runner interruption failed"); }, run: () => { throw new Error("No check should start"); } }),
      createClient: () => ({ ...createClient(), proposePatch: input => { input.onThreadMetadata?.({ model: "fixture-model", modelProvider: "openai" }); input.onThreadStarted?.("pending-thread"); started(); return pending; }, dispose: () => { disposals++; throw new Error("Provider dispose failed"); } }) });
    const { plan } = await control.prepare({ taskId, relativePaths: ["refund.txt"], objective: "45 days", criteria: [{ criterionId: "days", text: "45 days" }], checks: [] });
    const completion = control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "disposing-failure" });
    await ready;
    try {
      assert.throws(() => { control.dispose(); });
      assert.equal(interrupts, 1, "the runner must still receive an interrupt after the client throws");
      assert.equal(disposals, 1);
      const before = repository.read();
      assert.equal(before.executionRuns[0]?.state.kind, "unknown");
      repository.close();
      assert.throws(() => { control.resume(); }, /disposed/);
      control.dispose();
      rejectTurn(new Error("Late provider rejection"));
      assert.equal((await completion).state.kind, "unknown");
      assert.equal(disposals, 1);
      repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
      assert.deepEqual(repository.read(), before);
      await coordinator().reconcile();
      assert.ok(repository.read().executionRuns.some(ownsExecutionLease));
    } finally { rejectTurn(new Error("End fixture")); await completion.catch(() => undefined); }
  });
  test("pause survives restart and blocks a prepared approval", async () => {
    const { plan } = await prepare(); await coordinator().stopAll(); shared?.dispose(); shared = undefined; repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    assert.equal(repository.read().schedulingPaused, true);
    await assert.rejects(coordinator().approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: "paused" })); assert.equal(requests, 0);
    coordinator().resume(); assert.equal(repository.read().schedulingPaused, false);
  });
});
