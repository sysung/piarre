import { randomBytes } from "node:crypto";

export function renderWorkspaceShell({ inspection, brief, agentOverview, executionControls = "" }: { readonly inspection: string; readonly brief: string; readonly agentOverview: string; readonly executionControls?: string }): string {
  const nonce = randomBytes(24).toString("base64");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{--space:16px;--gap:24px;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size,13px);line-height:1.6;color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0}*{box-sizing:border-box}main{max-width:1600px;margin:auto;min-width:0;container-type:inline-size}h1{font-size:1.9em;line-height:1.25;margin:12px 0 24px}h2{font-size:1.25em;line-height:1.4}textarea{width:100%;min-height:88px;resize:vertical;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,var(--vscode-panel-border));padding:var(--space);font:inherit}button{min-height:36px;margin:var(--space) 8px 0 0;padding:8px 16px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:1px solid transparent;cursor:pointer;font:inherit}button:hover{background:var(--vscode-button-hoverBackground)}button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}button.secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}button:disabled{opacity:.5;cursor:default}:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:3px}.hint,dt{color:var(--vscode-descriptionForeground)}section{margin-top:var(--gap)}article{padding:var(--space);border:1px solid var(--vscode-panel-border);margin:var(--space) 0;overflow-wrap:anywhere}dd{margin:4px 0;overflow-wrap:anywhere}summary{cursor:pointer;min-height:32px;padding:8px 0;font-weight:600}details{border-top:1px solid var(--vscode-panel-border);margin-top:var(--space)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}#status{min-height:1.6em}#step,.eyebrow{font-size:.9em;color:var(--vscode-descriptionForeground)}[hidden]{display:none!important}.session-brief{padding:24px 32px;border-bottom:1px solid var(--vscode-panel-border)}.workspace-identity{display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin-bottom:24px}.workspace-identity strong{font-size:1.15em}.project-name{overflow-wrap:anywhere;min-width:0}.capability{margin-left:auto;color:var(--vscode-descriptionForeground);font-size:.9em}.session-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;margin:0}.session-summary dt{font-weight:600;color:var(--vscode-foreground)}.session-summary dd{margin:6px 0 0;color:var(--vscode-descriptionForeground)}#execution-controls:not(:empty),#supporting-stop{padding:16px 32px;border-bottom:1px solid var(--vscode-panel-border)}.workspace-columns{display:grid;grid-template-columns:minmax(0,.86fr) minmax(0,1.3fr)}.planning,.inspection-desk{margin:0;min-width:0;padding:28px 32px}.planning{border-right:1px solid var(--vscode-panel-border)}.inspection-desk>h2{margin:0}.skip{position:absolute;top:-100px;left:16px;color:var(--vscode-textLink-foreground);background:var(--vscode-editor-background);padding:8px;z-index:1}.skip:focus{top:8px}@container(max-width:900px){.workspace-columns{grid-template-columns:minmax(0,1fr)}.planning{border-right:0;border-bottom:1px solid var(--vscode-panel-border)}}@container(max-width:600px){.session-summary{grid-template-columns:minmax(0,1fr);gap:16px}.session-brief,.planning,.inspection-desk{padding:20px 16px}.workspace-identity{gap:12px}.capability{margin-left:0}h1{margin-bottom:20px}}@container(max-width:400px){button{max-width:100%;margin-right:0}}

