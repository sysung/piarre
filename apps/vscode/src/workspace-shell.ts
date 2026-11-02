import { randomBytes } from "node:crypto";

export function renderWorkspaceShell(inspection: string): string {
  const nonce = randomBytes(24).toString("base64");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{--space:16px;--gap:24px;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size,13px);line-height:1.6;color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:var(--gap);margin:0}main{max-width:760px;margin:auto;min-width:0}h1{font-size:1.8em;line-height:1.25;margin:0 0 var(--space)}h2{font-size:1.25em}textarea{box-sizing:border-box;width:100%;min-height:160px;resize:vertical;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,var(--vscode-panel-border));padding:var(--space);font:inherit}button{min-height:36px;margin:var(--space) 8px 0 0;padding:8px 16px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:1px solid transparent;cursor:pointer;font:inherit}button:hover{background:var(--vscode-button-hoverBackground)}button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}button.secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}button:disabled{opacity:.5;cursor:default}:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:3px}.hint,dt{color:var(--vscode-descriptionForeground)}section{margin-top:var(--gap)}article{padding:var(--space);border:1px solid var(--vscode-panel-border);margin:var(--space) 0;overflow-wrap:anywhere}dd{margin:4px 0;overflow-wrap:anywhere}summary{cursor:pointer;min-height:32px;padding:8px 0;font-weight:600}details{border-top:1px solid var(--vscode-panel-border);margin-top:var(--space)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}#status{min-height:1.6em}#step{font-size:.9em;color:var(--vscode-descriptionForeground)}[hidden]{display:none!important}@media(max-width:400px){body{padding:12px}button{width:100%;margin-right:0}}
