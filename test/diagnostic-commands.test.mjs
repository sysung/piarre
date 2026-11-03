import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
async function load(entry, vscode = {}) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, format: 'cjs', platform: 'node', external: ['vscode'] });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: name => name === 'vscode' ? vscode : require(name), Buffer, URL, setInterval: () => 1, clearInterval: () => {} });
  return module.exports;
}
const bundles = await load('apps/vscode/src/diagnostic-bundle.ts');
const retained = (overrides = {}) => JSON.stringify({ manifest: { capturedAt: '2026-11-01T12:00:00.000Z', detail: 'metadata', retentionDays: 7, source: { project: `ref:${'a'.repeat(24)}` }, ...overrides }, content: 'review me' });
const first = 'bundle-00000000-0000-0000-0000-000000000000.json';
const last = 'bundle-ffffffff-ffff-ffff-ffff-ffffffffffff.json';
function temporary(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'piarre-diagnostic-controller-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('repeated expiration skips corrupt and oversized files, expires all valid files, and preserves explicit deletion', t => {
  const root = temporary(t);
  const store = new bundles.DiagnosticBundleStore(root);
  const directory = path.join(root, 'diagnostics');
  writeFileSync(path.join(directory, first), '{invalid secret content');
  writeFileSync(path.join(directory, 'bundle-11111111-1111-1111-1111-111111111111.json'), 'x'.repeat(2 * 1024 * 1024 + 1));
  writeFileSync(path.join(directory, last), retained({ capturedAt: '2020-01-01T00:00:00.000Z', retentionDays: 1 }));
  const anotherExpired = store.save(retained({ capturedAt: '2020-01-01T00:00:00.000Z', retentionDays: 7 }));
  const active = store.save(retained({ capturedAt: new Date().toISOString() }));
  assert.equal(store.expire(), 2);
  assert.equal(existsSync(store.path(anotherExpired)), false);
  assert.equal(existsSync(store.path(active)), true);
  assert.equal(existsSync(path.join(directory, last)), false);
  assert.equal(store.expire(), 0);
  assert.equal(store.list().length, 3);
  store.delete(first);
  assert.equal(existsSync(path.join(directory, first)), false);
});

async function controller(t, options = {}) {
  const root = temporary(t);
  const store = new bundles.DiagnosticBundleStore(root);
  const name = store.save(retained({ capturedAt: new Date().toISOString() }));
  const calls = [];
  const commands = new Map();
  const fake = {
    version: '1.144.0',
    Uri: { file: fsPath => ({ fsPath, scheme: 'file' }) },
    Disposable: { from: (...items) => ({ dispose() { for (const item of items) item.dispose(); } }) },
    commands: { registerCommand: (id, handler) => { commands.set(id, handler); return { dispose() {} }; } },
    workspace: { isTrusted: true, getConfiguration: () => ({ get: () => [] }) },
    window: {
      showQuickPick: async (items, config) => { calls.push({ kind: 'pick', items, config }); return options.pick ? options.pick(items, calls) : items[0]; },
      showTextDocument: async uri => { calls.push({ kind: 'preview', content: readFileSync(uri.fsPath, 'utf8') }); },
      showWarningMessage: async (message, config, action) => { calls.push({ kind: 'confirm', message }); return options.confirm === false ? undefined : action; },
      showSaveDialog: async () => { calls.push({ kind: 'destination' }); return fake.Uri.file(path.join(root, 'export.json')); },
      showInformationMessage: async (message, action) => { calls.push({ kind: action ? 'review' : 'info', message }); return options.review === false ? undefined : action; },
      showErrorMessage: async message => { calls.push({ kind: 'error', message }); },
      showInputBox: async config => { calls.push({ kind: 'input', config }); return options.link; },
    },
  };
  const { registerDiagnosticCommands } = await load('apps/vscode/src/diagnostic-commands.ts', fake);
  const disposable = registerDiagnosticCommands({ globalStorageUri: { fsPath: root }, extension: { id: 'sysung.piarre-candidate', packageJSON: { version: '0.0.1' } } }, () => options.repository);
  t.after(() => disposable.dispose());
  return { root, name, store, calls, commands };
}

