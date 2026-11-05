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
    const value = read();
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

async function captureView(config) {
  const response = await globalThis.fetch(`http://127.0.0.1:${config.debugPort}/json/list`);
  const targets = await response.json();
  const target = targets.find(item => item.type === 'page' && item.url.includes('workbench'));
  assert.ok(target?.webSocketDebuggerUrl, 'Native workbench has an inspectable renderer');
  const bytes = await new Promise((resolve, reject) => {
    const socket = new globalThis.WebSocket(target.webSocketDebuggerUrl);
    const timeout = setTimeout(() => { socket.close(); reject(new Error('Native view capture timed out')); }, 10_000);
    socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
    socket.onerror = error => { clearTimeout(timeout); reject(error); };
    socket.onmessage = message => {
      const reply = JSON.parse(message.data);
      if (reply.id !== 1) return;
      clearTimeout(timeout);
      socket.close();
      if (reply.error) reject(new Error(JSON.stringify(reply.error)));
      else resolve(Buffer.from(reply.result.data, 'base64'));
    };
  });
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  writeFileSync(config.screenshotPath, bytes);
  return { file: path.basename(config.screenshotPath), sha256: hash(bytes) };
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
    const screenshot = await captureView(config);
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
      screenshot, inspectedSource: { path: config.sourceFile, sha256: sourceSha256 }, dialogs,
      diagnosticExportSha256: hash(readFileSync(config.exportPath)), platform: process.platform,
      diagnostics: config.phase === 'create' ? ['capture', 'synchronized-revisions', 'redaction', 'export', 'explicit-deletion', 'expiry', 'export-preserved'] : ['reopened-project', 'export-preserved'],
      limitations: ['No provider execution was requested.', 'Native modal choices are automated; real document editors and installed command handlers run.', 'Disposable profile is signed out; onboarding can obscure proposal cards. Proposal inspection reads canonical SQLite rather than claiming visible card inspection.'] };
    writeFileSync(config.resultPath, JSON.stringify(result, null, 2) + '\n');
  } finally {
    for (const [name, value] of Object.entries(originals)) candidateWindow[name] = value;
  }
}
