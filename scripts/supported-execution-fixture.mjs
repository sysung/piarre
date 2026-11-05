import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SqliteProjectRepository } from '../apps/vscode/src/sqlite-project-repository.ts';
import { ExecutionCoordinator } from '../apps/vscode/src/execution-coordinator.ts';
import { CodexConversationClient } from '../apps/vscode/src/codex-conversation-client.ts';
import { GoalInterpreter } from '../apps/vscode/src/goal-interpreter.ts';
import { CandidateCheckRunner } from '../apps/vscode/src/candidate-check-runner.ts';

const directory = mkdtempSync(path.join(tmpdir(), 'piarre-live-execution-'));
const source = path.join(directory, 'source');
const storage = path.join(directory, 'storage');
mkdirSync(source); mkdirSync(storage);
const file = path.join(source, 'refund.txt');
writeFileSync(file, '30\n');
const database = path.join(directory, 'project.sqlite');
const repository = new SqliteProjectRepository(database);
let control;
try {
  const capability = await new CandidateCheckRunner().capability();
  assert.equal(capability.kind, 'supported', 'Actual supported containment is required before paid generation');
  const project = repository.open({ repositoryUri: pathToFileURL(source).href, name: 'Disposable authenticated proof' });
  const draft = await new GoalInterpreter().propose('Change only the disclosed refund.txt to exactly 45 followed by a newline.');
  repository.dispatch({ commandId: 'fixture-proposal', projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: 'propose-tasks', draft } });
  const task = repository.read().tasks[0]; assert.ok(task);
  let consentCount = 0;
  control = new ExecutionCoordinator({ repository, storageDirectory: storage, createClient: () => new CodexConversationClient(), publish: () => undefined,
    confirmSpending: async disclosure => {
      assert.match(disclosure, /Exact files: refund\.txt/);
      assert.match(disclosure, /No dollar cap/);
      assert.match(disclosure, /120 seconds/);
      assert.equal(++consentCount, 1, 'Only one authenticated attempt is authorized by this fixture');
      process.stdout.write('Reviewed disposable one-file scope and one-attempt spending disclosure.\n');
      return 'consent';
    } });
  const { plan } = await control.prepare({ taskId: task.taskId, relativePaths: ['refund.txt'], objective: 'Replace refund.txt with exactly 45 and a trailing newline. Return one file replacement; do not use tools.',
    criteria: [{ criterionId: 'window', text: 'The captured file is exactly 45 and a newline.' }],
    checks: [{ checkId: 'window', argv: [process.execPath, '-e', "require('node:assert/strict').equal(require('node:fs').readFileSync('refund.txt','utf8'),'45\\n')"], criterionIds: ['window'] }],
    durationMs: 120_000, maxTokens: 2048 });
  assert.ok(['chatgpt', 'apiKey'].includes(plan.provider.authType));
  const result = await control.approveAndRun({ planId: plan.planId, planRevision: plan.recordedAtRevision, approvalId: 'one-live-attempt' });
  assert.equal(consentCount, 1);
  assert.equal(result.state.kind, 'terminal');
  assert.equal(result.state.result.outcome, 'needs-review', JSON.stringify(result.state));
  assert.equal(result.providerTurn.kind, 'turn');
  assert.equal(result.providerOutcome.kind, 'observed');
  assert.equal(result.providerOutcome.status, 'completed');
  assert.equal(result.providerObservation.kind, 'observed');
  assert.ok(result.evidence.length > 0 && result.evidence.every(item => item.kind === 'passed'));
  assert.equal(readFileSync(file, 'utf8'), '30\n', 'Passing scoped checks alone do not apply changes');
  const manual = 'User manual edit after candidate checks.\n';
  writeFileSync(file, manual);
  await assert.rejects(control.applyAndAccept({ runId: result.runId, resultId: result.state.result.resultId,
    resultRevision: result.state.result.recordedAtRevision, operationId: 'refuse-overwrite-manual-edit' }));
  assert.equal(readFileSync(file, 'utf8'), manual);
  control.dispose(); control = undefined;
  const durable = repository.read(); repository.close();
  const reopened = new SqliteProjectRepository(database);
  try { assert.deepEqual(reopened.read(), durable); } finally { reopened.close(); }
  writeFileSync(process.argv[2], JSON.stringify({ provider: { kind: 'codex', authRoute: plan.provider.authType,
    model: result.providerObservation.model, threadId: result.providerTurn.threadId, turnId: result.providerTurn.turnId },
    results: [
      { name: 'authenticated bounded Codex execution with current checks', status: 'passed', skipped: false, runId: result.runId, directory,
        note: 'Actual Codex app-server and actual Seatbelt checks. Scripted review callback checks exact scope; native consent is covered separately.' },
      { name: 'manual edit preserved after authenticated proposal', status: 'passed', skipped: false, runId: result.runId,
        note: 'Actual source write after passing candidate checks was preserved; apply-and-accept rejected and SQLite reopened unchanged.' },
    ] }, null, 2) + '\n');
  process.stdout.write('Authenticated provider result checked; manual edit preserved; state reopened.\n');
} finally {
  control?.dispose(); repository.close();
}
