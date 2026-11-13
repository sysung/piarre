import * as vscode from "vscode";
import { detailControls, renderDetailDocument } from "../../src/detail-document.js";
import { ExecutionCoordinator } from "../../src/execution-coordinator.js";
import { setImmediate as nextTurn } from "node:timers/promises";
import { ExecutionUi } from "../../src/execution-ui.js";
import { resultDialogs } from "./result-review-vscode.js";
import { consentFixture } from "./forecast-fixture.js";
import assert from "node:assert/strict";
import { WorkView } from "../../src/work-view.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { resultFixture } from "./result-review-fixture.js";
import { DetailHost } from "./detail-host-fixture.js";

suite("Detail documents through the actual Webview", () => {
  test("equal-looking proposals have separate documents and reject a captured old delete click", async function () {
    this.timeout(20_000);
    const fixture = await resultFixture();
    fixture.send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose("Same goal") });
    fixture.send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose("Same goal") });
    const project = fixture.repository.read();
    const first = project.proposals.at(-2); const second = project.proposals.at(-1); assert.ok(first && second);
    const host = new DetailHost(); let prompts = 0;
    const view = new WorkView(host.createPanel, { prepare: async goal => new GoalInterpreter().propose(goal), save: () => {}, deleteProposal: () => { throw new Error("Unexpected deletion"); } }, () => { prompts++; return Promise.resolve(false); });
    try {
      view.show(project); view.openProposal(first.groupId);
      host.hold = true;
      const captured = await host.click("#delete-goal"); assert.ok(captured);
      const original = host.panel().webview.html;
      view.openProposal(second.groupId);
      assert.notEqual(host.panel().webview.html, original, "Equal-looking records must not reuse the previous document");
      host.hold = false;
      await host.command({ operation: "post", payload: captured });
      assert.equal(prompts, 0, "An old rendered click cannot prompt for the new selection");
    } finally { view.dispose(); fixture.dispose(); }
  });
  test("a current run document cannot request a global action or another target", async function () {
    this.timeout(20_000);
    const fixture = await resultFixture(); const host = new DetailHost(); const actions: unknown[] = [];
    const view = new WorkView(host.createPanel, undefined, undefined, undefined, { handle: message => { actions.push(message); return Promise.resolve(); } });
    try {
      view.show(fixture.repository.read()); view.openExecutionResult(fixture.runId);
      host.hold = true;
      const captured = await host.click('[data-execution-action="saved-versions"]', "piarre.execution"); assert.ok(captured && typeof captured === "object");
      host.hold = false;
      await host.command({ operation: "post", payload: { ...captured, controlKey: "unrendered-current-document-control" } }, "piarre.execution");
      await host.command({ operation: "post", payload: { ...captured, action: "pause-all" } }, "piarre.execution");
      await host.command({ operation: "post", payload: { ...captured, id: "unrelated-run" } }, "piarre.execution");
      await host.command({ operation: "post", payload: { kind: "execution", action: "pause-all" } }, "piarre.execution");
      assert.deepEqual(actions, [], "Only controls rendered by this host document may originate actions");
      await host.command({ operation: "post", payload: captured }, "piarre.execution");
      assert.deepEqual(actions, [{ kind: "execution", action: "saved-versions", id: fixture.runId }]);
    } finally { view.dispose(); fixture.dispose(); }
  });

  for (const change of ["another run", "away and back", "closed pane", "unrelated progress"] as const) test(`result confirmation stays with its selection during ${change}`, async function () {
    this.timeout(20_000);
    const fixture = await resultFixture(); await secondRun(fixture);
    const host = new DetailHost(); let complete = () => {};
    const finished = new Promise<void>(resolve => { complete = resolve; });
    let prompts = 0; let extra = "";
    let answer: (choice: string | undefined) => void = () => {};
    const response = new Promise<string | undefined>(resolve => { answer = resolve; });
    const ui = new ExecutionUi(fixture.control, () => fixture.repository.read(), id => { view.openExecutionResult(id); });
    const view = new WorkView(host.createPanel, undefined, undefined, undefined, {
      handle: async (message, origin) => { try { await ui.handle(message, origin); } finally { complete(); } }, renderDetails: id => ui.renderDetails(id) + extra,
    });
    resultDialogs.warning = async (message, options, ...choices) => {
      prompts++; assert.equal(options?.modal, true); assert.equal(message, "Accept this integrated result?"); assert.deepEqual(choices, ["Accept current result"]);
      return response;
    };
    try {
      view.show(fixture.repository.read()); view.openExecutionResult(fixture.runId);
      await host.click('[data-execution-action="apply-accept"]', "piarre.execution");
      if (change === "closed pane") host.panel("piarre.execution").dispose();
      else if (change === "unrelated progress") {
        const document = host.panel("piarre.execution").webview.html.match(/script nonce="([^"]+)"/)?.[1];
        assert.ok(document); extra = "<p>Unrelated progress observation</p>";
        fixture.send({ kind: "rename-project", name: "Unrelated update" }); view.update(fixture.repository.read());
        assert.notEqual(host.panel("piarre.execution").webview.html.match(/script nonce="([^"]+)"/)?.[1], document);
      } else { view.openExecutionResult("other-run"); if (change === "away and back") view.openExecutionResult(fixture.runId); }
      answer("Accept current result"); await finished;
      assert.equal(prompts, 1);
      assert.equal(fixture.repository.read().executionRuns[0]?.acceptance.kind, change === "unrelated progress" ? "accepted" : "unreviewed");
      if (change === "another run") assert.match(host.panel("piarre.execution").webview.html, /other-run/);
    } finally { resultDialogs.warning = undefined; view.dispose(); ui.dispose(); fixture.dispose(); }
  });

  test("proposal confirmation retains its target and revision, and positive deletion keeps history", async function () {
    this.timeout(20_000);
    const fixture = await resultFixture();
    for (const goal of ["Delete this goal", "Keep this goal"]) fixture.send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose(goal) });
    const before = fixture.repository.read(); const target = before.proposals.at(-2); const other = before.proposals.at(-1); assert.ok(target && other);
    const host = new DetailHost(); let prompts = 0; let answer: (value: boolean) => void = () => {};
    const view = new WorkView(host.createPanel, { prepare: async goal => new GoalInterpreter().propose(goal), save: () => {},
      deleteProposal: (project, groupId, commandId) => {
        const result = fixture.repository.dispatch({ commandId, projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "delete-proposal", groupId } });
        return result.kind === "applied" ? result.snapshot : undefined;
      },
    }, async goal => { assert.equal(goal, "Delete this goal"); prompts++; return new Promise(resolve => { answer = resolve; }); });
    try {
      view.show(before); view.openProposal(target.groupId);
      const selected = await host.command({ operation: "inspect" }, "piarre.work"); assert.ok(selected && typeof selected === "object" && "selectedProposal" in selected); assert.equal(selected.selectedProposal, target.groupId);
      await host.click("#delete-goal"); view.openProposal(other.groupId); view.openProposal(target.groupId); answer(true); await nextTurn();
      assert.deepEqual(fixture.repository.read(), before);
      host.panel().dispose();
      const closed = await host.command({ operation: "inspect" }, "piarre.work"); assert.ok(closed && typeof closed === "object" && !("selectedProposal" in closed));
      view.openProposal(target.groupId);
      await host.click("#delete-goal"); answer(false); await nextTurn(); assert.deepEqual(fixture.repository.read(), before);
      await host.click("#delete-goal"); answer(true); await nextTurn();
      assert.equal(prompts, 3);
      assert.equal(fixture.repository.read().proposals.some(item => item.groupId === target.groupId), false);
      assert.equal(fixture.repository.read().proposals.some(item => item.groupId === other.groupId), true);
      assert.equal(fixture.repository.read(before.revision).proposals.some(item => item.groupId === target.groupId), true);
    } finally { view.dispose(); fixture.dispose(); }
  });

  test("replaced run documents and a reopened project reject captured clicks", async function () {
    this.timeout(20_000);
    const fixture = await resultFixture(); const host = new DetailHost(); const actions: unknown[] = [];
    let extra = "";
    const view = new WorkView(host.createPanel, undefined, undefined, undefined, { handle: message => { actions.push(message); return Promise.resolve(); }, renderDetails: () => extra });
    try {
      view.show(fixture.repository.read()); view.openExecutionResult(fixture.runId); host.hold = true;
      const old = await host.click('[data-execution-action="saved-versions"]', "piarre.execution");
      extra = "<p>Current file observation</p>"; view.update(fixture.repository.read()); host.hold = false;
      await host.command({ operation: "post", payload: old }, "piarre.execution"); assert.deepEqual(actions, []);
      host.hold = true; const priorInstance = await host.click('[data-execution-action="saved-versions"]', "piarre.execution");
      view.detachProject(); view.show(fixture.repository.read()); view.openExecutionResult(fixture.runId); host.hold = false;
      await host.command({ operation: "post", payload: priorInstance }, "piarre.execution"); assert.deepEqual(actions, []);
      await host.click('[data-execution-action="saved-versions"]', "piarre.execution"); assert.equal(actions.length, 1);
    } finally { view.dispose(); fixture.dispose(); }
  });

  test("same proposal keeps stable disclosure, focus and scroll while another record resets them", async function () {
    this.timeout(20_000);
    const fixture = await resultFixture();
    for (const goal of ["Read this proposal", "Read another proposal"]) fixture.send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose(goal) });
    let project = fixture.repository.read(); const group = project.proposals.at(-2); const other = project.proposals.at(-1); assert.ok(group && other);
    const host = new DetailHost(); const view = new WorkView(host.createPanel);
    try {
      view.show(project); view.openProposal(group.groupId);
      const taskId = group.taskIds[0]; assert.ok(taskId);
      await host.command({ operation: "reading", selector: `[data-review-key="task:${taskId}"]`, scroll: 180 });
      const before = await host.command({ operation: "inspect" }); assert.ok(before && typeof before === "object" && "scroll" in before && Number(before.scroll) > 0);
      project = { ...project, tasks: project.tasks.map(task => task.taskId === taskId ? { ...task, title: "Changed title with the same task identity" } : task) };
      view.update(project);
      const after = await host.command({ operation: "inspect" }); assert.ok(after && typeof after === "object" && "open" in after && "active" in after && "scroll" in after);
      assert.deepEqual(after.open, [`task:${taskId}`]); assert.match(String(after.active), /Changed title/); assert.equal(after.scroll, before.scroll); assertNativeFocus(before); assertNativeFocus(after);
      assert.match(host.panel().webview.html, /prefers-reduced-motion:reduce/);
      view.openProposal(other.groupId);
      const reset = await host.command({ operation: "inspect" }); assert.ok(reset && typeof reset === "object" && "open" in reset && "scroll" in reset);
      assert.deepEqual(reset.open, []); assert.equal(reset.scroll, 0); assertNativeFocus(reset);
    } finally { view.dispose(); fixture.dispose(); }
  });

  test("run refresh retains file and check disclosures and action focus", async function () {
    this.timeout(20_000);
    const fixture = await resultFixture(); const host = new DetailHost(); let extra = "";
    const ui = new ExecutionUi(fixture.control, () => fixture.repository.read(), () => {});
    const view = new WorkView(host.createPanel, undefined, undefined, undefined, { handle: async () => {}, renderDetails: id => ui.renderDetails(id) + extra });
    try {
      view.show(fixture.repository.read()); view.openExecutionResult(fixture.runId);
      await host.command({ operation: "reading", selector: '[data-review-key="file:review.txt"]', scroll: 180 }, "piarre.execution");
      await host.command({ operation: "reading", selector: '[data-review-key="check:content:check-nonce"]', scroll: 180 }, "piarre.execution");
      await host.command({ operation: "reading", selector: '[data-execution-action="saved-versions"]', scroll: 180 }, "piarre.execution");
      const prior = await host.command({ operation: "inspect" }, "piarre.execution");
      assert.ok(prior && typeof prior === "object" && "active" in prior); assert.match(String(prior.active), /saved-versions/, JSON.stringify(prior)); assertNativeFocus(prior);
      extra = "<p>Updated unrelated observation</p>"; view.update(fixture.repository.read());
      const state = await host.command({ operation: "inspect" }, "piarre.execution"); assert.ok(state && typeof state === "object" && "open" in state && "active" in state && "scroll" in state);
      assert.deepEqual(state.open, ["check:content:check-nonce", "file:review.txt"]); assert.match(String(state.active), /saved-versions/, JSON.stringify({prior,state})); assert.equal(state.scroll, 180); assertNativeFocus(state);
    } finally { view.dispose(); ui.dispose(); fixture.dispose(); }
  });

  for (const boundary of ["input", "preparation metadata", "approval metadata", "spending", "final metadata", "authorized work"] as const) test(`steering rechecks selection at ${boundary}`, async function () {
    this.timeout(20_000);
    const fixture = await resultFixture(); await secondRun(fixture);
    const before = fixture.repository.read(); const host = new DetailHost(); let observations = 0; let requests = 0; let spending = 0; let plans = 0;
    let complete = () => {}; const finished = new Promise<void>(resolve => { complete = resolve; });
    const navigate = () => { view.openExecutionResult("other-run"); view.openExecutionResult(fixture.runId); };
    const context = () => ({ observedAt: new Date().toISOString(), model: { kind: "resolved-default" as const, model: "fixture" }, usage: { kind: "unknown" as const } });
    const coordinator = new ExecutionCoordinator({ repository: fixture.repository, storageDirectory: fixture.storage, publish: snapshot => { view.update(snapshot); },
      createClient: () => ({
        connect: () => Promise.resolve({ kind: "ready", authType: "unknown" }),
        readExecutionContext: () => {
          observations++;
          if (boundary === "preparation metadata" && observations === 1 || boundary === "approval metadata" && observations === 2 || boundary === "final metadata" && observations === 3) navigate();
          return Promise.resolve(context());
        },
        proposePatch: input => {
          requests++; if (boundary === "authorized work") navigate();
          input.onThreadMetadata?.({ model: "fixture", modelProvider: "openai" }); input.onBeforeTurnStart?.(context()); input.onThreadStarted?.("thread"); input.onTurnStarted?.("thread", "turn");
          return Promise.resolve({ status: "completed", threadId: "thread", turnId: "turn", output: { summary: "No changes", operations: [] } });
        }, interrupt: async () => {}, dispose: () => {},
      }),
      createRunner: () => ({ capability: () => Promise.resolve({ kind: "supported", sandbox: "macos-seatbelt-single-process", reads: "all-readable-local-files", writes: "candidate-only", network: "denied", childProcesses: "denied", maxOutputBytes: 64000, maxDurationMs: 120000, probeExecutable: "/usr/bin/true" }), run: () => { throw new Error("No-change fixture cannot run checks"); }, interrupt: () => Promise.resolve({ kind: "not-running" }) }),
      confirmSpending: detail => { spending++; assert.match(detail, /Exact files: review.txt/); assert.match(detail, /This exact attempt may consume allowance or incur charges/); if (boundary === "spending") navigate(); return Promise.resolve("consent"); },
    });
    const ui = new ExecutionUi(coordinator, () => fixture.repository.read(), id => { view.openExecutionResult(id); });
    const view = new WorkView(host.createPanel, undefined, undefined, undefined, { handle: async (message, origin) => { try { await ui.handle(message, origin); } finally { complete(); } }, renderDetails: id => ui.renderDetails(id) });
    resultDialogs.input = options => { if (boundary === "input") navigate(); assert.equal(options.ignoreFocusOut, true); return Promise.resolve(options.prompt?.startsWith("Exact") ? "review.txt" : '[["/usr/bin/true"]]'); };
    resultDialogs.warning = (message, options, ...choices) => {
      assert.equal(message, "Review scoped agent work"); assert.equal(options?.modal, true); assert.match(options.detail ?? "", /Shared and candidate-writable files/); assert.deepEqual(choices, ["Approve and run", "Edit plan"]); plans++; return Promise.resolve(choices[0]);
    };
    try {
      view.show(before); view.openExecutionResult(fixture.runId);
      await host.click('[data-execution-action="steer"]', "piarre.execution"); await finished;
      const after = fixture.repository.read();
      assert.equal(after.executionRuns.length, before.executionRuns.length + (boundary === "authorized work" ? 1 : 0));
      assert.equal(requests, boundary === "authorized work" ? 1 : 0);
      assert.equal(after.executionPlans.length, before.executionPlans.length + (["input", "preparation metadata"].includes(boundary) ? 0 : 1));
      assert.equal(spending, ["spending", "final metadata", "authorized work"].includes(boundary) ? 1 : 0);
      assert.equal(plans, ["input", "preparation metadata"].includes(boundary) ? 0 : 1);
      if (boundary === "authorized work") { const run = after.executionRuns.at(-1); assert.ok(run?.state.kind === "terminal"); assert.equal(run.state.result.outcome, "no-change"); }
    } finally { resultDialogs.input = undefined; resultDialogs.warning = undefined; view.dispose(); ui.dispose(); fixture.dispose(); }
  });

  test("repeated controls retain their exact region and occurrence focus", async function () {
    this.timeout(15_000);
    const host = new DetailHost(); const panel = host.createPanel("piarre.execution", "Repeated detail controls", vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] });
    const render = (suffix: string) => {
      const controls = detailControls<{ action: string }>();
      const button = (region: string, label: string) => `<button ${controls.attributes({ action: "inspect" }, region)}>${label}</button>`;
      return renderDetailDocument("fixture-record", `<section>${button("first", "First")}${button("first", "Second")}</section><section>${button("second", "Third")}</section><p>${suffix}</p>`, "", controls.controls).html;
    };
    try {
      panel.webview.html = render("Before refresh");
      for (const [selector, label] of [["section:first-child button:nth-child(2)", "Second"], ["section:nth-child(2) button", "Third"]] as const) {
        await host.command({ operation: "reading", selector }, "piarre.execution");
        const before = await host.command({ operation: "inspect" }, "piarre.execution");
        panel.webview.html = render(`Refresh ${selector}`);
        const after = await host.command({ operation: "inspect" }, "piarre.execution");
        assert.ok(before && after && typeof before === "object" && typeof after === "object" && "active" in before && "active" in after);
        assert.match(String(before.active), new RegExp(`^<button[^>]+>${label}</button>$`));
        assert.equal(after.active, before.active); assertNativeFocus(before); assertNativeFocus(after);
      }
    } finally { panel.dispose(); }
  });

  for (const change of ["review", "final confirmation", "after reservation"] as const) test(`recovery retains its selection at ${change}`, async function () {
    this.timeout(20_000);
    const fixture = await resultFixture(); await secondRun(fixture); const host = new DetailHost();
    const before = fixture.repository.read(); let complete = () => {}; const finished = new Promise<void>(resolve => { complete = resolve; }); let results = 0;
    const navigate = () => { view.openExecutionResult("other-run"); };
    const coordinator = new ExecutionCoordinator({ repository: fixture.repository, storageDirectory: fixture.storage, createClient: () => { throw new Error("Recovery never connects a provider"); }, publish: snapshot => {
      view.update(snapshot); if (change === "after reservation" && snapshot.executionRuns[0]?.recoveries.some(item => item.state.kind === "writing")) navigate();
    } });
    const dialogs = {
      inspect: (_title: string, _content: string, current?: () => boolean) => { assert.equal(current?.(), true); return Promise.resolve(); },
      choose: () => Promise.resolve(undefined),
      review: (message: string, detail: string, choices: readonly string[]) => {
        if (message === "Review scoped recovery") { assert.equal(choices[0], "Keep current files"); assert.match(detail, /All files default to Keep current/); if (change === "review") navigate(); return Promise.resolve("Keep current files"); }
        assert.equal(message, "Approve this recovery resolution?"); assert.equal(choices[0], "Approve recovery"); assert.match(detail, /KEEP CURRENT/); if (change === "final confirmation") navigate(); return Promise.resolve("Approve recovery");
      },
    };
    const ui = new ExecutionUi(coordinator, () => fixture.repository.read(), id => { results++; view.openExecutionResult(id); }, dialogs);
    const view = new WorkView(host.createPanel, undefined, undefined, undefined, { handle: async (message, origin) => { try { await ui.handle(message, origin); } finally { complete(); } }, renderDetails: id => ui.renderDetails(id) });
    try {
      view.show(before); view.openExecutionResult(fixture.runId); await host.click('[data-execution-action="restore-source"]', "piarre.execution"); await finished;
      assert.equal(fixture.repository.read().executionRuns[0]?.recoveries.length, change === "after reservation" ? 1 : 0);
      if (change === "after reservation") assert.equal(fixture.repository.read().executionRuns[0]?.recoveries[0]?.state.kind, "completed");
      else assert.deepEqual(fixture.repository.read(), before);
      assert.equal(results, 0, "Finishing or cancelling an old review cannot take focus from the current selection");
      assert.match(host.panel("piarre.execution").webview.html, /other-run/);
    } finally { view.dispose(); ui.dispose(); fixture.dispose(); }
  });

  test("result reservation rechecks origin after its asynchronous entry", async () => {
    const fixture = await resultFixture(false);
    try {
      let current = true; const before = fixture.repository.read();
      const confirmation = fixture.control.confirmResult(fixture.control.reviewResult(fixture.runId).binding, () => current);
      current = false;
      await assert.rejects(confirmation, /selected detail changed/);
      assert.deepEqual(fixture.repository.read(), before);
    } finally { fixture.dispose(); }
  });

  test("authorized source publication finishes after navigation without taking focus", async function () {
    this.timeout(20_000);
    const fixture = await resultFixture(false); await secondRun(fixture); const host = new DetailHost();
    let complete = () => {}; const finished = new Promise<void>(resolve => { complete = resolve; }); let results = 0;
    const coordinator = new ExecutionCoordinator({ repository: fixture.repository, storageDirectory: fixture.storage, createClient: () => { throw new Error("Result review never calls a provider"); }, publish: snapshot => {
      view.update(snapshot); if (snapshot.executionRuns[0]?.workspace.kind === "writing") view.openExecutionResult("other-run");
    } });
    const ui = new ExecutionUi(coordinator, () => fixture.repository.read(), id => { results++; view.openExecutionResult(id); });
    const view = new WorkView(host.createPanel, undefined, undefined, undefined, { handle: async (message, origin) => { try { await ui.handle(message, origin); } finally { complete(); } }, renderDetails: id => ui.renderDetails(id) });
    resultDialogs.warning = (message, options, ...choices) => { assert.equal(message, "Apply and accept this result?"); assert.equal(options?.modal, true); assert.deepEqual(choices, ["Apply and accept"]); return Promise.resolve(choices[0]); };
    try {
      view.show(fixture.repository.read()); view.openExecutionResult(fixture.runId);
      await host.click('[data-execution-action="apply-accept"]', "piarre.execution"); await finished;
      assert.equal(fixture.repository.read().executionRuns[0]?.acceptance.kind, "accepted");
      assert.equal(fixture.repository.read().executionRuns[0]?.workspace.kind, "integrated");
      assert.equal(results, 0); assert.match(host.panel("piarre.execution").webview.html, /other-run/);
    } finally { resultDialogs.warning = undefined; view.dispose(); ui.dispose(); fixture.dispose(); }
  });

  test("native proposal deletion rejects an advanced project revision", async function () {
    this.timeout(20_000);
    const fixture = await resultFixture(); fixture.send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose("Delete revision") });
    const project = fixture.repository.read(); const target = project.proposals.at(-1); assert.ok(target);
    const host = new DetailHost(); let answer: (value: string) => void = () => {}; let notified = () => {};
    const response = new Promise<string>(resolve => { answer = resolve; }); const notification = new Promise<void>(resolve => { notified = resolve; });
    const view = new WorkView(host.createPanel, { prepare: goal => new GoalInterpreter().propose(goal), save: () => {}, deleteProposal: () => { throw new Error("An unreviewed revision cannot reach deletion"); } });
    resultDialogs.warning = (message, options, ...choices) => {
      assert.equal(message, "Delete “Delete revision” and its proposal?"); assert.equal(options?.modal, true); assert.match(options.detail ?? "", /Prior project history is retained/); assert.deepEqual(choices, ["Delete goal"]); return response;
    };
    resultDialogs.information = message => { assert.equal(message, "The project changed. Review the goal before deleting it."); notified(); return Promise.resolve(undefined); };
    try {
      view.show(project); view.openProposal(target.groupId); await host.click("#delete-goal");
      fixture.send({ kind: "rename-project", name: "Changed while reviewing deletion" }); const changed = fixture.repository.read(); view.update(changed);
      answer("Delete goal"); await notification; await nextTurn(); assert.deepEqual(fixture.repository.read(), changed);
      assert.ok(changed.revision > project.revision); assert.ok(changed.proposals.some(item => item.groupId === target.groupId));
    } finally { resultDialogs.warning = undefined; resultDialogs.information = undefined; view.dispose(); fixture.dispose(); }
  });

});

