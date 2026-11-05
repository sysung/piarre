import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout, clearTimeout } from 'node:timers';

const require = createRequire(import.meta.url);
const vscode = require('vscode');
const hash = value => createHash('sha256').update(value).digest('hex');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(read, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = await read();
    if (value) return value;
    await pause(100);
  }
  throw new Error(message);
}

function readRecords(databasePath) {
  if (!existsSync(databasePath)) return [];
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try { return db.prepare('SELECT revision, payload FROM events ORDER BY revision').all().map(row => ({ revision: row.revision, event: JSON.parse(row.payload) })); }
  finally { db.close(); }
}

async function withWorkbench(config, inspect) {
  const response = await globalThis.fetch(`http://127.0.0.1:${config.debugPort}/json/list`);
  const targets = await response.json();
  const target = targets.find(item => item.type === 'page' && item.url.includes('workbench'));
  assert.ok(target?.webSocketDebuggerUrl, 'Native workbench has an inspectable renderer');
  const socket = new globalThis.WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const contexts = new Map();
  const attached = new Map();
  let sequence = 0;
  const key = (sessionId, id) => `${sessionId ?? 'workbench'}:${id}`;
  const request = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Native CDP ${method} timed out`)); }, 10_000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
  });
  socket.onmessage = message => {
    const reply = JSON.parse(message.data);
    if (reply.method === 'Runtime.executionContextCreated') {
      const context = reply.params.context;
      if (context.auxData?.isDefault !== false) contexts.set(key(reply.sessionId, context.id), { id: context.id, sessionId: reply.sessionId });
    } else if (reply.method === 'Runtime.executionContextDestroyed') {
      contexts.delete(key(reply.sessionId, reply.params.executionContextId));
    } else if (reply.method === 'Runtime.executionContextsCleared') {
      for (const [id, context] of contexts) if (context.sessionId === reply.sessionId) contexts.delete(id);
    }
    const waiting = pending.get(reply.id);
    if (!waiting) return;
    clearTimeout(waiting.timer); pending.delete(reply.id);
    if (reply.error) waiting.reject(new Error(`${reply.error.code}: ${reply.error.message}`));
    else waiting.resolve(reply.result);
  };
  const evaluate = async (context, expression) => {
    const result = await request('Runtime.evaluate', { expression, contextId: context.id, returnByValue: true, awaitPromise: true }, context.sessionId);
    assert.equal(result.exceptionDetails, undefined, `Native webview expression failed: ${result.exceptionDetails?.text}`);
    return result.result.value;
  };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Native CDP connection timed out')), 10_000);
      socket.onopen = () => { clearTimeout(timer); resolve(); };
      socket.onerror = () => { clearTimeout(timer); reject(new Error('Native CDP connection failed')); };
    });
    await request('Runtime.enable');
    const context = await waitFor(async () => {
      const { targetInfos } = await request('Target.getTargets');
      for (const frame of targetInfos.filter(item => item.type === 'iframe' || ['page', 'webview'].includes(item.type) && item.url.includes('vscode-webview'))) {
        if (attached.has(frame.targetId)) continue;
        const { sessionId } = await request('Target.attachToTarget', { targetId: frame.targetId, flatten: true });
        attached.set(frame.targetId, sessionId);
        await request('Runtime.enable', {}, sessionId);
      }
      for (const candidate of contexts.values()) {
        try {
          if (await evaluate(candidate, `typeof document !== 'undefined' && document.body?.dataset.projectId === ${JSON.stringify(config.projectId)} && !!document.getElementById('goal') && !!document.getElementById('setup-overlay')`)) return candidate;
        } catch { contexts.delete(key(candidate.sessionId, candidate.id)); }
      }
      return undefined;
    }, 'Installed Piarre webview execution context was not found');
    return await inspect({ request, evaluate: expression => evaluate(context, expression), sessionId: context.sessionId });
  } finally {
    for (const waiting of pending.values()) { clearTimeout(waiting.timer); waiting.reject(new Error('Native CDP inspection closed')); }
    socket.close();
  }
}

const visibleExpression = `(element) => {
  if (!element || element.closest('[hidden], [inert]') || getComputedStyle(element).visibility === 'hidden') return false;
  const bounds = element.getBoundingClientRect();
  return bounds.width > 0 && bounds.height > 0;
}`;

async function inspectOfflineChat(config) {
  return withWorkbench(config, async ({ request, evaluate, sessionId }) => {
    const entry = await evaluate(`(() => {
      const visible = ${visibleExpression};
      const overlay = document.getElementById('setup-overlay');
      const button = document.getElementById('continue-offline');
      if (!button || !overlay.contains(button)) throw new Error('Installed Continue offline button is unavailable');
      const clicked = visible(overlay);
      if (clicked) {
        if (button.disabled) throw new Error('Continue offline is disabled');
        button.click();
      } else {
        document.querySelector('[data-pane="chat"]').click();
        document.getElementById('goal').focus();
      }
      const goal = document.getElementById('goal');
      return { clicked, overlayClosed: overlay.hidden, chatVisible: visible(document.getElementById('chat-pane')),
        composerEditable: visible(goal) && !goal.disabled && !goal.readOnly,
        composerFocused: document.activeElement === goal, draft: goal.value };
    })()`);
    if (config.phase === 'create') assert.equal(entry.clicked, true, 'Fresh repository actually clicks the installed Continue offline button');
    assert.equal(entry.overlayClosed, true); assert.equal(entry.chatVisible, true);
    assert.equal(entry.composerEditable, true); assert.equal(entry.composerFocused, true);
    assert.equal(entry.draft, '', 'Disposable chat starts without an unsent draft');
    const draft = `C07 offline input ${config.context} ${config.phase}`;
    await request('Input.insertText', { text: draft }, sessionId);
    assert.equal(await evaluate(`document.getElementById('goal').value`), draft, 'The real focused composer accepts native text input');
    await evaluate(`(() => { const goal = document.getElementById('goal'); goal.value = ''; goal.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    assert.equal(await evaluate(`document.getElementById('goal').value`), '');
    return { clicked: entry.clicked, overlayClosed: true, chatVisible: true, composerEditable: true, composerFocused: true, inputSha256: hash(draft) };
  });
}

