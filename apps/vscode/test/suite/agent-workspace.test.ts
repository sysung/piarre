import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as vscode from "vscode";
import { CandidateCheckRunner } from "../../src/candidate-check-runner.js";
import type { CodexConversationClient } from "../../src/codex-conversation-client.js";
import { ExecutionCoordinator } from "../../src/execution-coordinator.js";
import type { ExecutionMessage } from "../../src/execution-actions.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { WorkView } from "../../src/work-view.js";

const nodeExecutable = process.env.PIARRE_TEST_NODE ?? process.execPath;
type Client = Pick<CodexConversationClient, "connect" | "readExecutionContext" | "proposePatch" | "interrupt" | "dispose">;
type Scenario = "apply" | "stale" | "stop";

// Only provider output and native-dialog approval are fixtures. The webview, message parser,
// coordinator, candidate files, contained check process, journal and SQLite are real.
suite("Agent workspace actual execution journey", () => {
  for (const scenario of ["apply", "stale", "stop"] satisfies Scenario[]) {
    test(`webview ${scenario} preserves input and enforces recorded execution authority`, async function () {
      this.timeout(45_000);
      if ((await new CandidateCheckRunner().capability()).kind === "unsupported") { this.skip(); return; }
      const directory = mkdtempSync(path.join(tmpdir(), "piarre-agent-workspace-"));
      const source = path.join(directory, "source"); const storage = path.join(directory, "storage");
      mkdirSync(source); mkdirSync(storage);
      const sourceFile = path.join(source, "refund.txt");
      writeFileSync(sourceFile, "30\n"); writeFileSync(path.join(source, "private.txt"), "undisclosed\n");
      const repository = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
      const project = repository.open({ repositoryUri: pathToFileURL(source).href, name: "Agent journey fixture" });
      const draft = await new GoalInterpreter().propose("Set the refund window to 45 days");
      repository.dispatch({ commandId: "fixture-proposal", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "propose-tasks", draft } });
      const task = repository.read().tasks[0]; assert.ok(task);
      let requests = 0; let interruptions = 0;
      let releaseProvider: () => void = () => { throw new Error("Provider has not started"); };
      let interruptProvider: () => void = () => undefined;
      const createClient = (): Client => ({
        connect: () => Promise.resolve({ kind: "ready", authType: "unknown" }),
        readExecutionContext: () => Promise.resolve({ model: { kind: "resolved-default", model: "fixture-model" }, usage: { kind: "unknown" }, observedAt: new Date().toISOString() }),
        proposePatch: input => {
          requests++;
          input.onThreadMetadata?.({ model: "fixture-model", modelProvider: "openai" });
          input.onThreadStarted?.("fixture-thread"); input.onTurnStarted?.("fixture-thread", "fixture-turn");
          const prompt: unknown = JSON.parse(input.prompt);
          assert.ok(typeof prompt === "object" && prompt !== null && "files" in prompt && Array.isArray(prompt.files));
          assert.equal(prompt.files.length, 1, "Undisclosed files must not reach the bounded provider");
          const file: unknown = prompt.files[0]; assert.ok(typeof file === "object" && file !== null && "baseline" in file);
          const baseline = file.baseline; assert.ok(typeof baseline === "object" && baseline !== null && "fileId" in baseline && typeof baseline.fileId === "string");
          const fileId = baseline.fileId;
          return new Promise(resolve => {
            interruptProvider = () => { resolve({ status: "interrupted", threadId: "fixture-thread", turnId: "fixture-turn", output: null }); };
            releaseProvider = () => { resolve({ status: "completed", threadId: "fixture-thread", turnId: "fixture-turn", output: { summary: "Fixture proposed a 45-day window", operations: [{ fileId, content: "45\n" }] } }); };
          });
        },
        interrupt: () => { interruptions++; interruptProvider(); return Promise.resolve(); },
        dispose: () => undefined,
      });
      let mainPanel: vscode.WebviewPanel | undefined;
      let reviewPanel: vscode.WebviewPanel | undefined;
      let explicitApproval: (() => Promise<void>) | undefined;
      const calls: ExecutionMessage[] = [];
      let capturedReview: unknown;
      let completion: Promise<void> | undefined;
      let finish: (value: unknown) => void = () => undefined;
      const observed = new Promise<unknown>(resolve => { finish = resolve; });
      const deadline = setTimeout(() => { finish({ kind: "journey-result", ok: false, error: "Agent workspace host journey timed out" }); }, 30_000);
      const coordinator = new ExecutionCoordinator({ repository, storageDirectory: storage, createClient, confirmSpending: detail => { assert.match(detail, /provider has no supported per-turn included-only/); assert.match(detail, /Exact files: refund.txt/); return Promise.resolve("consent"); }, publish: snapshot => { view.update(snapshot); } });
      const fail = (error: unknown): void => { finish({ kind: "journey-result", ok: false, error: String(error) }); };
      const handle = async (message: ExecutionMessage): Promise<void> => {
        calls.push(message);
        try {
          if (message.action === "prepare" && "id" in message) {
            assert.equal(message.id, task.taskId); assert.equal(requests, 0);
            const prepared = await coordinator.prepare({ taskId: message.id, relativePaths: ["refund.txt"], objective: "Set the refund window to 45 days", criteria: [{ criterionId: "days", text: "Refund window is 45 days" }],
              checks: [{ checkId: "refund-value", argv: [nodeExecutable, "-e", "require('node:assert/strict').equal(require('node:fs').readFileSync('refund.txt','utf8'),'45\\n');console.log('scoped refund check passed')"], criterionIds: ["days"] }] });
            assert.equal(requests, 0); assert.equal(readFileSync(sourceFile, "utf8"), "30\n");
            // The browser explicitly invokes this held callback instead of automating a native dialog.
            explicitApproval = async () => {
              const run = await coordinator.approveAndRun({ planId: prepared.plan.planId, planRevision: prepared.plan.recordedAtRevision, approvalId: `fixture-explicit-${scenario}` });
              assert.equal(run.state.kind, "terminal");
              assert.equal(readFileSync(sourceFile, "utf8"), "30\n", "Generation and checks cannot integrate source");
              if (scenario === "stop") {
                assert.equal(interruptions, 1); assert.equal(run.state.result.outcome, "failed"); assert.match(run.state.result.summary, /interruption was observed/); assert.equal(run.evidence.length, 0);
              } else {
                assert.equal(run.state.result.outcome, "needs-review"); assert.equal(run.evidence[0]?.kind, "passed");
                assert.equal(run.evidence[0].termination, "observed");
                assert.match(run.evidence[0].stdout, /scoped refund check passed/);
                assert.equal(readFileSync(path.join(coordinator.candidateForRun(run.runId).root, "refund.txt"), "utf8"), "45\n");
              }
              await mainPanel?.webview.postMessage({ kind: "journey-terminal", runId: run.runId });
            };
            await mainPanel?.webview.postMessage({ kind: "journey-prepared" });
          } else if (message.action === "stop" && "id" in message) {
            assert.equal(message.id, repository.read().executionRuns[0]?.runId);
            await coordinator.stop({ runId: message.id });
          } else if (message.action === "view" && "id" in message) {
            view.openExecutionResult(message.id); assert.ok(reviewPanel);
            reviewPanel.webview.html = reviewPanel.webview.html.replace("</script>", `${reviewScript()}</script>`);
          } else if (message.action === "apply-accept" && "id" in message) {
            const run = repository.read().executionRuns.find(item => item.runId === message.id); assert.ok(run); assert.equal(run.state.kind, "terminal");
            if (scenario === "stale") {
              assert.throws(() => coordinator.reviewResult(run.runId), /changed|stale/i);
              assert.equal(readFileSync(sourceFile, "utf8"), "30\n");
              assert.equal(repository.read().executionRuns[0]?.acceptance.kind, "unreviewed");
            } else {
              assert.equal((await coordinator.confirmResult(coordinator.reviewResult(run.runId).binding)).acceptance.kind, "accepted");
              assert.equal(readFileSync(sourceFile, "utf8"), "45\n");
            }
            finish({ kind: "journey-result", ok: true });
          }
        } catch (error) { fail(error); }
      };
      const view = new WorkView((...args) => {
        const panel = vscode.window.createWebviewPanel(...args);
        if (args[0] === "piarre.work") mainPanel = panel; else if (args[0] === "piarre.execution") reviewPanel = panel;
        panel.webview.onDidReceiveMessage((message: unknown) => {
          if (typeof message !== "object" || message === null || !("kind" in message)) return;
          if (message.kind === "journey-result") finish(message);
          if (message.kind === "send-conversation") fail(new Error("Unsent task crossed the conversation bridge"));
          if (message.kind === "journey-approve-fixture") {
            assert.ok(explicitApproval); completion = explicitApproval(); void completion.catch(fail);
          }
          if (message.kind === "journey-release-provider") releaseProvider();
          if (message.kind === "journey-refresh") view.update(repository.read());
          if (message.kind === "journey-stale-replayed") {
            assert.equal(calls.some(call => call.action === "apply-accept"), false);
            finish({ kind: "journey-result", ok: true });
          }

        });
        if (args[0] !== "piarre.execution" || scenario !== "stale") return panel;
        const webview = new Proxy(panel.webview, { get: (target, key) => {
          if (key === "onDidReceiveMessage") return (listener: (message: unknown) => void) => target.onDidReceiveMessage((message: unknown) => {
            if (capturedReview === undefined && typeof message === "object" && message !== null && "kind" in message && message.kind === "detail-action") {
              capturedReview = message;
              const run = repository.read().executionRuns[0]; assert.ok(run);
              writeFileSync(path.join(coordinator.candidateForRun(run.runId).root, "refund.txt"), "unverified candidate edit\n");
              coordinator.refreshWorkspaceFreshness();
              assert.equal(repository.read().executionRuns[0]?.reviewFreshness.kind, "stale");
              assert.doesNotMatch(panel.webview.html, /data-execution-action="apply-accept"/);
              assert.throws(() => coordinator.reviewResult(run.runId), /changed|stale/i);
              panel.webview.html = panel.webview.html.replace("</script>", `api.postMessage(${JSON.stringify(capturedReview).replaceAll("<", "\\u003c")});api.postMessage({kind:'journey-stale-replayed'});</script>`);
              return;
            }
            listener(message);
          });
          const value: unknown = Reflect.get(target, key);
          return typeof value === "function" ? (...args: unknown[]) => Reflect.apply(value, target, args) as unknown : value;
        } });
        return new Proxy(panel, { get: (target, key) => {
      if (key === "webview") return webview;
      const value: unknown = Reflect.get(target, key);
      return typeof value === "function" ? (...args: unknown[]) => Reflect.apply(value, target, args) as unknown : value;
    } });
      }, undefined, undefined, undefined, { handle, renderDetails: runId => `<pre>${JSON.stringify(coordinator.inspection({ runId }).diff)}</pre>` });
      try {
        view.show(repository.read()); assert.ok(mainPanel);
        mainPanel.webview.html = mainPanel.webview.html.replace("</script>", `${mainScript(scenario)}</script>`);
        assert.deepEqual(await observed, { kind: "journey-result", ok: true });
        await completion;
        assert.equal(requests, 1);
        assert.equal(readFileSync(path.join(source, "private.txt"), "utf8"), "undisclosed\n");
        const run = repository.read().executionRuns[0]; assert.ok(run);
        assert.ok(calls.some(call => call.action === "prepare" && "id" in call && call.id === task.taskId));
        if (scenario === "stale") assert.ok(capturedReview);
        else assert.ok(calls.some(call => call.action === (scenario === "stop" ? "stop" : "apply-accept") && "id" in call && call.id === run.runId));
        coordinator.dispose();
        const durable = repository.read();
        repository.close();
        const reopened = new SqliteProjectRepository(path.join(directory, "project.sqlite"));
        try { assert.deepEqual(reopened.read(), durable, "Run evidence and acceptance must survive SQLite replay"); } finally { reopened.close(); }
      } finally {
        clearTimeout(deadline);
        interruptProvider(); await completion?.catch(() => undefined);
        coordinator.dispose(); view.dispose(); repository.close(); rmSync(directory, { recursive: true, force: true });
      }
    });
  }
});

