import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
assert.equal(process.platform, 'darwin', 'This proof requires the supported macOS containment runtime');
const output = process.argv[2] ? path.resolve(process.argv[2]) : mkdtempSync(path.join(tmpdir(), 'piarre-supported-execution-'));
mkdirSync(output, { recursive: true });
const reportPath = path.join(output, 'supported-execution-evidence.json');
const report = { schemaVersion: 1, sourceCommit: git('rev-parse', 'HEAD'), sourceDirty: git('status', '--porcelain', '--untracked-files=all') !== '',
  bundleSha256: hash(readFileSync(path.join(root, 'apps/vscode/dist/extension.js'))), platform: process.platform, node: process.version,
  command: ['node', 'scripts/verify-supported-execution.mjs'], results: [], skips: [], errors: [],
  logPath: 'supported-execution.log', logSha256: '' };
const logs = [];
const run = (file, args = []) => {
  const result = spawnSync(process.execPath, [file, ...args], { cwd: root, encoding: 'utf8', timeout: 240_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, PIARRE_TEST_NODE: process.execPath } });
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  logs.push(text); process.stdout.write(text);
  assert.equal(result.status, 0, result.error?.message ?? 'Supported execution proof failed');
};
try {
  const suites = ['candidate-check-runner', 'execution-coordinator'];
  for (const name of suites) await build({ entryPoints: [path.join(root, `apps/vscode/test/suite/${name}.test.ts`)], outfile: path.join(output, `${name}.cjs`), bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
  const entry = path.join(output, 'containment.cjs');
  const suiteFiles = suites.map(name => path.join(output, `${name}.cjs`));
  writeFileSync(entry, `const assert=require('node:assert/strict');const Mocha=require(${JSON.stringify(path.join(root, 'node_modules/mocha'))});const mocha=new Mocha({ui:'tdd',timeout:10000,color:false});${JSON.stringify(suiteFiles)}.forEach(file=>mocha.addFile(file));mocha.run(failures=>{assert.equal(mocha.stats.pending,0,'Supported proof cannot skip containment checks');process.exitCode=failures?1:0;});\n`);
  run(entry);
  report.results.push({ name: 'supported macOS containment and correction journey', status: 'passed', skipped: false,
    note: 'Real Seatbelt checks and SQLite/coordinator journeys with a deterministic patch provider; separate live proof below.' });
  const live = path.join(output, 'live.mjs');
  await build({ entryPoints: [path.join(root, 'scripts/supported-execution-fixture.mjs')], outfile: live, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  run(live, [path.join(output, 'live-result.json')]);
  const observed = JSON.parse(readFileSync(path.join(output, 'live-result.json'), 'utf8'));
  report.provider = observed.provider;
  report.results.push(...observed.results);
} catch (error) {
  report.errors.push(error instanceof Error ? error.message : 'Supported proof failed');
  process.exitCode = 1;
} finally {
  const log = logs.join('\n');
  writeFileSync(path.join(output, report.logPath), log || 'Proof failed before launching a check.\n');
  report.logSha256 = hash(readFileSync(path.join(output, report.logPath)));
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`Evidence: ${reportPath}\n`);
}
