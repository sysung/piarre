import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { vscodeVersion } from '../config/vscode-version.mjs';
import { isolatedSettings } from '../apps/vscode/test/profile-settings.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [container, destination] = process.argv.slice(2);
assert(container && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/.test(container) && process.argv.length <= 4,
  'Use node scripts/verify-intent-prototype.mjs CONTAINER [NEW_OUTPUT_DIRECTORY]');
const output = path.resolve(destination ?? path.join(root, '.artifacts/intent-proof', randomUUID()));
mkdirSync(path.dirname(output), { recursive: true });
mkdirSync(output, { recursive: false });
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, encoding: 'utf8', ...options });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { sourceCommit: run('git', ['rev-parse', 'HEAD']).trim(), sourceDirty: Boolean(run('git', ['status', '--porcelain']).trim()),
  vscode: vscodeVersion, platform: 'linux', productReady: false, modelRequests: 0, nativeConsent: 'scripted native choice dialogs; not a human usability trial', passed: false };
const nativeRoot = `/tmp/piarre-intent-${randomUUID()}`;
try {
  run('npm', ['run', 'build']);
  run('npm', ['run', 'test:compile', '--workspace', 'apps/vscode']);
  const suites = ['intent-document', 'intent-documents', 'intent-commands', 'knowledge', 'resumption', 'execution-state'];
  await build({ stdin: { contents: `
    import Mocha from 'mocha';
    import {Spec} from 'mocha/lib/reporters/spec.js';
    import path from 'node:path';
    import fs from 'node:fs';
    import {DatabaseSync} from 'node:sqlite';
    import {createHash} from 'node:crypto';
    import * as vscode from 'vscode';
    export function run() {
      const mocha = new Mocha({ui:'tdd',reporter:Spec,timeout:15000,color:false});
      ${JSON.stringify(suites)}.forEach(name=>mocha.addFile(path.join(__dirname,name+'.test.js')));
      return new Promise((resolve,reject)=>{ const runner=mocha.run(failures=>{
        const extension=vscode.extensions.getExtension('sysung.piarre');
        const details={passes:runner.stats.passes,failures,pending:runner.stats.pending,vscode:vscode.version,extensionPath:extension?.extensionPath,runtimeSha256:extension?createHash('sha256').update(fs.readFileSync(path.join(extension.extensionPath,'dist/extension.js'))).digest('hex'):null,projects:[]};
        try {
          const directory=path.join(process.env.PIARRE_INTENT_PROFILE,'User/globalStorage/sysung.piarre/projects');
          for(const name of fs.readdirSync(directory)) {
            const database=new DatabaseSync(path.join(directory,name,'project.sqlite'),{readOnly:true});
            try {
              const events=database.prepare('SELECT payload FROM events ORDER BY revision').all().map(row=>JSON.parse(row.payload));
              details.projects.push({events:events.map(event=>event.kind),adoptions:events.filter(event=>event.kind==='intent-document-adopted').length});
            } finally {database.close();}
          }
          fs.writeFileSync(process.env.PIARRE_INTENT_RESULT,JSON.stringify(details,null,2)+'\\n');
          if(failures||details.pending||vscode.version!==${JSON.stringify(vscodeVersion)}||details.projects.reduce((n,p)=>n+p.adoptions,0)!==1||details.projects.some(p=>p.events.some(kind=>kind==='execution-recorded'||kind==='proposal-created'||kind==='coordination-recorded'))) throw new Error('Native intent evidence did not satisfy the prototype boundary');
          resolve();
        } catch(error) {reject(error);}
      }); });
    }`, resolveDir: root, sourcefile: 'intent-native-proof.mjs' },
    bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['vscode'],
    outfile: path.join(output, 'native-index.cjs'), logLevel: 'silent' });
  const archive = path.join(output, 'candidate.tgz');
  run('tar', ['--format=ustar', '-czf', archive, 'apps/vscode/dist', 'apps/vscode/package.json', 'apps/vscode/README.md', 'apps/vscode/native', 'apps/vscode/dist-test/suite'], {env:{...process.env,COPYFILE_DISABLE:'1'}});
  run('docker', ['exec', container, 'mkdir', '-p', `${nativeRoot}/app`, `${nativeRoot}/workspace/.git`, `${nativeRoot}/extensions`, `${nativeRoot}/user-data/User`]);
  writeFileSync(path.join(output, 'settings.json'), JSON.stringify(isolatedSettings));
  run('docker', ['cp', path.join(output, 'settings.json'), `${container}:${nativeRoot}/user-data/User/settings.json`]);
  run('docker', ['cp', archive, `${container}:${nativeRoot}/candidate.tgz`]);
  run('docker', ['exec', container, 'tar', '-xzf', `${nativeRoot}/candidate.tgz`, '-C', `${nativeRoot}/app`]);
  run('docker', ['cp', path.join(output, 'native-index.cjs'), `${container}:${nativeRoot}/app/apps/vscode/dist-test/suite/intent-proof.cjs`]);
  run('docker', ['exec', container, 'git', 'init', '-q', `${nativeRoot}/workspace`]);
  const result = spawnSync('docker', ['exec', '--env', 'DISPLAY=:99', '--env', 'PIARRE_INTENT_NATIVE=1',
    '--env', `PIARRE_INTENT_PROFILE=${nativeRoot}/user-data`, '--env', `PIARRE_INTENT_RESULT=${nativeRoot}/native-result.json`,
    container, '/usr/share/code/code', `${nativeRoot}/workspace`, '--no-sandbox', '--disable-gpu', '--disable-extensions',
    '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', `--user-data-dir=${nativeRoot}/user-data`,
    `--extensions-dir=${nativeRoot}/extensions`, `--extensionDevelopmentPath=${nativeRoot}/app/apps/vscode`,
    `--extensionTestsPath=${nativeRoot}/app/apps/vscode/dist-test/suite/intent-proof.cjs`],
  { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
  const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  writeFileSync(path.join(output, 'native.log'), log);
  process.stdout.write(log.split('\n').filter(line=>/passing|failing|^\s*[✔✓]|Intent|Error:/.test(line)).join('\n')+'\n');
  report.exitCode = result.status;
  report.logSha256 = hash(log);
  report.runtimeSha256 = hash(readFileSync(path.join(root, 'apps/vscode/dist/extension.js')));
  assert.equal(result.status, 0, result.error?.message ?? 'Native intent proof failed');
  run('docker', ['cp', `${container}:${nativeRoot}/native-result.json`, path.join(output, 'native-result.json')]);
  report.native = JSON.parse(readFileSync(path.join(output, 'native-result.json'), 'utf8'));
  assert.equal(report.native.runtimeSha256, report.runtimeSha256, 'Native extension must match the built candidate');
  report.passed = true;
} catch (error) {
  report.error = error instanceof Error ? error.message : 'Intent proof failed';
  process.exitCode = 1;
} finally {
  report.containerFixture = nativeRoot;
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`Intent proof: ${path.join(output, 'report.json')}\n`);
}