.goal-card{display:flex;flex-direction:column;gap:8px;text-align:left;width:100%;box-sizing:border-box;margin:12px 0;padding:20px;border:1px solid var(--vscode-panel-border);border-radius:8px;background:var(--vscode-editorWidget-background,var(--vscode-editor-background));color:var(--vscode-foreground);transition:transform 140ms ease-out,background-color 140ms ease-out}.goal-card:hover{background:var(--vscode-list-hoverBackground);transform:translateY(-2px)}.goal-card[aria-current="true"]{border-color:var(--vscode-focusBorder)}.goal-card:active{transform:translateY(0)}.goal-title{font-weight:600;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.goal-meta{font-size:.9em;color:var(--vscode-descriptionForeground)}.goal-action{font-size:.9em;color:var(--vscode-textLink-foreground)}#preview:not([hidden]){animation:reveal 140ms ease-out}@keyframes reveal{from{opacity:.7;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.goal-card{transition:none}.goal-card:hover{transform:none}#preview:not([hidden]){animation:none}}
.goal-container{background:var(--vscode-editorWidget-background,var(--vscode-editor-background));display:grid;grid-template-columns:minmax(0,1fr) 36px;gap:8px;align-items:center;border:1px solid var(--vscode-panel-border);border-radius:8px;padding:8px;margin:12px 0}.goal-container .goal-card{border:0;margin:0;background:transparent}.goal-container:hover{background:var(--vscode-list-hoverBackground)}.goal-container .goal-card:hover{background:transparent;transform:none}.goal-container .delete-goal{display:flex;align-items:center;justify-content:center;width:36px;height:36px;min-height:36px;padding:8px;margin:0;background:transparent;color:var(--vscode-descriptionForeground);border:1px solid transparent;transition:color 120ms ease-out}.goal-container .delete-goal:hover,.goal-container .delete-goal:focus-visible{color:var(--vscode-errorForeground,#f48771);background:transparent}.delete-goal svg{pointer-events:none}@media(prefers-reduced-motion:reduce){.goal-container .delete-goal{transition:none}}.proposal-metadata{display:grid;gap:16px}.proposal-metadata section{margin-top:0}.proposal-metadata h4{font-size:1em;margin:12px 0 4px}.proposal-metadata ul{margin:0;padding-left:20px}.budget-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:12px;border-top:1px solid var(--vscode-panel-border);padding-top:16px}.budget-grid dd{font-size:1.2em;font-weight:600;margin:4px 0}
</style></head><body><a class="skip" href="#page-title">Skip to goal planning</a><main><header id="session-brief" class="session-brief" aria-label="Project brief">${brief}</header><p id="execution-status" role="status" aria-live="polite" aria-atomic="true"></p><div id="execution-controls">${executionControls}</div><div id="supporting-stop" hidden><p>Codex discussion is active.</p><button id="stop-supporting" type="button">Stop discussion</button></div><div class="workspace-columns"><section class="planning" aria-label="Agent work"><h2>Agent work</h2><div id="agent-overview">${agentOverview}</div><section aria-label="Task entry"><p id="step">Step 1 of 2 · Goal</p><h2 id="page-title" tabindex="-1">Plan a task</h2><p class="hint">Review goals locally, or connect Codex for a read-only discussion. Sending can consume account usage.</p><details id="discussion"><summary>Discuss context</summary><div aria-label="Codex connection"><button id="connect-codex" type="button">Connect Codex</button><button id="disconnect-codex" class="secondary" type="button" hidden>Disconnect</button><button id="stop-conversation" class="secondary" type="button" hidden>Stop reply</button><p id="connection-status" role="status" aria-live="polite">Codex disconnected.</p><details><summary>What sending shares</summary><p>Your statement, recent conversation and listed project sources go to your configured Codex account. Quota and cost are unknown. Conversation cannot approve or run coding work.</p></details></div><section id="conversation" aria-label="Project conversation"></section><p>Use the task input below for an optional question or clarification.</p></details><form id="composer"><label for="goal">Task or question</label><textarea id="goal" maxlength="10000" placeholder="Describe the outcome you want…"></textarea><p class="hint">Review goal creates a local preview. Send to Codex saves your statement and reply with this project.</p><button id="send-codex" class="secondary" type="submit" disabled>Send to Codex</button><button id="prepare" type="submit">Review goal</button></form><p id="status" role="status" aria-live="polite"></p><section id="preview" aria-label="Proposal review" hidden></section><div id="review-actions" hidden><button id="save" type="button" hidden>Save proposal</button><button id="discard" class="secondary" type="button">Back to goal</button></div><button id="new-goal" type="button" hidden>Plan another goal</button></section></section><aside class="inspection-desk" aria-label="Project inspection"><h2>Saved goals</h2><p class="hint">Select a saved goal to inspect its proposal. All proposals are unapproved.</p><p id="browse-status" class="hint" role="status" aria-live="polite"></p><div id="inspection">${inspection}</div></aside></div></main><script nonce="${nonce}">${composerScript}</script></body></html>`;
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
const send = document.getElementById('send-codex');
let connectionKind = 'disconnected';
let executionAnnouncements = new Map();
function syncSend() { send.disabled = connectionKind !== 'ready' || !goal.value.trim(); }
document.getElementById('connect-codex').addEventListener('click', () => api.postMessage({kind:'connect-codex'}));
document.getElementById('disconnect-codex').addEventListener('click', () => api.postMessage({kind:'disconnect-codex'}));
document.getElementById('stop-conversation').addEventListener('click', () => api.postMessage({kind:'stop-conversation'}));
document.getElementById('stop-supporting').addEventListener('click', () => api.postMessage({kind:'stop-conversation'}));
document.addEventListener('click',event=>{const button=event.target instanceof Element?event.target.closest('[data-coordination-action]'):null;if(button)api.postMessage({kind:'coordination',action:button.dataset.coordinationAction,requestId:crypto.randomUUID(),...(button.dataset.coordinationId?{id:button.dataset.coordinationId}:{}),...(button.dataset.assignmentId?{assignmentId:button.dataset.assignmentId}:{})});});
document.addEventListener('click', event => { const button=event.target instanceof Element?event.target.closest('[data-execution-action]'):null; if(button)api.postMessage(button.dataset.executionId?{kind:'execution',action:button.dataset.executionAction,id:button.dataset.executionId}:{kind:'execution',action:button.dataset.executionAction}); });
function showGoal() {
  composer.hidden = false; preview.hidden = true; actions.hidden = true; next.hidden = true;
  title.textContent = 'Plan a task'; step.textContent = 'Step 1 of 2 · Goal';
}
document.getElementById('inspection').addEventListener('click', (event) => {
  const knowledge = event.target instanceof Element ? event.target.closest('[data-knowledge-action]') : null;
  if (knowledge) api.postMessage(knowledge.dataset.knowledgeId ? {kind:knowledge.dataset.knowledgeAction,knowledgeId:knowledge.dataset.knowledgeId} : {kind:knowledge.dataset.knowledgeAction});
  const card = event.target instanceof Element ? event.target.closest('[data-open-goal]') : null;
  const remove = event.target instanceof Element ? event.target.closest('[data-delete-goal]') : null;
  if (remove) api.postMessage({kind: 'delete-proposal', groupId: remove.dataset.deleteGoal});
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
  syncSend();
  invalidate();
  showGoal();
  status.textContent = '';
});
document.getElementById('composer').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!goal.value.trim()) return;
  if (event.submitter === send) {
    if (send.disabled) return;
    api.postMessage({kind:'send-conversation', text:goal.value});
    goal.value = ''; invalidate(); syncSend(); goal.focus(); return;
  }
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
    document.getElementById('composer').requestSubmit(connectionKind === 'ready' ? send : prepare);
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
  if (data.kind === 'conversation') {
    connectionKind = data.state.kind;
    document.getElementById('connection-status').textContent = data.state.message;
    document.getElementById('connect-codex').hidden = connectionKind !== 'disconnected';
    document.getElementById('disconnect-codex').hidden = connectionKind === 'disconnected';
    const stop = document.getElementById('stop-conversation'); stop.hidden = !['busy','stopping'].includes(connectionKind); stop.disabled = connectionKind === 'stopping';
    document.getElementById('conversation').innerHTML = data.html;
    document.getElementById('supporting-stop').hidden = !['busy','stopping'].includes(connectionKind);
    document.getElementById('stop-supporting').disabled = connectionKind === 'stopping';
    syncSend(); return;
  }
  if (data.kind === 'inspection') {
    const focused = document.activeElement?.closest('[data-open-goal]')?.dataset.openGoal;
    const coordinationFocus=document.activeElement?.closest('[data-coordination-action]');const coordinationAction=coordinationFocus?.dataset.coordinationAction;const coordinationId=coordinationFocus?.dataset.coordinationId;const assignmentId=coordinationFocus?.dataset.assignmentId;
    const openCoordination=new Set([...document.querySelectorAll('details[data-coordination-disclosure][open]')].map(item=>item.dataset.coordinationDisclosure));
    const reviewDetails = [...document.querySelectorAll('[data-review-key]')];
    const expandedReviews = new Set(reviewDetails.filter(details => details.open).map(details => details.dataset.reviewKey));
    const focusedReview = document.activeElement?.closest('summary')?.parentElement?.dataset.reviewKey;
    const executionFocus=document.activeElement?.closest('[data-execution-action]');const action=executionFocus?.dataset.executionAction;const id=executionFocus?.dataset.executionId;
    document.getElementById('inspection').innerHTML = data.html;
    if (typeof data.agentOverview === 'string') document.getElementById('agent-overview').innerHTML = data.agentOverview;
    if (typeof data.executionControls === 'string') document.getElementById('execution-controls').innerHTML = data.executionControls;
    document.querySelectorAll('[data-review-key]').forEach(details => {
      details.open = expandedReviews.has(details.dataset.reviewKey);
      if (details.dataset.reviewKey === focusedReview) details.querySelector('summary')?.focus({preventScroll:true});
    });
    const executionStatus = document.getElementById('execution-controls').querySelector('[data-execution-status]')?.dataset.executionStatus;
    if (executionStatus) {
      const updates = JSON.parse(executionStatus);
      const changed = updates.filter(item => executionAnnouncements.get(item.id) !== item.text).map(item => item.text);
      executionAnnouncements = new Map(updates.map(item => [item.id, item.text]));
      if (changed.length) document.getElementById('execution-status').textContent = changed.join(' ');
    }
    document.getElementById('session-brief').innerHTML = data.brief;
    document.querySelectorAll('details[data-coordination-disclosure]').forEach(item=>{item.open=openCoordination.has(item.dataset.coordinationDisclosure);});
    if(coordinationAction)[...document.querySelectorAll('[data-coordination-action]')].find(button=>button.dataset.coordinationAction===coordinationAction&&button.dataset.coordinationId===coordinationId&&button.dataset.assignmentId===assignmentId)?.focus({preventScroll:true});
    document.querySelectorAll('[data-open-goal]').forEach(card => { if (card.dataset.openGoal === data.selectedGroupId) card.setAttribute('aria-current', 'true'); });
    if (focused) [...document.querySelectorAll('[data-open-goal]')].find(card => card.dataset.openGoal === focused)?.focus({preventScroll:true});
    if(action)[...document.querySelectorAll('[data-execution-action]')].find(button=>button.dataset.executionAction===action&&button.dataset.executionId===id)?.focus({preventScroll:true});
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
      title.focus();
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
      const heading = document.createElement('h3'); heading.textContent = task.title;
      const requirements = document.createElement('ul');
      for (const requirement of task.requirements) {
        const item = document.createElement('li'); item.textContent = requirement.text; requirements.append(item);
      }
      const details = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = 'Scope, checks and budget';
      const content = document.createElement('div'); content.className = 'proposal-metadata';
      const addSection = (label, values, empty) => {
        const block = document.createElement('section');
        const title = document.createElement('h4'); title.textContent = label;
        const list = document.createElement('ul');
        for (const value of values.length ? values : [empty]) {
          const item = document.createElement('li'); item.textContent = value; list.append(item);
        }
        block.append(title, list); content.append(block);
      };
      addSection('Included paths:', task.proposedScope.included, 'Not specified');
      addSection('Excluded paths:', task.proposedScope.excluded, 'None specified');
      addSection('Dependencies:', task.dependsOn, 'None');
      addSection('Checks:', task.checks.map(item => item.description), 'No checks specified');
      const budget = document.createElement('dl'); budget.className = 'budget-grid';
      for (const [label, value] of [['Token limit', task.proposedBudget.maxTokens.toLocaleString('en-US')], ['Attempts', String(task.proposedBudget.maxAttempts)], ['Time limit', task.proposedBudget.maxElapsedMinutes + ' minutes']]) {
        const cell = document.createElement('div'); const term = document.createElement('dt'); const description = document.createElement('dd');
        term.textContent = label; description.textContent = value; cell.append(term, description); budget.append(cell);
      }
      content.append(budget);
      details.append(summary, content); article.append(heading, requirements, details); preview.append(article);
    }
    title.focus();
  }
});
prepare.disabled = !goal.value.trim();
api.postMessage({kind: 'ready'});
`;
