import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderReflection, reflectionArtifactPath, reflectionDrift, type ExecutionPlan, type ReflectionAction, type Reflection } from "../../../../packages/core/src/index.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";

suite("Optional record-backed reflection", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  let sequence = 0;
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-reflection-"));
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    repository.open({ repositoryUri: `file://${directory}`, name: "Reflection test" });
  });
  teardown(() => { repository.close(); rmSync(directory, { recursive: true, force: true }); });
  const dispatch = (action: ReflectionAction) => {
    const project = repository.read();
    return repository.dispatch({ commandId: `c${String(++sequence)}`, projectId: project.projectId, expectedProjectRevision: project.revision, action });
  };
  const latest = (): Reflection => { const item = repository.read().reflections.at(-1); if (!item) throw new Error("Missing reflection"); return item; };
  const render = () => renderReflection(repository.read(latest().sourceRevision), latest(), repository.read().explanationPreference);

  test("pending reflection recovers from actual SQLite reopening without scheduling or granting work", () => {
    const before = repository.read(); dispatch({ kind: "offer-reflection" });
    const pending = repository.read(); repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    assert.deepEqual(repository.read(), pending); assert.equal(latest().status, "pending");
    assert.deepEqual(pending.executionRuns, before.executionRuns); assert.deepEqual(pending.tasks, before.tasks);
    assert.equal(pending.schedulingPaused, before.schedulingPaused);
    assert.deepEqual(pending.knowledge, before.knowledge);
  });

  test("decline is immediately terminal for reflection while work remains unchanged", () => {
    dispatch({ kind: "offer-reflection" }); const before = repository.read();
    dispatch({ kind: "resolve-reflection", reflectionId: latest().reflectionId, resolution: "declined" });
    assert.equal(latest().status, "declined");
    assert.deepEqual(repository.read().executionRuns, before.executionRuns);
    assert.deepEqual(repository.read().executionPlans, before.executionPlans);
    assert.equal(repository.read().schedulingPaused, before.schedulingPaused);
    assert.throws(() => dispatch({ kind: "correct-reflection", reflectionId: latest().reflectionId, feedback: "Late edit" }));
  });

  test("feedback corrections remain attributed proposals and cannot confirm policy or knowledge", () => {
    dispatch({ kind: "offer-reflection" }); const id = latest().reflectionId;
    dispatch({ kind: "correct-reflection", reflectionId: id, feedback: "The work was not completed." });
    const earlier = repository.read();
    dispatch({ kind: "correct-reflection", reflectionId: id, feedback: "Explain decisions with more detail next time." });
    assert.deepEqual(latest().feedback, ["The work was not completed.", "Explain decisions with more detail next time."]);
    assert.deepEqual(repository.read(earlier.revision), earlier);
    assert.match(render(), /unverified/); assert.match(render(), /Proposed improvement/);
    assert.deepEqual(repository.read().knowledge, []); assert.equal(repository.read().explanationPreference, "default");
    assert.deepEqual(readdirSync(directory).filter(name => name !== "project.sqlite"), []);
  });

  test("preference is optional, inspectable, reversible, and scoped to explanatory detail", () => {
    assert.equal(repository.read().explanationPreference, "default"); dispatch({ kind: "offer-reflection" });
    dispatch({ kind: "set-explanation-preference", preference: "guided" }); assert.match(render(), /Explanation preference: guided/);
    dispatch({ kind: "set-explanation-preference", preference: "brief" }); assert.match(render(), /Explanation preference: brief/);
    dispatch({ kind: "set-explanation-preference", preference: "default" }); assert.equal(repository.read().explanationPreference, "default");
    dispatch({ kind: "set-expertise-preference", preference: "learning" }); assert.equal(repository.read().expertisePreference, "learning");
    dispatch({ kind: "set-expertise-preference", preference: "familiar" }); assert.equal(repository.read().expertisePreference, "familiar");
    dispatch({ kind: "set-expertise-preference", preference: "unspecified" }); assert.equal(repository.read().expertisePreference, "unspecified");
    assert.equal(repository.read().executionRuns.length, 0);
  });

  test("source revision and exact decision text survive later correction without silently upgrading authority", () => {
    const knowledge = (text: string, target?: { projectId: string; knowledgeId: string; recordedAtRevision: number }) => {
      const project = repository.read();
      repository.dispatch({ commandId: `k${String(++sequence)}`, projectId: project.projectId, expectedProjectRevision: project.revision,
        action: target ? { kind: "correct-knowledge", target, submitted: { requestId: `s${String(sequence)}`, projectId: project.projectId, contextRevision: project.revision, originalStatement: text }, affectedTaskIds: [] }
          : { kind: "observe-knowledge", category: "decision", topic: "Retention", submitted: { requestId: `s${String(sequence)}`, projectId: project.projectId, contextRevision: project.revision, originalStatement: text }, affectedTaskIds: [] } });
    };
    knowledge("30 days");
    const entry = repository.read().knowledge.at(-1); assert.ok(entry);
    const project = repository.read();
    repository.dispatch({ commandId: `confirm${String(++sequence)}`, projectId: project.projectId, expectedProjectRevision: project.revision,
      action: { kind: "confirm-knowledge", target: { projectId: project.projectId, knowledgeId: entry.knowledgeId, recordedAtRevision: entry.recordedAtRevision } } });
    dispatch({ kind: "offer-reflection" }); const original = render();
    const confirmed = repository.read().knowledge.at(-1); assert.ok(confirmed);
    knowledge("45 days", { projectId: confirmed.projectId, knowledgeId: confirmed.knowledgeId, recordedAtRevision: confirmed.recordedAtRevision });
    assert.equal(render(), original);
    assert.match(reflectionDrift(repository.read(latest().sourceRevision), repository.read()).join("\n"), /Knowledge .* changed after source revision/);
    assert.match(render(), /30 days/); assert.doesNotMatch(render(), /45 days/);
    assert.match(render(), /Later corrections, superseded plans/);
    assert.match(render(), new RegExp(`source-knowledge-${encodeURIComponent(entry.knowledgeId)}`));
    assert.throws(() => renderReflection(repository.read(), latest(), "default"));
  });

  test("malformed or authority-expanding commands and double offers fail atomically", () => {
    dispatch({ kind: "offer-reflection" }); const before = repository.read();
    assert.throws(() => dispatch({ kind: "offer-reflection" }));
    for (const action of [
      { kind: "resolve-reflection", reflectionId: latest().reflectionId, resolution: "approved" },
      { kind: "correct-reflection", reflectionId: latest().reflectionId, feedback: "Policy", apply: true },
      { kind: "set-explanation-preference", preference: "expert" },
    ]) assert.throws(() => repository.dispatch({ commandId: `bad${String(++sequence)}`, projectId: before.projectId, expectedProjectRevision: before.revision, action }));
    assert.deepEqual(repository.read(), before);
  });

  test("review closes proposal without applying it and keeps its export convention stable", () => {
    dispatch({ kind: "offer-reflection" }); const artifact = reflectionArtifactPath(latest());
    dispatch({ kind: "resolve-reflection", reflectionId: latest().reflectionId, resolution: "reviewed" });
    assert.equal(latest().status, "reviewed"); assert.equal(reflectionArtifactPath(latest()), artifact);
    assert.match(artifact, /^\.artifacts\/sessions\/reflection%3A[^/]+\/reflection\.md$/);
    assert.match(render(), /no repository file was written/);
    assert.match(render(), /Save As/);
    dispatch({ kind: "offer-reflection" }); assert.notEqual(reflectionArtifactPath(latest()), artifact);
  });

  test("superseded plans are flagged without rewriting their historical source", () => {
    const plan: ExecutionPlan = { taskId: "fixture-task", planId: "old-plan", recordedAtRevision: 1, objective: "Refund policy",
      criteria: [{ criterionId: "refund", text: "Correct refunds" }], knowledge: [], files: [], checks: [],
      candidateRoot: "/tmp/reflection-candidate", controlDirectory: "/tmp/reflection-control", captureHash: "a".repeat(64),
      baselineCheckpoint: { checkpointId: "before-run", manifestHash: "a".repeat(64) }, sourceRoot: "/tmp/reflection-source",
      provider: { kind: "codex-readonly-patch", authType: "unknown", requestedModel: "fixture-model" },
      forecast: { kind: "legacy-unknown" }, accountContext: { observedAt: "2026-11-02T00:00:00.000Z", model: { kind: "resolved-default", model: "fixture-model" }, usage: { kind: "unknown" } },
      durationMs: 120_000, maxTokens: 4000 };
    const source = { ...repository.read(), executionPlans: [plan] };
    const current = { ...source, executionPlans: [plan, { ...plan, planId: "new-plan", recordedAtRevision: 2 }] };
    assert.match(reflectionDrift(source, current).join("\n"), /Plan old-plan .* was superseded/);
    assert.equal(source.executionPlans[0]?.planId, "old-plan");
  });

  test("stale actions cannot overwrite current preferences and replayed command IDs are idempotent", () => {
    const project = repository.read();
    const command = { commandId: "one-offer", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "offer-reflection" } };
    assert.equal(repository.dispatch(command).kind, "applied"); assert.equal(repository.dispatch(command).kind, "duplicate");
    assert.equal(repository.dispatch({ commandId: "stale", projectId: project.projectId, expectedProjectRevision: project.revision,
      action: { kind: "set-explanation-preference", preference: "guided" } }).kind, "stale");
    assert.equal(repository.read().explanationPreference, "default"); assert.equal(repository.read().reflections.length, 1);
  });
});
