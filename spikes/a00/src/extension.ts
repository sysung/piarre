import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir, platform, release } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { EvidenceWriter } from './evidence';
import { parseWebviewMessage } from './protocol';
import { sourceRevision } from './revision';
import { manifestSchema, parseResult, untestedFindings, type Finding } from './shared/evidence';
import { parseVoiceConfiguration } from './shared/provider';
import { scenarioIds, scenarios } from './shared/scenarios';

const authorizationSchema = z.object({ value: z.string().min(1), expires_at: z.number(), session: z.object({ model: z.string().min(1) }) });
export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Piarre A00');
  context.subscriptions.push(output);
  let panel: vscode.WebviewPanel | undefined;
  let writer: EvidenceWriter | undefined;
  let findings: Finding[] = untestedFindings('voice');
  const requests = new Map<number, AbortController>();
  const save = async () => { if (writer) await writer.finalize(findings); };
  context.subscriptions.push(vscode.commands.registerCommand('piarre.a00.credential', async () => {
    const value = await vscode.window.showInputBox({ title: 'OpenAI API key for A00 Realtime', password: true, ignoreFocusOut: true, prompt: 'Stored in VS Code SecretStorage. Realtime API billing is separate from Codex plan usage.' });
    if (value?.trim()) await context.secrets.store('a00.voice', value.trim());
  }));
  context.subscriptions.push(vscode.commands.registerCommand('piarre.a00.voice', async () => {
    if (!vscode.workspace.isTrusted) { await vscode.window.showErrorMessage('Open a trusted local workspace for this probe.'); return; }
    if (panel) { panel.reveal(); return; }
    if (!writer) {
      const audioSetup = await vscode.window.showInputBox({ title: 'Audio setup', prompt: 'Name the microphone and headset or speakers. Do not include personal information.', value: 'Built-in microphone and headphones' });
      if (!audioSetup) return;
      const directory = await mkdtemp(join(tmpdir(), 'piarre-a00-voice-'));
      const settings = vscode.workspace.getConfiguration('piarre.a00');
      const provider: unknown = settings.get('voiceProvider', 'mock');
      const configuration = parseVoiceConfiguration(provider === 'openai' ? { provider, model: settings.get('realtimeModel', 'gpt-realtime') } : { provider });
      writer = new EvidenceWriter(directory, manifestSchema.parse({
        experiment: 'voice', probeVersion: '0.0.2', probeRevision: await sourceRevision(context.extensionUri.fsPath), os: `${platform()} ${release()}`, node: process.version,
        startedAt: new Date().toISOString(), editor: `VS Code ${vscode.version}`, audioSetup,
        ...(configuration.provider === 'mock' ? {
          provider: 'Local deterministic mock', model: 'piarre-deterministic-mock-v1', authMechanism: 'None. No credential is read.',
          billing: 'None. Local simulation has no provider billing.', usage: 'Local simulation only.', vad: 'None. Responses are manually simulated.'
        } : {
          provider: 'OpenAI Realtime', model: configuration.model, authMechanism: 'Host API key in SecretStorage or process environment, short-lived client secret in Webview memory',
          billing: 'OpenAI API account required. Live use may incur charges.', usage: 'Unavailable. Inspect account usage separately.', vad: 'server_vad, create_response=true, interrupt_response=true'
        })
      }));
      await save();
      output.appendLine(`Voice evidence directory: ${directory}`);
      output.show(true);
    }
    const activeWriter = writer;
    const mock = activeWriter.manifest.experiment === 'voice' && activeWriter.manifest.provider === 'Local deterministic mock';
    let lastTrial: number | undefined;
    const view = vscode.window.createWebviewPanel('piarre.a00', 'Piarre A00 voice probe', vscode.ViewColumn.One, { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')] });
    panel = view;
    const nonce = randomBytes(24).toString('base64');
    const script = view.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'voice.js'));
    view.webview.html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; connect-src ${mock ? "'none'" : 'https://api.openai.com'}; media-src blob:; style-src 'nonce-${nonce}';"><title>A00 voice probe</title><style nonce="${nonce}">body{max-width:800px;padding:24px;font-family:var(--vscode-font-family)}button,select,textarea{margin:8px 8px 8px 0;font:inherit}textarea{display:block;width:95%;min-height:70px}pre{white-space:pre-wrap}audio{display:block}label{display:block}</style></head><body data-provider="${mock ? 'mock' : 'openai'}"><h1>A00 voice probe</h1>${mock ? '<p role="note"><strong>Mock · simulated provider · microphone active when started</strong></p>' : ''}<p>${mock ? 'Start enables the real microphone and a local simulated provider. No credential or provider billing is used.' : 'Start enables the microphone and a billed OpenAI Realtime session.'} End releases the microphone and connection. Record observations after each procedure in the README.</p><label>Scenario <select id="scenario">${scenarioIds('voice').map(id => `<option value="${id}">${scenarios[id].label}</option>`).join('')}</select></label><button id="start">Start</button><button id="end">End</button><span ${mock ? '' : 'hidden'}><button id="simulate" disabled>Simulate response</button><button id="inject" disabled>Inject provider failure</button></span><p id="status" role="status">idle. Microphone off.</p><audio id="audio" autoplay controls></audio><h2>Record a finding</h2><label>Outcome <select id="outcome"><option>not-tested</option><option>verified</option><option>failed</option><option>blocked</option><option>unsupported</option></select></label><label>Actual observation, setup limitation, or blocker<textarea id="note" maxlength="2000"></textarea></label><button id="save">Save finding</button><h2>Sanitized provider events</h2><pre id="log"></pre><script nonce="${nonce}" src="${script}"></script></body></html>`;
    const receive = view.webview.onDidReceiveMessage(async (raw: unknown) => {
      try {
        const message = parseWebviewMessage(raw);
        switch (message.kind) {
          case 'ready': {
            const trials: Record<string, number[]> = {};
            for (const id of scenarioIds('voice')) trials[id] = [...new Set(activeWriter.observations.filter(event => event.scenario === id && event.trial !== undefined).map(event => event.trial!))].slice(-2);
            await view.webview.postMessage({ kind: 'history', trials });
            return;
          }
          case 'session-abort': requests.get(message.requestId)?.abort(); requests.delete(message.requestId); return;
          case 'observe': {
            if (!message.observation.trial) throw new Error('Voice observations require a trial.');
            lastTrial = message.observation.trial;
            activeWriter.record(message.observation);
            await activeWriter.flush();
            return;
          }
          case 'finding': {
            if (scenarios[message.scenario].experiment !== 'voice') throw new Error('Wrong experiment.');
            const sequence = activeWriter.record({ scenario: message.scenario, source: 'operator', event: 'operator-observation', note: message.note, trial: message.trials.at(-1) });
            const base = { scenario: message.scenario, trials: message.trials, evidence: activeWriter.observations.filter(event => event.scenario === message.scenario && event.trial !== undefined && message.trials.includes(event.trial) && event.sequence <= sequence).map(event => event.sequence) };
            let finding: Finding;
            switch (message.outcome) {
              case 'verified': finding = { ...base, kind: 'verified', observed: message.note }; break;
              case 'unsupported': finding = { ...base, kind: 'unsupported', reason: message.note }; break;
              case 'failed': finding = { ...base, kind: 'failed', expected: scenarios[message.scenario].expected, observed: message.note }; break;
              case 'blocked': finding = { ...base, kind: 'blocked', prerequisite: message.note }; break;
              case 'not-tested': finding = { scenario: message.scenario, kind: 'not-tested', reason: message.note }; break;
            }
            const next = findings.map(previous => previous.scenario === finding.scenario ? finding : previous);
            parseResult({ schemaVersion: 1, manifest: activeWriter.manifest, observations: activeWriter.observations, findings: next });
            findings = next;
            await save();
            await view.webview.postMessage({ kind: 'notice', text: 'Finding saved. Evidence directory is in Piarre A00 output.' });
            return;
          }
          case 'session-request': {
            if (mock) { await view.webview.postMessage({ kind: 'session-error', requestId: message.requestId }); return; }
            for (const request of requests.values()) request.abort();
            requests.clear();
            const controller = new AbortController();
            requests.set(message.requestId, controller);
            try {
              const key = await context.secrets.get('a00.voice') ?? process.env.OPENAI_API_KEY;
              if (!key) throw new Error('No API credential.');
              const model = activeWriter.manifest.experiment === 'voice' ? activeWriter.manifest.model : '';
              const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
                method: 'POST', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
                headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ expires_after: { anchor: 'created_at', seconds: 60 }, session: { type: 'realtime', model, instructions: 'You are a concise voice integration probe. Answer spoken prompts naturally. Do not call tools.', audio: { input: { transcription: { model: 'gpt-4o-mini-transcribe' }, turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true } }, output: { voice: 'marin' } } } })
              });
              if (!response.ok) {
                activeWriter.record({ scenario: message.scenario, source: 'probe', trial: message.trial, event: 'failure', code: response.status === 401 || response.status === 403 ? 'authentication' : response.status === 429 ? 'quota' : 'provider-unavailable' });
                throw new Error('Session rejected.');
              }
              const authorization = authorizationSchema.parse(await response.json());
              if (controller.signal.aborted || panel !== view || requests.get(message.requestId) !== controller) return;
              if (activeWriter.manifest.experiment === 'voice' && activeWriter.manifest.provider === 'OpenAI Realtime') activeWriter.manifest.model = authorization.session.model;
              await view.webview.postMessage({ kind: 'session', requestId: message.requestId, secret: authorization.value });
            } catch {
              if (!controller.signal.aborted && panel === view) await view.webview.postMessage({ kind: 'session-error', requestId: message.requestId });
            } finally { if (requests.get(message.requestId) === controller) requests.delete(message.requestId); }
            return;
          }
        }
      } catch { if (panel === view) await view.webview.postMessage({ kind: 'notice', text: 'Message rejected. Use a valid scenario and remove private material from the note.' }); }
    });
    view.onDidDispose(() => {
      panel = undefined;
      receive.dispose();
      for (const request of requests.values()) request.abort();
      requests.clear();
      if (lastTrial) activeWriter.record({ scenario: 'voice-panel-dispose', source: mock ? 'mock' : 'probe', trial: lastTrial, event: 'action', action: 'dispose' });
      void save().catch(() => output.appendLine('Could not finalize voice evidence. Incremental observations remain in the evidence directory.'));
    });
    context.subscriptions.push(view);
  }));
}
