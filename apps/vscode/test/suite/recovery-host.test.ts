import { forecastFixture, consentFixture } from "./forecast-fixture.js";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as vscode from "vscode";
import { ownsExecutionLease, type ExecutionPlanDraft, type ProjectCommand } from "../../../../packages/core/src/index.js";
import { parsePatchProposal } from "../../../../packages/core/src/execution-patch.js";
import { CandidateWorkspace } from "../../src/candidate-workspace.js";
import { ExecutionCoordinator } from "../../src/execution-coordinator.js";
import { ExecutionUi } from "../../src/execution-ui.js";
import type { RecoveryDialogs } from "../../src/recovery-ui.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { WorkView } from "../../src/work-view.js";

// Prepared real Host journeys. Provider work never occurs. Only native user decisions are
// fixtures; the Webview bridge, production ExecutionUi, SQLite, snapshots and Unix helper run.
suite("Production recovery UI through the actual Webview bridge", () => {
  for (const scenario of ["cancel", "stale", "mixed-restore"] as const) {
    test(`${scenario} requires exact native disclosure and preserves current work`, async function () {
      this.timeout(20_000);
      const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "piarre-recovery-host-")));
      const source = path.join(directory, "source"); const storage = path.join(directory, "storage"); mkdirSync(source); mkdirSync(storage);
      writeFileSync(path.join(source, "a.txt"), "original a"); writeFileSync(path.join(source, "b.txt"), "original b");
      const repository = new SqliteProjectRepository(path.join(directory, "project.sqlite")); repository.open({ repositoryUri: pathToFileURL(source).href, name: "Native recovery fixture" });
      let sequence = 0;
      const send = (action: ProjectCommand["action"]) => { const project = repository.read(); return repository.dispatch({ commandId: `fixture-${String(++sequence)}`, projectId: project.projectId, expectedProjectRevision: project.revision, action }); };
      send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose("Recover scoped files") }); const task = repository.read().tasks[0]; assert.ok(task);
      const candidate = CandidateWorkspace.capture({ repositoryRoot: source, storageDirectory: storage, relativePaths: ["a.txt", "b.txt"] });
      const draft: ExecutionPlanDraft = { taskId: task.taskId, objective: "Recovery native fixture", criteria: [{ criterionId: "files", text: "Recover files" }], knowledge: [], files: candidate.files.map(file => file.baseline), checks: [], candidateRoot: candidate.root, controlDirectory: candidate.controlDirectory, captureHash: candidate.captureHash, baselineCheckpoint: candidate.checkpoint({ checkpointId: "baseline" }), sourceRoot: source, provider: { kind: "codex-readonly-patch", authType: "unknown", requestedModel: "fixture" }, accountContext: { observedAt: new Date().toISOString(), model: { kind: "unknown" }, usage: { kind: "unknown" } }, forecast: forecastFixture(), durationMs: 120_000, maxTokens: 1000 };
      send({ kind: "prepare-execution-plan", plan: draft }); const plan = repository.read().executionPlans[0]; assert.ok(plan); const runId = "run:native-recovery";
      send({ kind: "approve-execution", spendingConsent: consentFixture(plan, runId), planId: plan.planId, planRevision: plan.recordedAtRevision, runId, ownerPid: 2147483647, ownerId: "departed-host", approvedAt: 1000, expiresAt: 120_000 });
      await candidate.apply({ commandId: `patch:${runId}`, proposal: parsePatchProposal({ files: plan.files, value: { summary: "Partial fixture", operations: candidate.files.map(file => ({ fileId: file.baseline.fileId, content: `intended ${file.baseline.relativePath}` })) } }), afterStep: () => { throw new Error("fixture interruption"); } });
      writeFileSync(path.join(candidate.root, "b.txt"), "manual b"); send({ kind: "mark-execution-unknown", runId, reason: "Partial patch needs review" });
      const nativePayloads: string[] = []; let restoring = false; let versionId: string | undefined;
      const dialogs: RecoveryDialogs = {
        inspect: (title, content) => { nativePayloads.push(`${title}\n${content}`); return Promise.resolve(); },
        choose: items => { assert.ok(versionId); assert.ok(items.some(item => item.id === versionId && item.detail.includes("available"))); return Promise.resolve(versionId); },
        review: (message, detail, choices) => {
          nativePayloads.push(`${message}\n${detail}`);
          if (message === "Review scoped recovery") {
            assert.equal(choices[0], "Keep current files"); assert.match(detail, /CURRENT[\s\S]*INTENDED/); assert.match(detail, /a\.txt/); assert.match(detail, /b\.txt/); assert.match(detail, /Permissions: 0644/); assert.match(detail, /All files default to Keep current/); assert.match(detail, /Earlier checks and acceptance become historical/);
            if (!restoring) { assert.match(detail, /manual b/); assert.match(detail, /intended b\.txt/); }
            return Promise.resolve(scenario === "cancel" ? "Cancel" : "Review planned changes");
          }
          if (message.startsWith("Recovery choice:")) { assert.equal(choices[0], "Keep current"); return Promise.resolve(message.endsWith("b.txt") ? "Use intended" : "Keep current"); }
          assert.equal(message, "Approve this recovery resolution?"); assert.match(detail, /KEEP CURRENT[\s\S]*a\.txt/); assert.match(detail, /USE INTENDED[\s\S]*b\.txt/); assert.match(detail, /preserved:/);
          if (scenario === "stale") writeFileSync(path.join(candidate.root, "b.txt"), "changed during native consent");
          return Promise.resolve("Approve recovery");
        },
      };
      let reviewPanel: vscode.WebviewPanel | undefined;
      const coordinator = new ExecutionCoordinator({ repository, storageDirectory: storage, createClient: () => { throw new Error("Recovery cannot call a provider"); }, publish: snapshot => { view.update(snapshot); } });
      const ui = new ExecutionUi(coordinator, () => repository.read(), id => { view.openExecutionResult(id); }, dialogs);
      let handled: (() => void) | undefined;
      const view = new WorkView((...args) => { const panel = vscode.window.createWebviewPanel(...args); if (args[0] === "piarre.execution") reviewPanel = panel; return panel; }, undefined, undefined, undefined,
        { handle: async (message, origin) => { await ui.handle(message, origin); handled?.(); }, renderDetails: id => ui.renderDetails(id) });
      const click = async (action: "recover" | "saved-versions") => {
        assert.ok(reviewPanel); assert.match(reviewPanel.webview.html, new RegExp(`data-execution-action="${action}"`));
        let timer: ReturnType<typeof setTimeout> | undefined;
        const result = new Promise<void>((resolve, reject) => { handled = resolve; timer = setTimeout(() => { reject(new Error("Actual Webview recovery action timed out")); }, 8000); });
        reviewPanel.webview.html = reviewPanel.webview.html.replace("</script>", `document.querySelector('[data-execution-action="${action}"]').click();</script>`);
        try { await result; } finally { clearTimeout(timer); handled = undefined; }
      };
      try {
        view.show(repository.read()); view.openExecutionResult(runId);
        await click("recover");
        const run = repository.read().executionRuns[0]; assert.ok(run);
        if (scenario === "mixed-restore") {
          assert.equal(run.recoveries[0]?.state.kind, "completed"); assert.equal(run.reviewFreshness.kind, "stale"); assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "intended b.txt");
          versionId = run.savedVersions.find(version => version.purpose === "preserved-before-recovery")?.versionId; assert.ok(versionId);
          writeFileSync(path.join(candidate.root, "b.txt"), "newer user work"); restoring = true;
          await click("saved-versions");
          assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), "manual b");
          const preserved = coordinator.savedVersions(runId).versions.filter(version => version.version.purpose === "preserved-before-recovery").at(-1);
          assert.equal(preserved?.kind, "available"); assert.equal(preserved.images[1]?.content, "newer user work");
        } else {
          assert.equal(run.recoveries.length, 0); assert.equal(ownsExecutionLease(run), true);
          assert.equal(readFileSync(path.join(candidate.root, "b.txt"), "utf8"), scenario === "stale" ? "changed during native consent" : "manual b");
          if (scenario === "stale") assert.ok(nativePayloads.some(payload => /Recovery needs review[\s\S]*stale/.test(payload)));
        }
        assert.ok(nativePayloads.some(payload => payload.startsWith("Full scoped recovery preview")));
      } finally { ui.dispose(); view.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true }); }
    });
  }
});