function mainScript(scenario: Scenario): string {
  return `
(async () => {
  const waitFor = async condition => { const deadline=Date.now()+20000; while(!condition()){if(Date.now()>deadline)throw new Error('Journey webview condition timed out');await new Promise(resolve=>setTimeout(resolve,10));} };
  let prepared=false, terminal;
  window.addEventListener('message',({data})=>{if(data.kind==='journey-prepared')prepared=true;if(data.kind==='journey-terminal')terminal=data;});
  try {
    const overview=document.getElementById('agent-overview'), discussion=document.getElementById('discussion');
    if(discussion.open || overview.closest('details:not([open])') || getComputedStyle(overview).display==='none')throw new Error('Agent work must be visible and discussion collapsed');
    const controls=document.getElementById('execution-controls');
    if(controls.closest('#inspection') || !controls.querySelector('[data-execution-action="pause-all"]'))throw new Error('Execution controls unavailable outside inspection');
    goal.value='private unsent task'; goal.dispatchEvent(new Event('input')); goal.focus(); goal.setSelectionRange(2,8);
    const stable=()=>{if(goal.value!=='private unsent task'||document.activeElement!==goal||goal.selectionStart!==2||goal.selectionEnd!==8)throw new Error('External update lost unsent input, focus or selection');};
    const marker=document.createElement('span'); marker.id='journey-refresh-marker'; overview.append(marker);
    api.postMessage({kind:'journey-refresh'}); await waitFor(()=>!document.getElementById('journey-refresh-marker')); stable();
    overview.querySelector('[data-execution-action="prepare"]').click(); await waitFor(()=>prepared); stable();
    api.postMessage({kind:'journey-approve-fixture'});
    await waitFor(()=>overview.textContent.includes('fixture-thread')&&overview.textContent.includes('fixture-turn'));
    stable();
    for(const expected of ['Coding worker','Assigned work','Scope','refund.txt','Session','Generating candidate'])if(!overview.textContent.includes(expected))throw new Error('Missing worker fact: '+expected);
    const stop=document.querySelector('#execution-controls [data-execution-action="stop"]');
    if(!stop || stop.closest('details:not([open])') || stop.closest('#inspection'))throw new Error('Stop is hidden inside inspector');
    const runId=stop.dataset.executionId;
    if(${JSON.stringify(scenario)}==='stop')stop.click();else api.postMessage({kind:'journey-release-provider'});
    await waitFor(()=>terminal); stable();
    if(runId!==terminal.runId)throw new Error('Status and stop addressed different runs');
    if(${JSON.stringify(scenario)}==='stop') {
      if(document.querySelector('#execution-controls [data-execution-action="stop"]'))throw new Error('Confirmed terminal run retains stop control');
      api.postMessage({kind:'journey-result',ok:true});
    }else{
      if(!overview.textContent.includes('review and acceptance needed'))throw new Error('Checks mistaken for acceptance');
      overview.querySelector('[data-execution-action="view"][data-execution-id="'+runId+'"]').click();
    }
  } catch(error){api.postMessage({kind:'journey-result',ok:false,error:String(error)});}
})();`;
}

function reviewScript(): string {
  return `
try {
  const text=document.body.textContent;
  for(const expected of ['Passed scoped checks','Acceptance: unreviewed','scoped refund check passed','refund.txt','SHA-256'])if(!text.includes(expected))throw new Error('Missing exact review evidence: '+expected);
  const apply=document.querySelector('[data-execution-action="apply-accept"]');
  if(!apply)throw new Error('Current passing result has no explicit acceptance action');
  apply.click();
}catch(error){api.postMessage({kind:'journey-result',ok:false,error:String(error)});}`;
}