.goal-card{display:flex;flex-direction:column;gap:8px;text-align:left;width:100%;box-sizing:border-box;margin:12px 0;padding:20px;border:1px solid var(--vscode-panel-border);border-radius:8px;background:var(--vscode-editorWidget-background,var(--vscode-editor-background));color:var(--vscode-foreground);transition:transform 140ms ease-out,background-color 140ms ease-out}.goal-card:hover{background:var(--vscode-list-hoverBackground);transform:translateY(-2px)}.goal-card[aria-current="true"]{border-color:var(--vscode-focusBorder)}.goal-card:active{transform:translateY(0)}.goal-title{font-weight:600;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.goal-meta{font-size:.9em;color:var(--vscode-descriptionForeground)}.goal-action{font-size:.9em;color:var(--vscode-textLink-foreground)}#preview:not([hidden]){animation:reveal 140ms ease-out}@keyframes reveal{from{opacity:.7;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.goal-card{transition:none}.goal-card:hover{transform:none}#preview:not([hidden]){animation:none}}
</style></head><body><main><p id="step">Step 1 of 2 · Goal</p><h1 id="page-title" tabindex="-1">What would you like to work on?</h1><p class="hint">Local planning only. Piarre will not run code or spend money.</p><form id="composer"><label for="goal">Your goal</label><textarea id="goal" maxlength="10000" placeholder="Describe the outcome you want…"></textarea><p class="hint">Nothing is saved until you choose Save proposal.</p><button id="prepare" type="submit">Review goal</button></form><p id="status" role="status" aria-live="polite"></p><section id="preview" aria-label="Proposal review" hidden></section><div id="review-actions" hidden><button id="save" type="button" hidden>Save proposal</button><button id="discard" class="secondary" type="button">Back to goal</button></div><button id="new-goal" type="button" hidden>Plan another goal</button><details id="project-details"><summary>Saved goals and project</summary><p id="browse-status" class="hint" role="status" aria-live="polite"></p><aside id="inspection" aria-label="Project inspection">${inspection}</aside></details></main><script nonce="${nonce}">${composerScript}</script></body></html>`;
}

const composerScript = String.raw`
const api = acquireVsCodeApi();
const goal = document.getElementById('goal');
const prepare = document.getElementById('prepare');
const discard = document.getElementById('discard');
const save = document.getElementById('save');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const composer = document.getElementById('composer');
const actions = document.getElementById('review-actions');
const title = document.getElementById('page-title');
const step = document.getElementById('step');
const next = document.getElementById('new-goal');
function showGoal() {
  composer.hidden = false; preview.hidden = true; actions.hidden = true; next.hidden = true;
  title.textContent = 'What would you like to work on?'; step.textContent = 'Step 1 of 2 · Goal';
}
document.getElementById('inspection').addEventListener('click', (event) => {
  const card = event.target instanceof Element ? event.target.closest('[data-open-goal]') : null;
  if (card) api.postMessage({kind: 'open-proposal', groupId: card.dataset.openGoal});
});
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
  showGoal();
  status.textContent = '';
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
  showGoal();
  status.textContent = '';
  goal.focus();
});
next.addEventListener('click', () => {
  goal.value = ''; invalidate(); showGoal(); status.textContent = ''; goal.focus();
});
save.addEventListener('click', () => {
  if (!requestId || save.disabled) return;
  save.disabled = true;
  api.postMessage({kind: 'save', requestId});
});
window.addEventListener('message', ({data}) => {
  if (data.kind === 'inspection') {
    const focused = document.activeElement?.closest('[data-open-goal]')?.dataset.openGoal;
    document.getElementById('inspection').innerHTML = data.html;
    document.querySelectorAll('[data-open-goal]').forEach(card => { if (card.dataset.openGoal === data.selectedGroupId) card.setAttribute('aria-current', 'true'); });
    if (focused) [...document.querySelectorAll('[data-open-goal]')].find(card => card.dataset.openGoal === focused)?.focus({preventScroll:true});
    return;
  }
  if (data.kind === 'proposal-opened') {
    const cards = [...document.querySelectorAll('[data-open-goal]')];
    cards.forEach(card => { if (card.dataset.openGoal === data.groupId) card.setAttribute('aria-current', 'true'); else card.removeAttribute('aria-current'); });
    document.getElementById('browse-status').textContent = data.groupId ? 'Proposal opened in the details pane. Return to the Piarre Work tab to continue.' : '';
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
  if (state.kind === 'idle') {
    requestId = undefined;
    showGoal();
    if (state.message.startsWith('Proposal saved')) {
      composer.hidden = true; next.hidden = false; title.textContent = 'Proposal saved'; step.textContent = 'Saved · Not approved to run';
      document.getElementById('project-details').open = true; title.focus();
    }
  }
  if (state.kind === 'ready') {
    composer.hidden = true; preview.hidden = false; actions.hidden = false;
    title.textContent = 'Review your proposal'; step.textContent = 'Step 2 of 2 · Review';
    status.textContent = 'Check the proposal before saving. Nothing will run.';
    const goalSummary = document.createElement('p');
    goalSummary.textContent = state.draft.goal;
    preview.append(goalSummary);
    for (const task of state.draft.tasks) {
      const article = document.createElement('article');
      const heading = document.createElement('h2'); heading.textContent = task.title;
      const requirements = document.createElement('ul');
      for (const requirement of task.requirements) {
        const item = document.createElement('li'); item.textContent = requirement.text; requirements.append(item);
      }
      const details = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = 'Scope, checks and budget';
      const content = document.createElement('pre');
      content.textContent = 'Included paths: ' + (task.proposedScope.included.join(', ') || 'Not specified') +
        '\nExcluded paths: ' + (task.proposedScope.excluded.join(', ') || 'None specified') +
        '\nDependencies: ' + (task.dependsOn.join(', ') || 'None') +
        '\nChecks: ' + task.checks.map(item => item.description).join('; ') +
        '\nBudget: ' + task.proposedBudget.maxTokens + ' tokens; ' + task.proposedBudget.maxAttempts + ' attempt(s); ' + task.proposedBudget.maxElapsedMinutes + ' minutes';
      details.append(summary, content); article.append(heading, requirements, details); preview.append(article);
    }
    title.focus();
  }
});
prepare.disabled = !goal.value.trim();
api.postMessage({kind: 'ready'});
`;
