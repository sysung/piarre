import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
assert.ok(args.length <= 3, 'Usage: node scripts/test-installed-candidate.mjs [container] [candidate-package-directory] [output-directory]');
const container = args[0] ?? 'piarre-sandbox-piarre-1';
const packageDirectory = path.resolve(args[1] ?? path.join(root, 'apps/vscode/dist-package/candidate'));
const output = args[2] ? path.resolve(args[2]) : mkdtempSync(path.join(tmpdir(), 'piarre-c07-evidence-'));
mkdirSync(output, { recursive: true });
assert.deepEqual(readdirSync(output), [], 'Evidence output directory must be empty so a failed run cannot retain an older passing report');
const runId = randomUUID();
const debugPort = 20_000 + Number.parseInt(runId.slice(0, 4), 16) % 30_000;
const isolated = `/tmp/piarre-c07-${runId}`;
const local = mkdtempSync(path.join(tmpdir(), 'piarre-c07-input-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const docker = (...parameters) => execFileSync('docker', parameters, { encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
const inside = (...parameters) => docker('exec', container, ...parameters);
const git = (...parameters) => execFileSync('git', parameters, { cwd: root, encoding: 'utf8' }).trim();
const info = JSON.parse(readFileSync(path.join(packageDirectory, 'build-info.json'), 'utf8'));
assert.equal(info.extensionId, 'sysung.piarre-candidate');
assert.equal(info.commit, git('rev-parse', 'HEAD'), 'Package provenance must name the current source commit');
const filename = `piarre-candidate-${info.version}.vsix`;
const checksums = readFileSync(path.join(packageDirectory, 'SHA256SUMS'), 'utf8');
for (const name of [filename, 'build-info.json']) {
  assert.ok(checksums.split('\n').includes(`${hash(readFileSync(path.join(packageDirectory, name)))}  ${name}`), `Verify ${name} checksum`);
  copyFileSync(path.join(packageDirectory, name), path.join(output, name));
}
copyFileSync(path.join(packageDirectory, 'SHA256SUMS'), path.join(output, 'SHA256SUMS'));
const vsixSha256 = hash(readFileSync(path.join(packageDirectory, filename)));
const packagedBundle = execFileSync('unzip', ['-p', path.join(packageDirectory, filename), 'extension/dist/extension.js'], { maxBuffer: 16 * 1024 * 1024 });
const bundleSha256 = hash(packagedBundle);
writeFileSync(path.join(local, 'piarre.tar'), execFileSync('git', ['archive', '--format=tar', info.commit], { cwd: root, maxBuffer: 32 * 1024 * 1024 }));
copyFileSync(path.join(root, 'test/installed-candidate/journey.mjs'), path.join(local, 'journey.mjs'));
writeFileSync(path.join(local, 'entry.cjs'), `exports.run = () => import(${JSON.stringify(`${isolated}/input/journey.mjs`)}).then(module => module.run());\n`);
inside('mkdir', '-p', `${isolated}/input`, `${isolated}/repositories/piarre`, `${isolated}/repositories/counter`, `${isolated}/stable`, `${isolated}/results`, `${isolated}/exports`, `${isolated}/profile/User`, `${isolated}/extensions`);
docker('cp', `${local}/.`, `${container}:${isolated}/input/`);
docker('cp', path.join(packageDirectory, filename), `${container}:${isolated}/input/${filename}`);
inside('tar', '-xf', `${isolated}/input/piarre.tar`, '-C', `${isolated}/repositories/piarre`);
const settings = { 'security.workspace.trust.enabled': false, 'workbench.startupEditor': 'none', 'window.restoreWindows': 'none', 'extensions.autoUpdate': false, 'extensions.autoCheckUpdates': false, 'update.mode': 'none', 'telemetry.telemetryLevel': 'off' };
writeFileSync(path.join(local, 'settings.json'), JSON.stringify(settings));
docker('cp', path.join(local, 'settings.json'), `${container}:${isolated}/profile/User/settings.json`);
const counter = `export function increment(value) { return value + 1; }\n// C07_COUNTER_SOURCE\n`;
writeFileSync(path.join(local, 'counter.mjs'), counter);
writeFileSync(path.join(local, 'manual-note.txt'), 'User-authored manual note must remain byte-for-byte unchanged.\n');
docker('cp', path.join(local, 'counter.mjs'), `${container}:${isolated}/repositories/counter/counter.mjs`);
for (const context of ['counter', 'piarre']) {
  docker('cp', path.join(local, 'manual-note.txt'), `${container}:${isolated}/repositories/${context}/manual-note.txt`);
  inside('git', '-C', `${isolated}/repositories/${context}`, 'init', '-q');
  inside('git', '-C', `${isolated}/repositories/${context}`, 'add', '.');
  inside('git', '-C', `${isolated}/repositories/${context}`, '-c', 'user.name=C07 Fixture', '-c', 'user.email=c07@example.invalid', 'commit', '-qm', `Disposable ${context} source fixture`);
}
const stableSentinel = `Stable profile sentinel ${runId}\n`;
writeFileSync(path.join(local, 'sentinel'), stableSentinel);
docker('cp', path.join(local, 'sentinel'), `${container}:${isolated}/stable/sentinel`);
const profile = ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--user-data-dir', `${isolated}/profile`, '--extensions-dir', `${isolated}/extensions`];
inside('code', ...profile, '--install-extension', `${isolated}/input/${filename}`, '--force');
const installed = inside('code', ...profile, '--list-extensions', '--show-versions').trim().split(/\r?\n/).filter(Boolean);
assert.deepEqual(installed, [`sysung.piarre-candidate@${info.version}`]);
const installedPath = `${isolated}/extensions/sysung.piarre-candidate-${info.version}`;
assert.equal(inside('sha256sum', `${installedPath}/dist/extension.js`).split(' ')[0], bundleSha256);
const results = [];
const capturedLogs = [];
const secret = 'sk-C07SyntheticSecret0123456789';
for (const context of ['counter', 'piarre']) {
  const repository = `${isolated}/repositories/${context}`;
  const repositoryUri = `file://${repository}`;
  const databasePath = `${isolated}/profile/User/globalStorage/sysung.piarre-candidate/projects/${hash(repositoryUri)}/project.sqlite`;
  const repositoryCommit = inside('git', '-C', repository, 'rev-parse', 'HEAD').trim();
  for (const phase of ['create', 'reopen']) {
    const config = { context, phase, repository, databasePath, installedPath, sourceCommit: info.commit, vsixSha256, bundleSha256,
      debugPort: debugPort + results.length, screenshotPath: `${isolated}/results/${context}-${phase}.png`,
      repositoryCommit, diagnosticsPath: `${isolated}/profile/User/globalStorage/sysung.piarre-candidate/diagnostics`, secret,
      sourceFile: context === 'counter' ? 'counter.mjs' : 'apps/vscode/src/extension.ts', sourceMarker: context === 'counter' ? 'C07_COUNTER_SOURCE' : 'piarre.proposeTask',
      goal: `${context === 'counter' ? 'Add a decrement operation to the independent counter app' : 'Improve Piarre proposal review so source context remains inspectable before execution'}. Synthetic redaction fixture ${secret}`,
      exportPath: `${isolated}/exports/${context}.json`, resultPath: `${isolated}/results/${context}-${phase}.json` };
    writeFileSync(path.join(local, 'config.json'), JSON.stringify(config));
    docker('cp', path.join(local, 'config.json'), `${container}:${isolated}/input/config.json`);
    const command = ['exec', '-e', 'DISPLAY=:99', '-e', `PIARRE_INSTALLED_JOURNEY=${isolated}/input/config.json`, container, 'timeout', '--kill-after=5s', '80s', '/usr/share/code/code', ...profile,
      `--remote-debugging-port=${config.debugPort}`, '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--new-window', '--extensionDevelopmentPath', installedPath, '--extensionTestsPath', `${isolated}/input/entry.cjs`, repository];
    const child = spawnSync('docker', command, { encoding: 'utf8', timeout: 90_000, maxBuffer: 4 * 1024 * 1024 });
    const logName = `${context}-${phase}.log`;
    writeFileSync(path.join(output, logName), `${child.stdout ?? ''}\n${child.stderr ?? ''}`);
    capturedLogs.push(logName);
    assert.equal(child.status, 0, `${context} ${phase} native host failed. See ${output}. ${child.error?.message ?? ''}`);
    docker('cp', `${container}:${config.resultPath}`, path.join(output, `${context}-${phase}.json`));
    docker('cp', `${container}:${config.screenshotPath}`, path.join(output, `${context}-${phase}.png`));
    const result = JSON.parse(readFileSync(path.join(output, `${context}-${phase}.json`), 'utf8'));
    assert.equal(result.status, 'passed');
    assert.equal(result.skipped, false);
    results.push(result);
    process.stdout.write(`Passed ${result.name}\n`);
  }
  docker('cp', `${container}:${isolated}/exports/${context}.json`, path.join(output, `${context}-diagnostic.json`));
}
for (let index = 0; index < results.length; index += 2) {
  assert.equal(results[index].projectId, results[index + 1].projectId);
  assert.equal(results[index].proposalId, results[index + 1].proposalId);
  assert.equal(results[index].revision, results[index + 1].revision);
}
assert.notEqual(results[0].projectId, results[2].projectId);
assert.equal(inside('cat', `${isolated}/stable/sentinel`), stableSentinel);
assert.equal(inside('cat', `${isolated}/profile/User/settings.json`), JSON.stringify(settings));
const logPath = 'evidence.log';
writeFileSync(path.join(output, logPath), capturedLogs.map(name => `=== ${name} ===\n${readFileSync(path.join(output, name), 'utf8')}`).join('\n'));
const logSha256 = hash(readFileSync(path.join(output, logPath)));
const report = { schemaVersion: 1, name: 'installed candidate dual repository diagnostics journey', status: 'passed', skipped: false,
  command: ['node', 'scripts/test-installed-candidate.mjs'], logPath, logSha256, skips: [], errors: [],
  sourceCommit: info.commit, sourceDirty: info.dirty || git('status', '--porcelain', '--untracked-files=all') !== '', packagedSourceDirty: info.dirty,
  harnessSha256: hash(readFileSync(fileURLToPath(import.meta.url))), journeySha256: hash(readFileSync(path.join(root, 'test/installed-candidate/journey.mjs'))), vsixSha256, bundleSha256, extensionId: info.extensionId, container,
  platform: results[0].platform, isolatedDirectory: isolated, results, stableSentinelPreserved: true,
  note: 'Only Docker CLI touched the existing container. Owned disposable state is retained for inspection. No host profile or authentication was copied.' };
writeFileSync(path.join(output, 'installed-candidate-evidence.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(`Evidence: ${output}/installed-candidate-evidence.json\n`);
