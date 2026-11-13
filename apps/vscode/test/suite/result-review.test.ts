import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import { ExecutionCoordinator } from "../../src/execution-coordinator.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { ExecutionUi } from "../../src/execution-ui.js";
import { WorkView } from "../../src/work-view.js";
import { resultDialogs } from "./result-review-vscode.js";
import { resultFixture } from "./result-review-fixture.js";

suite("Result confirmation idempotence", () => {
  for (const integrated of [true, false]) test(`exact ${integrated ? "recovered" : "publish"} replay preserves later bytes and stale acceptance projection`, async () => {
    const fixture = await resultFixture(integrated);
    try {
      const { control, repository, runId, candidate, source } = fixture;
      const { binding } = control.reviewResult(runId);
      await control.confirmResult(binding);
      writeFileSync(path.join(source, "review.txt"), "newer manual work");
      control.refreshWorkspaceFreshness();
      const before = repository.read();
      assert.equal(before.executionRuns[0]?.acceptance.kind, "unreviewed");
      assert.equal(before.executionRuns[0].reviewFreshness.kind, "stale");
      const files = readdirSync(candidate.controlDirectory, { recursive: true });
      control.dispose(); repository.close();
      const reopened = new SqliteProjectRepository(fixture.databasePath);
      const restarted = new ExecutionCoordinator({ repository: reopened, storageDirectory: fixture.storage, createClient: () => { throw new Error("No provider"); }, publish: () => {} });
      try {
        const replayed = await restarted.confirmResult(binding);
        assert.equal(replayed.acceptance.kind, "unreviewed");
        assert.deepEqual(reopened.read(), before);
      } finally { restarted.dispose(); reopened.close(); }
      assert.deepEqual(readdirSync(candidate.controlDirectory, { recursive: true }), files);
      assert.equal(readFileSync(path.join(source, "review.txt"), "utf8"), "newer manual work");
    } finally { fixture.dispose(); }
  });
});

suite("Result acceptance through the actual Webview and native confirmation", () => {
  for (const scenario of ["accept", "cancel", "source drift", "candidate drift", "dirty editor", "check corruption", "plan drift", "result corruption", "disposed", "fresh accept", "fresh check corruption"] as const) test(`${scenario} during native result review`, async function () {
    this.timeout(20_000);
    const integrated = !scenario.startsWith("fresh");
    const fixture = await resultFixture(integrated);
    const { repository, control, runId, candidate, source } = fixture;
    const before = repository.read();
    assert.equal(before.executionRuns[0]?.workspace.kind, integrated ? "integrated" : "not-integrated");
    assert.equal(before.executionRuns[0].acceptance.kind, "unreviewed");
    assert.equal(readFileSync(path.join(source, "review.txt"), "utf8"), integrated ? "reviewed\n" : "original\n");
    const filesBefore = readdirSync(candidate.controlDirectory, { recursive: true });
    let panel: vscode.WebviewPanel | undefined;
    let handled = () => {};
    const payloads: string[] = [];
    resultDialogs.warning = (message, options, ...choices) => {
      payloads.push(`${message}\n${options?.detail ?? ""}`);
      if (choices.length) {
        if (scenario === "source drift") writeFileSync(path.join(source, "review.txt"), "new source work");
        if (scenario === "candidate drift") writeFileSync(path.join(candidate.root, "review.txt"), "new candidate work");
        if (scenario === "dirty editor") fixture.dirty.value = true;
        if (scenario === "check corruption" || scenario === "fresh check corruption" || scenario === "result corruption") {
          const read = repository.read.bind(repository);
          repository.read = revision => {
            const project = read(revision);
            return { ...project, executionRuns: project.executionRuns.map(run => run.state.kind !== "terminal" ? run : { ...run, state: { ...run.state, result: { ...run.state.result, ...(scenario === "result corruption" ? { resultId: "replaced-result" } : { checks: run.state.result.checks.map(check => ({ ...check, stdout: "replaced check output with the same files" })) }) } } }) };
          };
        }
        if (scenario === "plan drift") {
          const plan = before.executionPlans[0]; assert.ok(plan);
          const replacement = { ...plan, objective: "A replacement plan" };
          Reflect.deleteProperty(replacement, "planId"); Reflect.deleteProperty(replacement, "recordedAtRevision");
          fixture.send({ kind: "prepare-execution-plan", plan: replacement });
        }
        if (scenario === "disposed") ui.dispose();
      }
      return Promise.resolve(scenario === "cancel" ? undefined : choices[0]);
    };
    const ui = new ExecutionUi(control, () => repository.read(), id => { view.openExecutionResult(id); });
    const view = new WorkView((...args) => { const created = vscode.window.createWebviewPanel(...args); if (args[0] === "piarre.execution") panel = created; return created; }, undefined, undefined, undefined,
      { handle: async message => { await ui.handle(message); handled(); }, renderDetails: id => ui.renderDetails(id) });
    try {
      view.show(repository.read()); view.openExecutionResult(runId); assert.ok(panel);
      assert.match(panel.webview.html, integrated ? /Accept current result/ : /Apply and accept/);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const clicked = new Promise<void>((resolve, reject) => { handled = resolve; timer = setTimeout(() => { reject(new Error("Rendered acceptance action timed out")); }, 8000); });
      panel.webview.html = panel.webview.html.replace("</script>", `document.querySelector('[data-execution-action="apply-accept"]').click();</script>`);
      try { await clicked; } finally { clearTimeout(timer); }
      const after = repository.read();
      assert.equal(after.executionRuns[0]?.acceptance.kind, scenario === "accept" || scenario === "fresh accept" ? "accepted" : "unreviewed", payloads.join("\n"));
      assert.match(payloads[0] ?? "", integrated ? /^Accept this integrated result\?/ : /^Apply and accept this result\?/);
      if (scenario !== "fresh accept") {
        assert.deepEqual(readdirSync(candidate.controlDirectory, { recursive: true }), filesBefore);
        assert.deepEqual(after.executionRuns[0].savedVersions, before.executionRuns[0].savedVersions);
      }
      assert.equal(after.revision, before.revision + (scenario === "fresh accept" ? 3 : scenario === "accept" || scenario === "plan drift" ? 1 : 0));
      assert.equal(readFileSync(path.join(source, "review.txt"), "utf8"), scenario === "source drift" ? "new source work" : scenario === "fresh check corruption" ? "original\n" : "reviewed\n");
      assert.equal(readFileSync(path.join(candidate.root, "review.txt"), "utf8"), scenario === "candidate drift" ? "new candidate work" : "reviewed\n");
      if (scenario === "check corruption" || scenario === "fresh check corruption") assert.match(payloads.join("\n"), /checks.*changed/);
    } finally { resultDialogs.warning = undefined; ui.dispose(); view.dispose(); fixture.dispose(); }
  });
});


