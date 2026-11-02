import { randomBytes } from "node:crypto";

export function renderWorkspaceShell(inspection: string): string {
  const nonce = randomBytes(24).toString("base64");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:20px;margin:0}main{display:grid;grid-template-columns:minmax(280px,1fr) minmax(300px,1fr);gap:28px}textarea{box-sizing:border-box;width:100%;min-height:140px;resize:vertical;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,gray);padding:12px;font:inherit}button{margin:8px 8px 8px 0;padding:8px 12px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;cursor:pointer}button:disabled{opacity:.5;cursor:default}:focus-visible{outline:2px solid var(--vscode-focusBorder)}.hint,dt{color:var(--vscode-descriptionForeground)}section{margin-top:20px}article{padding:12px;background:var(--vscode-editor-background);margin:12px 0}dd{margin:4px 0;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}#preview:empty{display:none}#inspection{border-left:1px solid var(--vscode-panel-border);padding-left:24px}#status{min-height:3em}@media(max-width:720px){main{grid-template-columns:1fr}#inspection{border-left:0;border-top:1px solid var(--vscode-panel-border);padding:16px 0}}[hidden]{display:none!important}
</style></head><body><main><section aria-label="Goal workspace"><h1>Work with Piarre</h1><p>What would you like to work on?</p><p class="hint">Local draft mode. No conversational model or coding worker is connected.</p><form id="composer"><label for="goal">Your goal</label><textarea id="goal" maxlength="10000" placeholder="Describe what you want to accomplish…"></textarea><p class="hint">Unsent text stays in this panel. Previewing does not save or start work.</p><button id="prepare" type="submit">Preview locally</button><button id="discard" type="button" disabled>Discard preview</button></form><section aria-label="Activity"><h2>Activity</h2><p id="status" role="status" aria-live="polite">Ready for a goal.</p></section><section id="preview" aria-label="Provisional draft"></section><button id="save" type="button" hidden>Save unapproved proposal</button></section><aside id="inspection" aria-label="Project inspection">${inspection}</aside></main><script nonce="${nonce}">${composerScript}</script></body></html>`;
}

const composerScript = String.raw`
const api = acquireVsCodeApi();
const goal = document.getElementById('goal');
const prepare = document.getElementById('prepare');
const discard = document.getElementById('discard');
const save = document.getElementById('save');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
let requestId;
function invalidate() {
  const previous = requestId;
  requestId = undefined;
  save.hidden = true;
  save.disabled = true;
  discard.disabled = true;
  prepare.disabled = !goal.value.trim();
  preview.replaceChildren();
  if (previous) api.postMessage({kind: 'discard', requestId: previous});
}
goal.addEventListener('input', () => {
  invalidate();
  status.textContent = 'Unsent changes. Preview when ready.';
});
document.getElementById('composer').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!goal.value.trim()) return;
  invalidate();
  requestId = crypto.randomUUID();
  discard.disabled = false;
  prepare.disabled = true;
  status.textContent = 'Preparing a local preview…';
  api.postMessage({kind: 'preview', requestId, goal: goal.value});
});
goal.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
    event.preventDefault();
    document.getElementById('composer').requestSubmit();
  }
});
discard.addEventListener('click', () => {
  invalidate();
  status.textContent = 'Preview discarded. Nothing was saved.';
});
save.addEventListener('click', () => {
  if (!requestId || save.disabled) return;
  save.disabled = true;
  api.postMessage({kind: 'save', requestId});
});
window.addEventListener('message', ({data}) => {
  if (data.kind === 'inspection') {
    document.getElementById('inspection').innerHTML = data.html;
    return;
  }
  if (data.kind !== 'draft') return;
  const state = data.state;
  if (state.requestId !== requestId) return;
  status.textContent = state.message;
  save.hidden = state.kind !== 'ready';
  save.disabled = state.kind !== 'ready';
  discard.disabled = state.kind === 'idle';
  prepare.disabled = state.kind === 'preparing' || !goal.value.trim();
  preview.replaceChildren();
  if (state.kind === 'idle') requestId = undefined;
  if (state.kind === 'ready') {
    const heading = document.createElement('h2');
    heading.textContent = 'Provisional draft';
    const content = document.createElement('pre');
    content.textContent = state.draft.goal + '\n\n' + state.draft.tasks.map(task =>
      task.title + '\n' + task.requirements.map(item => item.text).join('\n') +
      '\nIncluded paths: ' + (task.proposedScope.included.join(', ') || 'Not specified') +
      '\nExcluded paths: ' + (task.proposedScope.excluded.join(', ') || 'None specified') +
      '\nDependencies: ' + (task.dependsOn.join(', ') || 'None') +
      '\nChecks: ' + task.checks.map(item => item.description).join('; ') +
      '\nBudget: ' + task.proposedBudget.maxTokens + ' tokens; ' + task.proposedBudget.maxAttempts + ' attempt(s); ' + task.proposedBudget.maxElapsedMinutes + ' minutes'
    ).join('\n\n');
    preview.append(heading, content);
  }
});
prepare.disabled = !goal.value.trim();
api.postMessage({kind: 'ready'});
`;