async function inspectProposalAndCapture(config, proposal) {
  return withWorkbench(config, async ({ request, evaluate }) => {
    await evaluate(`(() => {
      document.querySelector('[data-pane="sessions"]').click();
      const disclosure = document.getElementById('inspection').closest('details');
      if (!disclosure.open) disclosure.querySelector('summary').click();
    })()`);
    const card = await waitFor(async () => evaluate(`(() => {
      const visible = ${visibleExpression};
      const card = [...document.querySelectorAll('[data-open-goal]')].find(item => item.dataset.openGoal === ${JSON.stringify(proposal.groupId)});
      if (!card || !visible(card)) return undefined;
      card.scrollIntoView({ block: 'center' });
      const bounds = card.getBoundingClientRect();
      return { proposalId: card.dataset.openGoal, goal: card.querySelector('.goal-title')?.textContent,
        unapproved: card.querySelector('.goal-meta')?.textContent.includes('Unapproved'),
        visible: visible(document.getElementById('sessions-pane')) && bounds.bottom > 0 && bounds.top < innerHeight && bounds.right > 0 && bounds.left < innerWidth && document.getElementById('setup-overlay').hidden };
    })()`), 'Saved proposal card is not visible through Sessions');
    assert.equal(card.proposalId, proposal.groupId); assert.equal(card.goal, config.goal);
    assert.equal(card.unapproved, true); assert.equal(card.visible, true);
    const capture = await request('Page.captureScreenshot', { format: 'png' });
    const bytes = Buffer.from(capture.data, 'base64');
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    writeFileSync(config.screenshotPath, bytes);
    await evaluate(`document.querySelector('[data-pane="chat"]').click()`);
    return { screenshot: { file: path.basename(config.screenshotPath), sha256: hash(bytes) },
      visibleProposal: { proposalId: card.proposalId, goalSha256: hash(card.goal), unapproved: true, visible: true, route: 'Sessions / Saved goals' } };
  });
}