test('retained picker identifies capture, privacy, expiry and pseudonymous project; export follows preview and confirmation', async t => {
  const fixture = await controller(t);
  await fixture.commands.get('piarre.exportDiagnosticBundle')();
  const picker = fixture.calls.find(call => call.kind === 'pick');
  assert.match(picker.items[0].label, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(picker.items[0].description, 'Metadata only');
  assert.match(picker.items[0].detail, /Expires .*Project ref:a{24}/);
  assert.equal(picker.items[0].name, fixture.name);
  assert.deepEqual(fixture.calls.map(call => call.kind), ['pick', 'preview', 'review', 'confirm', 'destination', 'info']);
  assert.equal(readFileSync(path.join(fixture.root, 'export.json'), 'utf8'), fixture.store.read(fixture.name));
});

test('canceling delete after preview preserves the retained bundle; confirmation deletes it', async t => {
  const canceled = await controller(t, { confirm: false });
  await canceled.commands.get('piarre.deleteDiagnosticBundle')();
  assert.equal(existsSync(canceled.store.path(canceled.name)), true);
  assert.deepEqual(canceled.calls.map(call => call.kind), ['pick', 'preview', 'review', 'confirm']);
  const confirmed = await controller(t);
  await confirmed.commands.get('piarre.deleteDiagnosticBundle')();
  assert.equal(existsSync(confirmed.store.path(confirmed.name)), false);
});

test('dismissing review leaves the file intact without a confirmation or export dialog', async t => {
  const fixture = await controller(t, { review: false });
  await fixture.commands.get('piarre.exportDiagnosticBundle')();
  assert.deepEqual(fixture.calls.map(call => call.kind), ['pick', 'preview', 'review']);
  assert.equal(existsSync(path.join(fixture.root, 'export.json')), false);
  assert.equal(existsSync(fixture.store.path(fixture.name)), true);
});

test('corrupt metadata has a safe picker fallback and remains explicitly deletable', async t => {
  const fixture = await controller(t);
  writeFileSync(fixture.store.path(fixture.name), '{private raw data');
  await fixture.commands.get('piarre.deleteDiagnosticBundle')();
  assert.equal(fixture.calls[0].items[0].label, 'Unreadable diagnostic bundle');
  assert.ok(!JSON.stringify(fixture.calls[0]).includes('private raw data'));
  assert.equal(existsSync(fixture.store.path(fixture.name)), false);
});

test('recording input validates safely and unknown errors never expose their message', async t => {
  const secret = 'private-credential';
  const repository = { readDiagnosticSnapshot() { throw new Error(secret); } };
  const fixture = await controller(t, { repository, link: 'https://example.com/recording', pick: items => items.find(item => item.recording) ?? items[1] });
  await fixture.commands.get('piarre.createDiagnosticBundle')();
  const validate = fixture.calls.find(call => call.kind === 'input').config.validateInput;
  for (const link of ['invalid', `https://user:${secret}@example.com`, `https://example.com?token=${secret}`, 'https://example.com/#fragment', 'https://example.com/' + 'a'.repeat(2048)]) {
    assert.match(validate(link), /HTTPS recording link/);
    assert.ok(!validate(link).includes(secret));
  }
  assert.equal(validate('https://example.com/recording'), undefined);
  assert.equal(validate(''), undefined);
  const error = fixture.calls.find(call => call.kind === 'error').message;
  assert.match(error, /storage permissions/);
  assert.ok(!error.includes(secret));
});

test('known storage capacity and size errors provide corrective guidance without echoing data', t => {
  const store = new bundles.DiagnosticBundleStore(temporary(t));
  for (let i = 0; i < 20; i++) store.save(retained());
  assert.throws(() => store.save(retained()), error => {
    assert.match(bundles.diagnosticFailureMessage(error), /Delete old bundles/);
    return true;
  });
  assert.throws(() => store.save('secret'.repeat(500_000)), error => {
    assert.match(bundles.diagnosticFailureMessage(error), /Choose metadata or a smaller project/);
    return true;
  });
});

test('native collection command reports retention capacity and content size with actionable messages', async t => {
  const snapshot = { revision: 0, repositoryUri: 'file:///piarre-nonexistent-fixture', projectId: 'private-project', executionRuns: [] };
  const repository = { readDiagnosticSnapshot: () => ({ snapshot, events: [] }) };
  const full = await controller(t, { repository, pick: items => items[0].days === 0 ? items[1] : items[0] });
  for (let i = 1; i < 20; i++) full.store.save(retained({ capturedAt: new Date().toISOString() }));
  await full.commands.get('piarre.createDiagnosticBundle')();
  assert.match(full.calls.find(call => call.kind === 'error').message, /Delete old bundles/);
  const oversized = await controller(t, {
    repository: { readDiagnosticSnapshot: () => ({ snapshot: { ...snapshot, name: 'private-secret'.repeat(200_000) }, events: [] }) },
    pick: items => items.find(item => item.value === 'reviewable-content') ?? items[1],
  });
  await oversized.commands.get('piarre.createDiagnosticBundle')();
  const message = oversized.calls.find(call => call.kind === 'error').message;
  assert.match(message, /Choose metadata or a smaller project/);
  assert.ok(!message.includes('private-secret'));
});
