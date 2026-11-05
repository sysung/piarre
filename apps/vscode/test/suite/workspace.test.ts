import { SidebarFixture as WorkView } from "./sidebar-fixture.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { WorkspaceDraft, parseComposerMessage } from "../../src/workspace-draft.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { renderWorkView, renderSessionBrief } from "../../src/work-view.js";
import type { ProposalDraft } from "../../../../packages/core/src/index.js";

suite("Typed workspace previews", () => {
  let directory: string;
  let repository: SqliteProjectRepository;
  const interpreter = new GoalInterpreter();
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-workspace-"));
    repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    repository.open({ repositoryUri: "file:///workspace-test", name: "Workspace" });
  });
  teardown(() => {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  });
  function controller(prepare = (goal: string) => interpreter.propose(goal)) {
    return new WorkspaceDraft(repository.read(), { prepare,
      save: (project, draft, commandId) => {
        const result = repository.dispatch({ commandId, projectId: project.projectId,
          expectedProjectRevision: project.revision, action: { kind: "propose-tasks", draft } });
        return result.kind === "applied" || result.kind === "duplicate" ? result.snapshot : undefined;
      },
    }, () => {});
  }
  test("only explicit save persists the host-held draft and duplicate saves do nothing", async () => {
    const session = controller();
    const before = repository.read();
    await session.receive({ kind: "preview", requestId: "one", goal: "Build a pricing page" });
    assert.equal(session.state.kind, "ready");
    assert.deepEqual(repository.read(), before);
    await session.receive({ kind: "save", requestId: "wrong" });
    assert.deepEqual(repository.read(), before);
    await session.receive({ kind: "save", requestId: "one", draft: {} });
    assert.deepEqual(repository.read(), before);
    await session.receive({ kind: "save", requestId: "one" });
    await session.receive({ kind: "save", requestId: "one" });
    assert.equal(repository.read().proposals.length, 1);
    assert.equal(repository.read().tasks[0]?.state.kind, "unapproved");
    assert.equal(session.state.requestId, "one", "Save completion must remain bound to its request");
  });
  test("editing or discarding rejects delayed results and never stores unsent text", async () => {
    let resolve: ((draft: ProposalDraft) => void) | undefined;
    const session = controller(() => new Promise((done) => { resolve = done; }));
    const pending = session.receive({ kind: "preview", requestId: "old", goal: "Old idea" });
    assert.equal(session.state.kind, "preparing");
    await session.receive({ kind: "discard", requestId: "old" });
    resolve?.(await interpreter.propose("Old idea"));
    await pending;
    assert.equal(session.state.kind, "idle");
    await session.receive({ kind: "save", requestId: "old" });
    assert.equal(repository.read().revision, 1);
  });
  test("replacement, project revision changes, and closing invalidate previews", async () => {
    const pending: ((draft: ProposalDraft) => void)[] = [];
    const session = controller(() => new Promise((resolve) => pending.push(resolve)));
    const first = session.receive({ kind: "preview", requestId: "first", goal: "First" });
    const second = session.receive({ kind: "preview", requestId: "second", goal: "Second" });
    pending[1]?.(await interpreter.propose("Second"));
    await second;
    pending[0]?.(await interpreter.propose("First"));
    await first;
    assert.equal(session.state.kind === "ready" && session.state.draft.goal, "Second");
    const project = repository.read();
    repository.dispatch({ commandId: "rename", projectId: project.projectId, expectedProjectRevision: project.revision,
      action: { kind: "rename-project", name: "Changed" } });
    session.update(repository.read());
    await session.receive({ kind: "save", requestId: "second" });
    assert.equal(repository.read().proposals.length, 0);
    const third = session.receive({ kind: "preview", requestId: "third", goal: "Third" });
    session.dispose();
    pending[2]?.(await interpreter.propose("Third"));
    await third;
    await session.receive({ kind: "save", requestId: "third" });
    assert.equal(repository.read().proposals.length, 0);
  });
  test("a concurrent change is rejected even without a view refresh", async () => {
    const session = controller();
    await session.receive({ kind: "preview", requestId: "preview", goal: "Goal" });
    const project = repository.read();
    repository.dispatch({ commandId: "rename", projectId: project.projectId, expectedProjectRevision: project.revision,
      action: { kind: "rename-project", name: "Changed" } });
    await session.receive({ kind: "save", requestId: "preview" });
    assert.equal(repository.read().proposals.length, 0);
    assert.equal(session.state.kind, "idle");
  });
  test("preparation and save failures do not persist proposals", async () => {
    const failedPreparation = controller(() => Promise.reject(new Error("Unavailable")));
    await failedPreparation.receive({ kind: "preview", requestId: "failed", goal: "Goal" });
    assert.equal(failedPreparation.state.kind, "idle");
    assert.equal(failedPreparation.state.requestId, "failed");
    const failedSave = new WorkspaceDraft(repository.read(), {
      prepare: (goal) => interpreter.propose(goal),
      save: () => { throw new Error("Unavailable"); },
    }, () => {});
    await failedSave.receive({ kind: "preview", requestId: "save-failed", goal: "Goal" });
    await failedSave.receive({ kind: "save", requestId: "save-failed" });
    assert.equal(failedSave.state.kind, "idle");
    assert.equal(failedSave.state.requestId, "save-failed");
    assert.equal(repository.read().proposals.length, 0);
  });

  test("session brief follows saved records through rename, deletion and replay", async () => {
    assert.ok(renderSessionBrief(repository.read()).includes("No next action established by recorded plans."));
    const session = controller();
    await session.receive({ kind: "preview", requestId: "brief", goal: "Resume this goal" });
    assert.ok(renderSessionBrief(repository.read()).includes("No next action established by recorded plans."), "Unpersisted previews are not saved work");
    await session.receive({ kind: "save", requestId: "brief" });
    let project = repository.read();
    assert.ok(renderSessionBrief(project).includes("Prepare and review an execution plan for"));
    assert.ok(renderSessionBrief(project).includes(project.tasks[0]?.title ?? "missing task"));
    assert.ok(renderSessionBrief(project).includes("No accepted result recorded"));
    repository.dispatch({ commandId: "brief-rename", projectId: project.projectId, expectedProjectRevision: project.revision,
      action: { kind: "rename-project", name: "<Project & brief>" } });
    project = repository.read();
    assert.ok(renderSessionBrief(project).includes("&lt;Project &amp; brief&gt;"));
    const proposal = project.proposals[0]; assert.ok(proposal);
    repository.dispatch({ commandId: "brief-delete", projectId: project.projectId, expectedProjectRevision: project.revision,
      action: { kind: "delete-proposal", groupId: proposal.groupId } });
    repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    assert.ok(renderSessionBrief(repository.read()).includes("No next action established by recorded plans."));
    assert.ok(renderSessionBrief(repository.read()).includes("No accepted result recorded."));
  });

  test("saved goal cards are newest first without changing project history", async () => {
    const session = controller();
    for (const { requestId, goal } of [{requestId: "old", goal: "Older goal"}, {requestId: "new", goal: "Newer goal"}]) {
      await session.receive({ kind: "preview", requestId, goal });
      await session.receive({ kind: "save", requestId });
      session.update(repository.read());
    }
    const project = repository.read();
    const original = project.proposals.map(item => item.groupId);
    const html = renderWorkView(project);
    assert.ok(html.indexOf('data-open-goal="' + String(project.proposals[1]?.groupId)) <
      html.indexOf('data-open-goal="' + String(project.proposals[0]?.groupId)));
    assert.deepEqual(project.proposals.map(item => item.groupId), original);
  });

  test("proposal panes validate identity, reuse the panel and close with Work", async () => {
    const session = controller();
    for (const goal of ["First saved goal", "Second saved goal"]) {
      await session.receive({ kind: "preview", requestId: goal, goal });
      await session.receive({ kind: "save", requestId: goal });
    }
    const project = repository.read();
    const first = project.proposals[0]; const second = project.proposals[1];
    assert.ok(first); assert.ok(second);
    const panels: vscode.WebviewPanel[] = [];
    const view = new WorkView((...args) => { const panel = vscode.window.createWebviewPanel(...args); panels.push(panel); return panel; });
    try {
      view.show(project);
      view.openProposal("foreign");
      assert.equal(panels.length, 1);
      view.openProposal(first.groupId);
      const detail = panels[1]; assert.ok(detail);
      assert.ok(detail.webview.html.includes("First saved goal"));
      assert.ok(!detail.webview.html.includes("Second saved goal"));
      const html = detail.webview.html;
      view.update(project);
      assert.equal(detail.webview.html, html, "Unrelated refresh must preserve detail document");
      view.openProposal(second.groupId);
      assert.equal(panels.length, 2);
      assert.ok(detail.webview.html.includes("Second saved goal"));
      let closed = false;
      detail.onDidDispose(() => { closed = true; });
      panels[0]?.dispose();
      assert.equal(closed, false, "Sidebar disposal must preserve editor reviews");
      view.close();
      assert.equal(closed, true, "Explicit project closure closes reviews");
    } finally { view.dispose(); }
  });

  test("deletion removes only the selected goal and its tasks and survives replay", async () => {
    const session = controller();
    for (const goal of ["Keep", "Delete"]) {
      await session.receive({ kind: "preview", requestId: goal, goal });
      await session.receive({ kind: "save", requestId: goal });
    }
    const before = repository.read();
    const target = before.proposals[1]; assert.ok(target);
    const command = { commandId: "delete-once", projectId: before.projectId,
      expectedProjectRevision: before.revision, action: { kind: "delete-proposal", groupId: target.groupId } };
    assert.equal(repository.dispatch({ ...command, commandId: "stale-delete", expectedProjectRevision: before.revision - 1 }).kind, "stale");
    assert.throws(() => repository.dispatch({ ...command, commandId: "unknown-delete", action: { kind: "delete-proposal", groupId: "foreign" } }), /no longer exists/);
    assert.deepEqual(repository.read(), before);
    assert.equal(repository.dispatch(command).kind, "applied");
    assert.equal(repository.dispatch(command).kind, "duplicate");
    assert.deepEqual(repository.read().proposals.map(item => item.goal), ["Keep"]);
    assert.ok(repository.read().tasks.every(task => task.groupId !== target.groupId));
    repository.close(); repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
    assert.deepEqual(repository.read().proposals.map(item => item.goal), ["Keep"]);
    assert.equal(repository.read(before.revision).proposals.length, 2, "Historical records remain inspectable");
  });

  test("deletion requires confirmation and closes the selected pane after success", async () => {
    const session = controller();
    await session.receive({ kind: "preview", requestId: "delete", goal: "Remove me" });
    await session.receive({ kind: "save", requestId: "delete" });
    const project = repository.read(); const target = project.proposals[0]; assert.ok(target);
    let confirmed = false; let prompts = 0;
    const panels: vscode.WebviewPanel[] = [];
    const view = new WorkView((...args) => { const panel = vscode.window.createWebviewPanel(...args); panels.push(panel); return panel; }, {
      prepare: (goal) => interpreter.propose(goal), save: () => undefined,
      deleteProposal: (snapshot, groupId, commandId) => {
        const result = repository.dispatch({ commandId, projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision,
          action: { kind: "delete-proposal", groupId } });
        return result.kind === "applied" ? result.snapshot : undefined;
      },
    }, (goal) => { assert.equal(goal, "Remove me"); prompts++; return Promise.resolve(confirmed); });
    try {
      view.show(project); view.openProposal(target.groupId);
      await view.deleteProposal("foreign"); assert.equal(prompts, 0);
      await view.deleteProposal(target.groupId); assert.equal(repository.read().proposals.length, 1);
      const detail = panels[1]; assert.ok(detail); let closed = false; detail.onDidDispose(() => { closed = true; });
      confirmed = true; await view.deleteProposal(target.groupId);
      assert.equal(repository.read().proposals.length, 0); assert.equal(closed, true);
      assert.equal(prompts, 2);
    } finally { view.dispose(); }
  });

  test("IPC rejects empty, oversized, and fabricated messages", () => {
    for (const value of [null, [], {}, { kind: "preview", requestId: "x", goal: " " },
      { kind: "preview", requestId: "x", goal: "x".repeat(10001) },
      { kind: "save", requestId: "x", projectId: "other" }, { kind: "execute", requestId: "x" }]) {
      assert.equal(parseComposerMessage(value), undefined);
    }
  });

  test("real webview preserves unsent input on inspection updates and requires explicit save", async function () {
    this.timeout(20000);
    let phase = "waiting for renderer";
    let diagnosticTimer: ReturnType<typeof setTimeout> | undefined;
    let panel: vscode.WebviewPanel | undefined;
    const view = new WorkView((...args) => {
      panel = vscode.window.createWebviewPanel(...args);
      return panel;
    }, { prepare: (goal) => interpreter.propose(goal), save: (project, draft, commandId) => {
      const result = repository.dispatch({ commandId, projectId: project.projectId,
        expectedProjectRevision: project.revision, action: { kind: "propose-tasks", draft } });
      return result.kind === "applied" || result.kind === "duplicate" ? result.snapshot : undefined;
    } });
    try {
      view.show(repository.read());
      assert.ok(panel);
      const actualPanel = panel;
      const result = new Promise<unknown>((resolve) => {
        actualPanel.webview.onDidReceiveMessage((value: unknown) => {
          if (typeof value === "object" && value !== null && "kind" in value && value.kind === "test-phase" && "phase" in value && typeof value.phase === "string") phase = value.phase;
          if (typeof value === "object" && value !== null && "kind" in value && value.kind === "test-result") resolve(value);
        });
        diagnosticTimer = setTimeout(() => { resolve({ kind: "test-result", ok: false, error: `Webview stalled at ${phase}; visible=${String(actualPanel.visible)} active=${String(actualPanel.active)}` }); }, 15000);
      });
      actualPanel.webview.html = actualPanel.webview.html.replace("const api = acquireVsCodeApi();", `
const nativeApi = acquireVsCodeApi();
const bridgeCalls = [];
const api = {
  postMessage: value => { bridgeCalls.push(value); return nativeApi.postMessage(value); },
  setState: value => nativeApi.setState(value),
  getState: () => nativeApi.getState(),
};
`).replace("</script>", `
window.addEventListener('message', ({data}) => { if (data.kind === 'test-checked') document.body.dataset.checked = 'yes'; });
(async () => {
  const waitFor = async (condition) => {
    const deadline = Date.now() + 10000;
    while (!condition()) {
      if (Date.now() > deadline) throw new Error('Webview condition timed out');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  try {
    if (!document.getElementById('session-brief').textContent.includes('No next action established by recorded plans.')) throw new Error('Empty brief invents saved work');
    const flow = document.getElementById('chat-flow');
    const greeting = document.getElementById('welcome');
    if (greeting.hidden || getComputedStyle(greeting).display === 'none') throw new Error('Empty chat must show the welcome');
    if (document.getElementById('discussion').tagName !== 'SECTION') throw new Error('Conversation must be a regular chat surface');
    if (document.getElementById('execution-controls').closest('[hidden]') === null) throw new Error('Idle execution controls are visible in the chat');
    const greetingBox = greeting.getBoundingClientRect(), flowBox = flow.getBoundingClientRect();
    if (Math.abs(greetingBox.top + greetingBox.height / 2 - flowBox.top - flowBox.height / 2) > 2) throw new Error('Welcome is not centered above the composer');
    const columns = document.querySelector('.workspace-columns');
    const planning = document.querySelector('.planning');
    const sidebar = document.getElementById('workspace');
    if (!columns.contains(sidebar) || !planning.contains(goal) || !planning.contains(document.getElementById('welcome'))) throw new Error('Chat and workspace are not in the primary shell');
    if (getComputedStyle(columns).display !== 'grid' || document.documentElement.scrollWidth > document.documentElement.clientWidth) throw new Error('Workspace overflows or loses its grid');
    document.querySelector('[data-pane="agents"]').click();
    if (document.getElementById('agent-overview').closest('[hidden]')) throw new Error('Agents tab did not expose the work overview');
    api.postMessage({kind:'test-phase',phase:'execution announcements and disclosure focus'});
    const liveStatus = document.getElementById('execution-status');
    if (liveStatus.getAttribute('role') !== 'status' || liveStatus.getAttribute('aria-live') !== 'polite') throw new Error('Execution progress has no persistent polite status');
    const reviewMarkup = '<details data-review-key="recent-plans"><summary>Recent plans</summary><details data-review-key="plan:fixture:4"><summary>Exact plan, files, and limits</summary><p>Approved fixture scope</p></details></details>';
    const progress = text => ({kind:'inspection', html:'', brief:'No saved goals yet.', agentOverview:reviewMarkup, executionControls:'<section data-execution-status="' + JSON.stringify([{id:'fixture-run',text}]).replaceAll('"','&quot;') + '"></section>'});
    window.dispatchEvent(new MessageEvent('message', {data:progress('Fixture task: checking candidate; acceptance pending.')}));
    const recent = document.querySelector('[data-review-key="recent-plans"]');
    const exact = document.querySelector('[data-review-key="plan:fixture:4"]');
    recent.open = true; exact.open = true; exact.querySelector('summary').focus();
    window.dispatchEvent(new MessageEvent('message', {data:progress('Fixture task: checks completed; review the exact changes and evidence.')}));
    const updatedExact = document.querySelector('[data-review-key="plan:fixture:4"]');
    if (!document.querySelector('[data-review-key="recent-plans"]').open || !updatedExact.open || document.activeElement !== updatedExact.querySelector('summary')) throw new Error('Execution update lost expanded review or summary focus');
    if (document.getElementById('execution-status') !== liveStatus || !liveStatus.textContent.includes('Fixture task: checks completed; review')) throw new Error('Completion did not update the persistent task status and pending decision');
    let repeatedAnnouncements = 0;
    const announcementObserver = new MutationObserver(records => { repeatedAnnouncements += records.length; });
    announcementObserver.observe(liveStatus, {childList:true, characterData:true, subtree:true});
    window.dispatchEvent(new MessageEvent('message', {data:progress('Fixture task: checks completed; review the exact changes and evidence.')}));
    await Promise.resolve(); announcementObserver.disconnect();
    if (repeatedAnnouncements) throw new Error('Unchanged inspection repeated the live announcement');
    api.postMessage({kind:'test-phase',phase:'privacy and save journey'});
    document.querySelector('[data-pane="chat"]').click();
    goal.value = '<script>unsent & private</scr' + 'ipt>';
    goal.dispatchEvent(new Event('input'));
    if (bridgeCalls.some(value => JSON.stringify(value).includes('unsent & private'))) throw new Error('Unsent input crossed the renderer state bridge');
    goal.focus();
    goal.setSelectionRange(3, 7);
    const content = goal.value;
    const marker = document.createElement('span');
    marker.id = 'inspection-marker';
    document.getElementById('inspection').append(marker);
    api.postMessage({kind: 'test-refresh'});
    await waitFor(() => !document.getElementById('inspection-marker'));
    if (!document.getElementById('session-brief').textContent.includes('No next action established by recorded plans.')) throw new Error('Refresh corrupted the project brief');
    if (goal.value !== content || document.activeElement !== goal || goal.selectionStart !== 3) throw new Error('Unsent input or focus lost: ' + JSON.stringify({value: goal.value, active: document.activeElement.tagName, start: goal.selectionStart}));
    window.dispatchEvent(new MessageEvent('message', {data: {kind:'conversation', state:{kind:'ready',message:'Connected for test'},sessions:[{id:'project-chat',title:'Project chat',status:'Open',html:'<article>Inferred reply</article>'}]}}));
    if (goal.value !== content || document.activeElement !== goal || goal.selectionStart !== 3) throw new Error('Conversation update disturbed unsent input');
    if (send.disabled || document.getElementById('connect-codex').hidden !== true) throw new Error('Ready conversation controls unavailable');
    window.dispatchEvent(new MessageEvent('message', {data: {kind:'conversation', state:{kind:'busy',message:'Waiting'},sessions:[{id:'project-chat',title:'Project chat',status:'Reply in progress',html:'<article>Pending reply</article>'}]}}));
    if (!send.disabled || document.getElementById('stop-conversation').hidden) throw new Error('Busy controls do not expose stop');
    document.getElementById('stop-conversation').click();
    if (!bridgeCalls.some(value => value.kind === 'stop-conversation')) throw new Error('Stop did not reach host');
    if (bridgeCalls.some(value => value.kind === 'send-conversation')) throw new Error('Refresh sent private text');
    window.dispatchEvent(new MessageEvent('message', {data: {kind:'conversation', state:{kind:'ready',message:'Connected for test'},sessions:[{id:'project-chat',title:'Project chat',status:'Open',html:''}]}}));
    composer.requestSubmit(send);
    const outbound = bridgeCalls.find(value => value.kind === 'send-conversation');
    if (outbound?.sessionId !== 'project-chat' || outbound?.text !== content || goal.value !== content) throw new Error('Send did not retain its draft pending acknowledgement');
    window.dispatchEvent(new MessageEvent('message', {data:{kind:'send-finished',requestId:outbound.requestId}}));
    if (goal.value !== content || send.disabled) throw new Error('Cancelled send lost the draft or prevented retry');

    window.dispatchEvent(new MessageEvent('message', {data: {kind:'conversation', state:{kind:'disconnected',message:'Disconnected'},sessions:[{id:'project-chat',title:'Project chat',status:'Open',html:''}]}}));
    document.getElementById('composer').requestSubmit();
    await waitFor(() => !save.hidden);
    if (!composer.hidden || preview.hidden) throw new Error('Review did not replace goal entry');
    if (preview.querySelector('script') || !preview.textContent.includes(content)) throw new Error('Unsafe preview rendering');
    if (preview.querySelectorAll('.proposal-metadata section').length !== 4 || preview.querySelectorAll('.budget-grid dt').length !== 3) throw new Error('Metadata must have labeled sections and budget values');
    if (!preview.textContent.includes('Excluded paths:') || !preview.textContent.includes('Dependencies:') || !preview.textContent.includes('15 minutes')) throw new Error('Incomplete preview');
    if (preview.querySelector('details').open) throw new Error('Technical details should start collapsed');
    discard.click();
    if (composer.hidden || !preview.hidden || goal.value !== content) throw new Error('Back lost goal or stayed on review');
    document.getElementById('composer').requestSubmit();
    await waitFor(() => !save.hidden);
    api.postMessage({kind: 'test-before-save'});
    await waitFor(() => document.body.dataset.checked === 'yes');
    const savedRequest = requestId;
    save.click();
    await waitFor(() => status.textContent.includes('Proposal saved'));
    api.postMessage({kind: 'test-refresh'});
    await waitFor(() => document.querySelector('[data-open-goal]'));
    const savedBrief = document.getElementById('session-brief');
    if (!savedBrief.textContent.includes('Prepare and review an execution plan for Review and refine the proposed goal.')) throw new Error('Saved brief lacks the current task next action');
    if (savedBrief.textContent.includes('No next action established by recorded plans.') || !savedBrief.textContent.includes('No accepted result recorded.')) throw new Error('Saved brief misstates proposal progress');
    const savedGroupId = document.querySelector('[data-open-goal]').dataset.openGoal;
    const nextActionSource = [...savedBrief.querySelectorAll('details')].find(detail => detail.querySelector('summary')?.textContent.startsWith('proposal ' + savedGroupId + ' · revision '));
    if (!nextActionSource) throw new Error('Saved brief does not link the next action to its saved proposal');
    const savedSource = JSON.parse(nextActionSource.querySelector('pre').textContent);
    if (savedSource.groupId !== savedGroupId || savedSource.goal !== content) throw new Error('Saved brief source differs from the explicitly saved goal');
    const card = document.querySelector('[data-open-goal]');
    if (!card || card.querySelector('details')) throw new Error('Goal overview must contain compact cards');
    const trash = card.parentElement.querySelector('[data-delete-goal]');
    if (!trash?.querySelector('svg') || !trash.getAttribute('aria-label') || trash.getBoundingClientRect().left < card.getBoundingClientRect().right) throw new Error('Trash icon must be accessible and placed to the right');
    card.click();
    await waitFor(() => document.getElementById('browse-status').textContent.includes('Proposal opened'));
    goal.value = 'A second idea';
    goal.dispatchEvent(new Event('input'));
    document.getElementById('composer').requestSubmit();
    const nextRequest = requestId;
    window.dispatchEvent(new MessageEvent('message', {data: {kind: 'draft', state: {kind: 'idle', requestId: savedRequest, message: 'Old completion'}}}));
    if (requestId !== nextRequest) throw new Error('Old completion dismissed newer input');
    window.dispatchEvent(new MessageEvent('message', {data: {kind: 'draft', state: {kind: 'idle', requestId: undefined, message: 'Delayed initial state'}}}));
    if (requestId !== nextRequest) throw new Error('Initial state dismissed newer input');
    await waitFor(() => !save.hidden);
    goal.value = 'Changed before saving';
    goal.dispatchEvent(new Event('input'));
    if (!save.hidden || !save.disabled) throw new Error('Editing left stale preview saveable');
    save.click();
    api.postMessage({kind: 'test-result', ok: true});
  } catch (error) { api.postMessage({kind: 'test-result', ok: false, error: String(error)}); }
})();
</script>`);
      const listener = actualPanel.webview.onDidReceiveMessage((message: unknown) => {
        if (typeof message !== "object" || message === null || !("kind" in message)) return;
        if (message.kind === "test-refresh") view.update(repository.read());
        if (message.kind === "test-before-save") {
          assert.equal(repository.read().proposals.length, 0);
          void actualPanel.webview.postMessage({ kind: "test-checked" });
        }
      });
      const observed = await result;
      listener.dispose();
      assert.deepEqual(observed, { kind: "test-result", ok: true });
      assert.equal(repository.read().proposals.length, 1);
    } finally { if (diagnosticTimer) clearTimeout(diagnosticTimer); view.dispose(); }
  });
});