export async function run() {
  const config = JSON.parse(readFileSync(process.env.PIARRE_INSTALLED_JOURNEY, 'utf8'));
  const extension = vscode.extensions.getExtension('sysung.piarre-candidate');
  assert.ok(extension, 'Exact candidate extension is installed');
  assert.equal(vscode.extensions.getExtension('sysung.piarre'), undefined, 'Stable extension is absent from disposable extensions directory');
  assert.equal(path.resolve(extension.extensionPath), config.installedPath, 'Native host resolves the installed candidate package');
  assert.equal(hash(readFileSync(path.join(extension.extensionPath, 'dist/extension.js'))), config.bundleSha256);
  assert.equal(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath, config.repository);
  assert.equal(vscode.workspace.isTrusted, true);

  const candidateWindow = createRequire(path.join(extension.extensionPath, 'dist/extension.js'))('vscode').window;
  const errors = [];
  const originals = Object.fromEntries(['showQuickPick', 'showSaveDialog', 'showWarningMessage', 'showInformationMessage', 'showErrorMessage'].map(name => [name, candidateWindow[name]]));
  const dialogs = [];
  try {
    candidateWindow.showErrorMessage = async message => { errors.push(message); };
    candidateWindow.showQuickPick = async (items, options) => {
      dialogs.push(options?.placeHolder ?? 'pick');
      if (options?.placeHolder?.startsWith('Choose what to collect')) return items.find(item => item.value === 'reviewable-content');
      if (options?.placeHolder?.startsWith('Choose local retention')) return items.find(item => item.days === 1);
      if (options?.placeHolder?.startsWith('Choose a retained')) return items.find(item => item.name === retainedName);
      throw new Error('Unexpected native picker');
    };
    candidateWindow.showSaveDialog = async () => vscode.Uri.file(config.exportPath);
    candidateWindow.showWarningMessage = async (_message, ...choices) => choices.find(choice => typeof choice === 'string');
    candidateWindow.showInformationMessage = async (_message, ...choices) => choices.find(choice => typeof choice === 'string');
    await vscode.commands.executeCommand('piarre.open');
    await waitFor(() => readRecords(config.databasePath).length, 'Installed candidate did not create SQLite project');
    assert.equal(extension.isActive, true);
    let rows = readRecords(config.databasePath);
    const original = rows[0].event;
    const beforeOffline = JSON.stringify(rows);
    const offlineChat = await inspectOfflineChat({ ...config, projectId: original.projectId });
    await pause(100);
    assert.equal(JSON.stringify(readRecords(config.databasePath)), beforeOffline, 'Offline entry and an unsent draft append no project events');
    assert.equal(original.repositoryUri, vscode.Uri.file(config.repository).toString());
    if (config.phase === 'create') {
      assert.equal(rows.filter(row => row.event.kind === 'proposal-created').length, 0);
      await vscode.commands.executeCommand('piarre.proposeTask', config.goal);
    }
    rows = await waitFor(() => {
      const records = readRecords(config.databasePath);
      return records.some(row => row.event.kind === 'proposal-created') ? records : undefined;
    }, 'Proposal command did not persist a proposal');
    const proposals = rows.filter(row => row.event.kind === 'proposal-created');
    assert.equal(proposals.length, 1, 'Reopening retains one canonical proposal');
    assert.equal(proposals[0].event.group.goal, config.goal);
    assert.ok(proposals[0].event.tasks.length > 0);
    assert.equal(rows.some(row => /execution|approval/.test(row.event.kind)), false, 'Proposal journey gives no execution authority');
    const source = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(config.repository, config.sourceFile)));
    await vscode.window.showTextDocument(source, { preview: false });
    assert.match(source.getText(), new RegExp(config.sourceMarker));
    const sourceSha256 = hash(source.getText());
    await vscode.commands.executeCommand('piarre.sidebar.focus');
    await pause(250);
    const { screenshot, visibleProposal } = await inspectProposalAndCapture({ ...config, projectId: original.projectId }, proposals[0].event.group);
    const beforeReopen = JSON.stringify(rows);
    await vscode.commands.executeCommand('piarre.open');
    assert.equal(JSON.stringify(readRecords(config.databasePath)), beforeReopen, 'Open is idempotent and preserves recorded proposal');

    let retainedName;
    if (config.phase === 'create') {
      await vscode.commands.executeCommand('piarre.createDiagnosticBundle');
      const names = readdirSync(config.diagnosticsPath).filter(name => /^bundle-.*\.json$/.test(name));
      assert.equal(names.length, 1, `Collection retains exactly one local bundle. Errors ${JSON.stringify(errors)}. Dialogs ${JSON.stringify(dialogs)}`);
      retainedName = names[0];
      const retainedPath = path.join(config.diagnosticsPath, retainedName);
      const serialized = readFileSync(retainedPath, 'utf8');
      const bundle = JSON.parse(serialized);
      assert.equal(bundle.manifest.extension.id, 'sysung.piarre-candidate');
      assert.equal(bundle.manifest.source.commit, config.repositoryCommit);
      assert.equal(bundle.manifest.source.dirty, false);
      assert.equal(bundle.manifest.source.projectRevision, rows.length);
      assert.deepEqual(bundle.events, rows.map(row => ({ revision: row.revision, kind: row.event.kind })));
      assert.equal(bundle.manifest.detail, 'reviewable-content');
      assert.equal(bundle.recording, null);
      assert.equal(serialized.includes(config.secret), false, 'Synthetic secret is redacted from snapshot and events');
      assert.match(serialized, /REDACTED/);
      await vscode.commands.executeCommand('piarre.exportDiagnosticBundle');
      assert.equal(readFileSync(config.exportPath, 'utf8'), serialized, 'Export bytes are verified against the captured bundle');
      await vscode.commands.executeCommand('piarre.deleteDiagnosticBundle');
      assert.equal(existsSync(retainedPath), false, 'Explicit deletion removes retained local bundle');
      assert.equal(readFileSync(config.exportPath, 'utf8'), serialized, 'Local deletion preserves the separately exported copy');
      await vscode.commands.executeCommand('piarre.createDiagnosticBundle');
      const expiresName = readdirSync(config.diagnosticsPath).find(name => /^bundle-.*\.json$/.test(name));
      assert.ok(expiresName);
      const expiresPath = path.join(config.diagnosticsPath, expiresName);
      const expiring = JSON.parse(readFileSync(expiresPath, 'utf8'));
      expiring.manifest.capturedAt = '2000-01-01T00:00:00.000Z';
      writeFileSync(expiresPath, JSON.stringify(expiring));
      await vscode.commands.executeCommand('piarre.createDiagnosticBundle');
      assert.equal(existsSync(expiresPath), false, 'Installed command expires an owned elapsed-retention bundle');
      retainedName = readdirSync(config.diagnosticsPath).find(name => /^bundle-.*\.json$/.test(name));
      assert.ok(retainedName);
      await vscode.commands.executeCommand('piarre.deleteDiagnosticBundle');
      assert.deepEqual(readdirSync(config.diagnosticsPath), []);
    } else {
      assert.ok(existsSync(config.exportPath), 'Export survives native host restart');
      assert.deepEqual(readdirSync(config.diagnosticsPath), []);
    }
    assert.deepEqual(errors, [], 'Installed commands report no errors');
    assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: config.repository, encoding: 'utf8' }), '', 'Proposal and diagnostics preserve committed source and manual files');
    const result = { name: `installed candidate ${config.context} ${config.phase}`, status: 'passed', skipped: false,
      extensionId: extension.id, extensionPath: extension.extensionPath, vscodeVersion: vscode.version,
      sourceCommit: config.sourceCommit, vsixSha256: config.vsixSha256, bundleSha256: config.bundleSha256,
      projectId: original.projectId, repositoryUri: original.repositoryUri, repositoryCommit: config.repositoryCommit,
      revision: rows.length, proposalId: proposals[0].event.group.groupId, proposalGoalSha256: hash(config.goal),
      screenshot, offlineChat, visibleProposal, inspectedSource: { path: config.sourceFile, sha256: sourceSha256 }, dialogs,
      diagnosticExportSha256: hash(readFileSync(config.exportPath)), platform: process.platform,
      diagnostics: config.phase === 'create' ? ['capture', 'synchronized-revisions', 'redaction', 'export', 'explicit-deletion', 'expiry', 'export-preserved'] : ['reopened-project', 'export-preserved'],
      limitations: ['No provider execution was requested.', 'Native modal choices are automated; real document editors and installed command handlers run.', 'The signed-out offline entry and visible Saved goals card are asserted through the installed webview; no model reply or completed execution is claimed.'] };
    writeFileSync(config.resultPath, JSON.stringify(result, null, 2) + '\n');
  } finally {
    for (const [name, value] of Object.entries(originals)) candidateWindow[name] = value;
  }
}