suite("Result confirmation SQLite races", () => {
  for (const integrated of [true, false]) test(`parallel ${integrated ? "recovered" : "publish"} confirmations have one acceptance and one source publication`, async () => {
    const fixture = await resultFixture(integrated);
    const second = new SqliteProjectRepository(fixture.databasePath);
    const other = new ExecutionCoordinator({ repository: second, storageDirectory: fixture.storage, createClient: () => { throw new Error("No provider"); }, publish: () => {} });
    try {
      const first = fixture.control.reviewResult(fixture.runId).binding;
      const next = other.reviewResult(fixture.runId).binding;
      const outcomes = await Promise.allSettled([fixture.control.confirmResult(first), other.confirmResult(next)]);
      assert.equal(outcomes.filter(outcome => outcome.status === "fulfilled").length, integrated ? 2 : 1);
      const { snapshot, events } = fixture.repository.readDiagnosticSnapshot();
      assert.equal(snapshot.executionRuns[0]?.acceptance.kind, "accepted");
      assert.equal(events.filter(event => event.kind === "execution-recorded" && event.action.kind === "accept-execution-result").length, 1);
      assert.equal(events.filter(event => event.kind === "execution-recorded" && event.action.kind === "begin-workspace-operation").length, 1);
      assert.equal(snapshot.executionRuns[0].savedVersions.filter(version => version.purpose === "before-integration").length, 1);
      assert.equal(readdirSync(fixture.candidate.controlDirectory).filter(file => file.startsWith("integration-journal-")).length, 1);
      assert.equal(readFileSync(path.join(fixture.source, "review.txt"), "utf8"), "reviewed\n");
    } finally { other.dispose(); second.close(); fixture.dispose(); }
  });

  test("a publish dialog cannot become acceptance-only after another coordinator integrates", async () => {
    const fixture = await resultFixture(false);
    const second = new SqliteProjectRepository(fixture.databasePath);
    const other = new ExecutionCoordinator({ repository: second, storageDirectory: fixture.storage, createClient: () => { throw new Error("No provider"); }, publish: () => {} });
    try {
      const binding = fixture.control.reviewResult(fixture.runId).binding;
      await other.confirmResult(other.reviewResult(fixture.runId).binding);
      const before = fixture.repository.read();
      await assert.rejects(fixture.control.confirmResult(binding), /mode changed/);
      assert.deepEqual(fixture.repository.read(), before);
    } finally { other.dispose(); second.close(); fixture.dispose(); }
  });

  test("the acceptance dispatch keeps the revision captured before its last filesystem validation", async () => {
    const fixture = await resultFixture();
    const second = new SqliteProjectRepository(fixture.databasePath);
    let validations = 0;
    const control = new ExecutionCoordinator({ repository: fixture.repository, storageDirectory: fixture.storage, createClient: () => { throw new Error("No provider"); }, publish: () => {},
      hasDirtyDocuments: () => {
        if (++validations === 2) {
          const project = second.read();
          assert.equal(second.dispatch({ commandId: "racing-pause", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "set-scheduling-paused", paused: true } }).kind, "applied");
        }
        return false;
      } });
    try {
      const binding = fixture.control.reviewResult(fixture.runId).binding;
      await assert.rejects(control.confirmResult(binding), /stale/);
      assert.equal(fixture.repository.read().executionRuns[0]?.acceptance.kind, "unreviewed");
    } finally { control.dispose(); second.close(); fixture.dispose(); }
  });
});