async function secondRun(fixture: Awaited<ReturnType<typeof resultFixture>>): Promise<void> {
  fixture.send({ kind: "propose-tasks", draft: await new GoalInterpreter().propose("Another task") });
  const project = fixture.repository.read(); const task = project.tasks.at(-1); const firstPlan = project.executionPlans[0]; assert.ok(task && firstPlan);
  const draft = { ...firstPlan, taskId: task.taskId, objective: "Another run" }; Reflect.deleteProperty(draft, "planId"); Reflect.deleteProperty(draft, "recordedAtRevision");
  fixture.send({ kind: "prepare-execution-plan", plan: draft });
  const plan = fixture.repository.read().executionPlans.at(-1); assert.ok(plan);
  fixture.send({ kind: "approve-execution", spendingConsent: consentFixture(plan, "other-run"), planId: plan.planId, planRevision: plan.recordedAtRevision, runId: "other-run", ownerPid: 2147483647, ownerId: "gone", approvedAt: 1000, expiresAt: 120000 });
  fixture.send({ kind: "mark-execution-unknown", runId: "other-run", reason: "No provider requested" });
  fixture.send({ kind: "finish-execution", runId: "other-run", summary: "No provider requested", outcome: "no-change", manifestHash: fixture.candidate.manifestHash() });
}

function assertNativeFocus(value: unknown): void {
  if (process.env.PIARRE_DETAIL_NATIVE_FOCUS !== "1") return;
  assert.ok(value && typeof value === "object" && "focused" in value);
  assert.equal(value.focused, true, "The actual detail document must keep keyboard focus after replacement");
}
