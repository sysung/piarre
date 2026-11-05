import { randomBytes } from "node:crypto";

export function renderWorkspaceShell({ inspection, brief, agentOverview, executionControls = "", projectId }: { readonly inspection: string; readonly brief: string; readonly agentOverview: string; readonly executionControls?: string; readonly projectId: string }): string {
  const nonce = randomBytes(24).toString("base64");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{--space:16px;--gap:24px;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size,13px);line-height:1.5;color:var(--vscode-foreground);background:var(--vscode-editor-background);margin:0}
*{box-sizing:border-box}main{min-width:0}
button,textarea,select{font:inherit}
button{border:1px solid transparent;background:var(--vscode-button-background);color:var(--vscode-button-foreground);padding:6px 10px;cursor:pointer}
button:hover{background:var(--vscode-button-hoverBackground)}
button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
button.secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}
button:disabled{opacity:.5;cursor:default}
:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:2px}
[hidden]{display:none!important}
h1,h2,h3,h4,p{overflow-wrap:anywhere}
h2{font-size:14px}h3{font-size:13px}
.hint,dt,.eyebrow{color:var(--vscode-descriptionForeground)}
summary{cursor:pointer;font-size:12px;padding:6px 0}
details{margin:0}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}
article{overflow-wrap:anywhere}
.skip{position:absolute;top:-100px;left:16px;padding:8px;z-index:10;background:var(--vscode-editor-background);color:var(--vscode-textLink-foreground)}
.skip:focus{top:8px}
.goal-card{display:flex;flex-direction:column;gap:8px;text-align:left;width:100%;box-sizing:border-box;margin:12px 0;padding:20px;border:1px solid var(--vscode-panel-border);border-radius:8px;background:var(--vscode-editorWidget-background,var(--vscode-editor-background));color:var(--vscode-foreground);transition:transform 140ms ease-out,background-color 140ms ease-out}.goal-card:hover{background:var(--vscode-list-hoverBackground);transform:translateY(-2px)}.goal-card[aria-current="true"]{border-color:var(--vscode-focusBorder)}.goal-card:active{transform:translateY(0)}.goal-title{font-weight:600;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.goal-meta{font-size:.9em;color:var(--vscode-descriptionForeground)}.goal-action{font-size:.9em;color:var(--vscode-textLink-foreground)}#preview:not([hidden]){animation:reveal 140ms ease-out}@keyframes reveal{from{opacity:.7;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.goal-card{transition:none}.goal-card:hover{transform:none}#preview:not([hidden]){animation:none}}
.goal-container{background:var(--vscode-editorWidget-background,var(--vscode-editor-background));display:grid;grid-template-columns:minmax(0,1fr) 36px;gap:8px;align-items:center;border:1px solid var(--vscode-panel-border);border-radius:8px;padding:8px;margin:12px 0}.goal-container .goal-card{border:0;margin:0;background:transparent}.goal-container:hover{background:var(--vscode-list-hoverBackground)}.goal-container .goal-card:hover{background:transparent;transform:none}.goal-container .delete-goal{display:flex;align-items:center;justify-content:center;width:36px;height:36px;min-height:36px;padding:8px;margin:0;background:transparent;color:var(--vscode-descriptionForeground);border:1px solid transparent;transition:color 120ms ease-out}.goal-container .delete-goal:hover,.goal-container .delete-goal:focus-visible{color:var(--vscode-errorForeground,#f48771);background:transparent}.delete-goal svg{pointer-events:none}@media(prefers-reduced-motion:reduce){.goal-container .delete-goal{transition:none}}.proposal-metadata{display:grid;gap:16px}.proposal-metadata section{margin-top:0}.proposal-metadata h4{font-size:1em;margin:12px 0 4px}.proposal-metadata ul{margin:0;padding-left:20px}.budget-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:12px;border-top:1px solid var(--vscode-panel-border);padding-top:16px}.budget-grid dd{font-size:1.2em;font-weight:600;margin:4px 0}
/* The host sidebar owns the available width. */
body{height:100vh}
main{max-width:none;height:100%;display:flex;flex-direction:column}
.app-bar{display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--vscode-panel-border);background:var(--vscode-sideBar-background)}
.app-bar button,.workspace-nav button,.composer-bar button,.composer-bar select,.context-panel button,.sidebar button{min-height:30px;margin:0;padding:3px 8px;border-radius:5px;font:inherit}
.workspace-columns{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr)}

.sidebar{padding:12px;min-width:0;overflow:auto;background:var(--vscode-sideBar-background);border-right:0}
.workspace-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding-bottom:8px;border-bottom:1px solid var(--vscode-panel-border)}
.workspace-nav button,.sidebar .session-row,.composer-bar .quiet{background:transparent;color:var(--vscode-foreground)}
.workspace-nav button[aria-pressed=true],.sidebar .session-row[aria-current=true],.sidebar .session-row:hover,.composer-bar .quiet:hover{background:var(--vscode-list-inactiveSelectionBackground,var(--vscode-list-hoverBackground))}
.sidebar .session-row{display:flex;align-items:center;justify-content:space-between;text-align:left;gap:8px;width:100%}
.session-row[data-child=true]{padding-left:22px}.session-row span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.session-dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--vscode-descriptionForeground)}
.session-dot[data-status="Something went wrong"]{background:var(--vscode-errorForeground)}
.session-dot[data-status="Needs your attention"]{background:var(--vscode-editorWarning-foreground)}
.session-dot[data-status="Complete"]{background:var(--vscode-testing-iconPassed,var(--vscode-charts-green))}
.planning{border:0;display:flex;flex-direction:column;min-height:0;padding:0;position:relative;overflow:auto}
.chat-flow{overflow:auto;flex:1;min-height:160px;padding:18px 24px}
.chat-flow>div,#conversation{width:min(720px,100%);margin:0 auto}
.welcome{display:grid;place-content:center;text-align:center;height:100%}.welcome h1{margin:0}
.turn{padding:0;border:0}.user-message{margin-left:auto;max-width:85%;width:fit-content;padding:8px 14px;border-radius:14px;background:var(--vscode-list-inactiveSelectionBackground,var(--vscode-input-background))}.user-message p,.user-message pre{margin:3px 0}
.assistant-message{padding:8px 4px}
.composer-zone{width:min(760px,100%);margin:0 auto;padding:8px 20px 14px;position:relative}
#composer{padding:8px;border:1px solid var(--vscode-input-border,var(--vscode-panel-border));border-radius:16px;background:var(--vscode-input-background)}
#composer:focus-within{border-color:var(--vscode-focusBorder)}
#goal{display:block;border:0;background:transparent;padding:6px 8px;min-height:54px;max-height:160px}
#goal:focus-visible{outline:none}
.composer-bar{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.composer-bar #send-codex{border-radius:50%;width:30px;padding:0}
#model{margin-left:auto;min-width:0;max-width:180px;background:var(--vscode-dropdown-background);color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border)}
.context-panel{position:absolute;bottom:100%;left:20px;right:20px;z-index:4;max-height:min(280px,46vh);overflow:auto;padding:10px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-panel-border);border-radius:10px;box-shadow:0 5px 15px #0005}
.context-panel label{display:flex;align-items:flex-start;gap:6px;padding:6px 4px}.source-icon{color:var(--vscode-descriptionForeground);flex:none}.context-panel input[type=checkbox]{flex:none}.context-panel button{background:transparent;color:var(--vscode-foreground);display:block;width:100%;text-align:left}.context-panel button:hover{background:var(--vscode-list-hoverBackground)}.context-panel h3{font-size:1em;margin:4px 0}
.connection{font-size:.9em;margin:6px 0;color:var(--vscode-descriptionForeground)}
#status:empty{display:none}.proposal-zone{padding:0 20px;margin:0 auto;width:min(760px,100%)}
#session-menu{position:fixed;z-index:8;padding:4px;border:1px solid var(--vscode-panel-border);background:var(--vscode-menu-background,var(--vscode-editorWidget-background));border-radius:8px}
#session-menu button{display:block;width:100%;min-height:28px;margin:0;padding:4px 10px;text-align:left;background:transparent;color:var(--vscode-foreground)}
#session-menu button:hover,#session-menu button:focus-visible{background:var(--vscode-list-hoverBackground)}
@media(max-width:620px){.workspace-columns{grid-template-columns:minmax(0,1fr)}.chat-flow{padding-inline:12px}.composer-zone{padding-inline:10px}.context-panel{left:10px;right:10px}}

html,body{height:100%;overflow:hidden}
main{height:100dvh}
.app-bar{height:36px;min-height:36px;font-size:12px;justify-content:space-between}
.app-bar button{background:transparent;color:var(--vscode-foreground)}
.app-bar button:hover{background:var(--vscode-toolbar-hoverBackground)}
.workspace-columns{position:relative;overflow:hidden}
.sidebar{padding:16px 12px}
.workspace-title{font-size:12px;margin:0 8px 8px;color:var(--vscode-descriptionForeground)}
.sidebar h2{font-size:12px;font-weight:500;color:var(--vscode-descriptionForeground);margin:14px 8px 8px}
.workspace-nav{gap:4px;padding:4px 8px;border-bottom:1px solid var(--vscode-panel-border)}
.workspace-nav button{display:grid;place-items:center;height:40px;width:100%;font-size:17px}
.sidebar .session-row{border-radius:5px;padding:6px 8px}
.sidebar details{margin-top:12px;border-top:1px solid var(--vscode-panel-border)}
.sidebar article{padding:8px 0;margin:8px 0}
.sidebar #execution-controls{font-size:12px}
.planning{margin:0;overflow:hidden}
.chat-flow{position:relative;min-height:0;display:flex;flex-direction:column;padding:28px 24px;overflow:auto}
.chat-flow #welcome{flex:1;min-height:120px;width:100%;margin:0;place-content:center}
.welcome h1{font-size:24px;line-height:1.2;letter-spacing:-.04em;font-weight:600}
.welcome p{margin:12px 0}
#discussion{width:min(720px,100%);margin:0 auto}
.session-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.session-header h1{font-size:16px;margin:0}
.icon{background:transparent;color:var(--vscode-descriptionForeground);border:0;width:30px;height:30px;padding:0;border-radius:5px;font-size:18px}
.icon:hover{background:var(--vscode-list-hoverBackground)}
#conversation{width:100%}
.turn{margin:16px 0 24px}
.user-message{max-width:85%;padding:10px 14px}
.user-message p,.assistant-message>p:first-child{font-size:11px;color:var(--vscode-descriptionForeground)}
.assistant-message{padding:12px 0}
.assistant-message details{border-top:1px solid var(--vscode-panel-border)}
.composer-zone{flex:none;padding-bottom:14px}
#composer{border-radius:18px;padding:8px;background:var(--vscode-input-background)}
#goal{width:100%;resize:vertical;font:inherit;color:var(--vscode-input-foreground);outline:none}
.composer-bar select{font-size:12px;border:0;background:transparent}
.composer-bar #send-codex{display:grid;place-items:center;background:var(--vscode-foreground);color:var(--vscode-editor-background)}
.composer-bar #context-toggle{border-radius:50%;font-size:18px}
.connection{font-size:11px;padding-inline:8px;margin:6px 0 0}
#status{font-size:12px}
#execution-status:empty,#active-execution:empty{display:none}
#execution-status:not(:empty),#active-execution:not(:empty){font-size:12px;padding:6px 16px;border-bottom:1px solid var(--vscode-panel-border)}
#active-execution button{font-size:12px;padding:3px 8px;margin-left:8px}
#supporting-stop{padding:4px 12px;flex:none;border-bottom:1px solid var(--vscode-panel-border)}
.artifacts-panel{position:absolute;z-index:5;right:0;top:0;bottom:0;width:min(320px,90%);padding:16px;background:var(--vscode-sideBar-background);border-left:1px solid var(--vscode-panel-border);overflow:auto}
.artifacts-panel header{display:flex;justify-content:space-between;align-items:center}
.artifacts-panel button:not(.icon){display:block;background:transparent;color:var(--vscode-textLink-foreground);text-align:left}
@media(max-width:620px){.chat-flow{padding:20px 12px}.welcome h1{font-size:24px}}

body{background:var(--vscode-sideBar-background)}
.workspace-nav button{position:relative;background:transparent;color:var(--vscode-descriptionForeground)}
.workspace-nav button[aria-selected=true]{color:var(--vscode-foreground);border-bottom:2px solid var(--vscode-focusBorder);border-radius:0}
.workspace-nav button:focus-visible{outline-offset:-2px}.sidebar{padding:8px 12px}.chat-flow{padding:16px 12px}
.composer-zone{padding:8px 10px 12px}.context-panel{left:10px;right:10px}.composer-bar{gap:3px}#model{max-width:145px;font-size:11px}.composer-bar button{font-size:11px}#context-chips{display:flex;gap:4px;flex-wrap:wrap}#context-chips button{font-size:11px;color:var(--vscode-foreground);background:var(--vscode-badge-background);border-radius:5px;padding:2px 6px}.session-dot{width:9px;height:9px}
.agent-row{display:flex;gap:8px;align-items:center;justify-content:space-between}.agent-row h5{font-size:13px;margin:8px 0;font-weight:500}.agent-row button[data-reference-assignment]{background:transparent;color:var(--vscode-descriptionForeground);font-size:18px}.agent-row+details{font-size:12px}
.source-icon svg{width:16px;height:16px;vertical-align:middle}.context-panel #context-search{width:100%;padding:6px 8px;color:var(--vscode-input-foreground);background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,var(--vscode-panel-border));border-radius:4px}.skill-list{border-top:1px solid var(--vscode-panel-border);margin-top:12px}.skill-row{display:flex;align-items:center;gap:8px;padding:6px 8px}.skill-row span{flex:1;overflow-wrap:anywhere}.sidebar .skill-row button{background:transparent;color:var(--vscode-descriptionForeground);font-size:18px}.skill-row small{display:block;color:var(--vscode-descriptionForeground);font-size:11px}
main{position:relative}.setup-overlay{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:24px 22px;background:color-mix(in srgb,var(--vscode-sideBar-background) 84%,transparent);backdrop-filter:blur(3px)}
.setup-card{width:100%;max-width:300px}.setup-logo{width:36px;height:36px;display:grid;place-items:center;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-radius:8px;font-size:22px;font-weight:650;margin-bottom:24px}.setup-card h1{font-size:27px;line-height:1.2;letter-spacing:-.65px;margin:0 0 15px}.setup-card>p{font-size:13px;color:var(--vscode-foreground);margin:0 0 22px}.setup-card #connect-codex{display:flex;width:100%;justify-content:space-between;align-items:center;border-radius:5px;padding:11px 14px;font-size:13px;font-weight:550;background:var(--vscode-button-background);color:var(--vscode-button-foreground)}.setup-card .setup-note{font-size:11px;color:var(--vscode-descriptionForeground);margin:12px 0 0}.setup-card #setup-status{font-size:12px;margin:18px 0 0;color:var(--vscode-descriptionForeground)}#setup-status:empty{display:none}#active-execution:not(:empty),#supporting-stop:not([hidden]){position:relative;z-index:21;background:var(--vscode-sideBar-background)}
</style></head><body data-project-id="${projectId.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"><a class="skip" href="#goal">Skip to composer</a><main>
<header class="app-bar"><strong>Piarre</strong><button id="new-session" type="button" class="secondary">New chat</button></header>
<nav class="workspace-nav" role="tablist" aria-label="Piarre views"><button type="button" data-pane="chat" aria-label="Chat" title="Chat"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4h16v12H9l-5 4z"/></svg></button><button type="button" data-pane="sessions" aria-label="Sessions" title="Sessions"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4h16v13H9l-5 4zM8 9h8m-8 4h5"/></svg></button><button type="button" data-pane="agents" aria-label="Agents" title="Agents"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4m-4 6h1m6 0h1m-7 3h6"/></svg></button><button type="button" data-pane="knowledge" aria-label="Knowledge" title="Knowledge"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1zm0 0v15"/></svg></button></nav><div id="execution-status" role="status" aria-live="polite" aria-atomic="true"></div><div id="active-execution"></div><div id="supporting-stop" hidden><button id="stop-supporting" type="button">Stop discussion</button></div><div class="workspace-columns">
<aside id="workspace" class="sidebar" aria-label="Workspace" hidden>

<section id="sessions-pane" role="tabpanel" hidden><h2>Sessions</h2><div id="sessions"></div><details><summary>Saved goals</summary><p class="hint">Saved proposals require review before work can run.</p><p id="browse-status" role="status"></p><div id="inspection">${inspection}</div></details><details><summary>Project brief</summary><div id="session-brief">${brief}</div></details></section>
<section id="agents-pane" role="tabpanel" hidden><h2>Agents</h2><div id="execution-controls">${executionControls}</div><div id="agent-overview">${agentOverview}</div><section class="skill-list" aria-label="Repository skills"><h2>Skills</h2><div id="repository-skills"></div></section></section>
<section id="knowledge-pane" role="tabpanel" hidden><h2>Knowledge</h2><div id="knowledge"></div></section>
</aside>
<section id="chat-pane" class="planning" aria-label="Chat" role="tabpanel">
<div class="chat-flow" id="chat-flow"><div id="welcome" class="welcome"><h1>Welcome back.</h1><p class="hint">Start with a message or choose a session.</p></div>
<section id="discussion" hidden><header class="session-header"><h1 id="session-title">Conversation</h1><button id="artifacts-toggle" type="button" class="icon" aria-label="Artifacts" title="Session artifacts" aria-expanded="false" aria-controls="session-artifacts">▤</button></header><section id="conversation" aria-label="Project conversation"></section></section></div>
<aside id="session-artifacts" class="artifacts-panel" hidden><header><h2>Artifacts</h2><button id="artifacts-close" type="button" class="icon" aria-label="Close artifacts">×</button></header><div id="artifact-list"></div></aside><div class="proposal-zone"><p id="step" hidden>Step 1 of 2 · Goal</p><h2 id="page-title" tabindex="-1" hidden>Plan a task</h2><section id="preview" aria-label="Proposal review" hidden></section><div id="review-actions" hidden><button id="save" type="button" hidden>Save proposal</button><button id="discard" class="secondary" type="button">Back to chat</button></div><button id="new-goal" type="button" hidden>Back to chat</button></div>
<div class="composer-zone">
<div id="context-panel" class="context-panel" hidden><h3>Add to this message</h3><div class="context-actions"></div><label><input id="attach-files" type="checkbox"> Choose repository file excerpts when sending</label><input id="context-search" type="search" aria-label="Search context" placeholder="Search context…"><p id="context-summary" class="hint" role="status"></p><div id="context-records"></div><button id="context-more" type="button" hidden>Show more</button><p class="hint">Selected references are reviewed before sharing. Referencing an agent or skill does not run it.</p></div>
<form id="composer"><div id="context-chips" aria-label="Selected context"></div><textarea id="goal" aria-label="Message" maxlength="10000" placeholder="Work with Piarre"></textarea><div class="composer-bar"><button id="context-toggle" class="quiet" type="button" title="Add context" aria-label="Add context" aria-controls="context-panel" aria-expanded="false">+</button><button id="prepare" class="quiet" type="submit">Draft plan</button><button id="reconnect-codex" class="quiet" type="button" hidden>Reconnect Codex</button><button id="disconnect-codex" class="quiet" type="button" hidden>Disconnect</button><button id="stop-conversation" type="button" hidden>Stop</button><button id="load-models" class="quiet" type="button" hidden>Load models</button><select id="model" aria-label="Discussion model"><option value="">Codex default</option></select><button id="send-codex" type="submit" aria-label="Send to Codex" title="Send (Enter)" disabled>↑</button></div></form>
<p id="connection-status" class="connection" role="status">Connect Codex to send a discussion message.</p><p id="status" role="status" aria-live="polite"></p>
</div></section></div><section id="setup-overlay" class="setup-overlay" role="region" aria-labelledby="setup-heading"><div class="setup-card"><div class="setup-logo" aria-hidden="true">P</div><h1 id="setup-heading">Let's get started<br>with Piarre.</h1><p>To start, connect with Codex.</p><button id="connect-codex" type="button">Connect with Codex <span aria-hidden="true">→</span></button><p class="setup-note">Use your configured Codex account.</p><p id="setup-status" role="status" aria-live="polite"></p></div></section></main>
<div id="session-menu" aria-label="Session actions" hidden><button type="button" data-session-action="rename">Rename</button><button type="button" data-session-action="fork">Fork conversation</button><button type="button" data-session-action="share">Share session</button><button type="button" data-session-action="archive">Remove session</button></div>
<script nonce="${nonce}">${composerScript}</script></body></html>`;
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
let sessions = [];
let sessionId = 'project-chat';
let pendingSend;
let draftVersion = crypto.randomUUID();
const projectId = document.body.dataset.projectId;
const restored = api.getState?.();
const stored = restored?.projectId === projectId ? restored : undefined;
let setupCompleted = stored?.setupCompleted === true;
let setupWasOpen = false;
let connectionAttempted = false;
const sessionDrafts = new Map(Array.isArray(stored?.drafts) ? stored.drafts.filter(row => Array.isArray(row) && typeof row[0] === 'string' && typeof row[1]?.text === 'string' && row[1].text.length <= 10000).slice(-50) : []);
let activePane = ['chat','sessions','agents','knowledge'].includes(stored?.pane) ? stored.pane : 'chat';
if (typeof stored?.sessionId === 'string') sessionId = stored.sessionId;
const model = document.getElementById('model');
const files = document.getElementById('attach-files');
const contextRecords = document.getElementById('context-records');
const contextPanel = document.getElementById('context-panel');
const contextToggle = document.getElementById('context-toggle');
const contextSearch = document.getElementById('context-search');
let contextLimit = 12;
const workspace = document.getElementById('workspace');
const menu = document.getElementById('session-menu');
let menuRow;
let selectedReferences = [];
function recordIds() { return selectedReferences; }
function edited() { draftVersion = crypto.randomUUID(); remember(); }
function restoreRecords(ids) { selectedReferences = Array.isArray(ids) ? ids.filter(id=>typeof id==='string'&&id.length<=2048).slice(0,15) : []; contextRecords.querySelectorAll('input').forEach(input => { input.checked = selectedReferences.includes(input.value); }); }
function renderSession() {
  const list = document.getElementById('sessions');
  const focusedSession = list.contains(document.activeElement) ? document.activeElement.dataset.session : undefined;
  list.replaceChildren();
  const append = (parent, depth) => {
    for (const session of sessions.filter(item => (item.parent && sessions.some(candidate => candidate.id === item.parent.id) ? item.parent.id : undefined) === parent)) {
      const row = document.createElement('button'); row.type = 'button'; row.className = 'session-row'; row.dataset.session = session.id;
      row.dataset.child = String(depth > 0); row.setAttribute('aria-current', String(session.id === sessionId));
      const name = document.createElement('span'); name.textContent = session.title; row.title = session.title;
      const dot = document.createElement('span'); dot.className = 'session-dot'; dot.dataset.status = session.status; dot.title = session.status;
      dot.setAttribute('role', 'img'); dot.setAttribute('aria-label', session.status);
      row.append(name, dot); list.append(row); if (focusedSession === session.id) row.focus();
      append(session.id, depth + 1);
    }
  };
  append(undefined, 0);
  const selected = sessions.find(item => item.id === sessionId);
  const conversation = document.getElementById('conversation');
  const transcript = selected?.html ?? '';
  if (conversation.dataset.rendered !== transcript) {
    const flow = document.getElementById('chat-flow');
    const atEnd = flow.scrollHeight - flow.scrollTop - flow.clientHeight < 48;
    conversation.innerHTML = transcript; conversation.dataset.rendered = transcript;
    if (atEnd) requestAnimationFrame(() => { flow.scrollTop = flow.scrollHeight; });
  }
  const artifacts = document.getElementById('artifact-list');
  artifacts.replaceChildren();
  for (const artifact of selected?.artifacts ?? []) {
    const row = document.createElement('div');
    const proposal = document.createElement('button'); proposal.type = 'button'; proposal.textContent = artifact.title;
    proposal.onclick = () => api.postMessage({kind:'open-proposal',groupId:artifact.id}); row.append(proposal);
    for (const id of artifact.runs) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Review run';
      button.dataset.executionAction = 'view'; button.dataset.executionId = id; row.append(button);
    }
    artifacts.append(row);
  }
  if (!artifacts.childElementCount) artifacts.textContent = 'No artifacts recorded for this session.';
  document.getElementById('session-title').textContent = selected?.title ?? 'Conversation';
  const hasContent = !!selected?.html;
  const discussion = document.getElementById('discussion');
  discussion.hidden = !hasContent;
  discussion.dataset.session = sessionId;
  document.getElementById('welcome').hidden = !!hasContent;
  syncSend();
}
function setArtifacts(open) {
  document.getElementById('session-artifacts').hidden = !open;
  document.getElementById('artifacts-toggle').setAttribute('aria-expanded',String(open));
}
document.getElementById('artifacts-toggle').onclick = () => setArtifacts(document.getElementById('session-artifacts').hidden);
document.getElementById('artifacts-close').onclick = () => {setArtifacts(false);document.getElementById('artifacts-toggle').focus();};
function setContext(open) {
  contextPanel.hidden = !open; contextToggle.setAttribute('aria-expanded', String(open));
  if (open) { contextLimit=12; rankContext(); contextSearch.focus(); }
}
function rankContext() {
  const query=contextSearch.value.toLowerCase().trim();
  const words=[...new Set((query||goal.value.toLowerCase()).match(/[\p{L}\p{N}_-]+/gu)??[])];
  const ranked=[...contextRecords.children].map(label=>{
    const text=label.textContent.toLowerCase();
    return {label,score:words.filter(word=>text.includes(word)).length,match:!query||words.every(word=>text.includes(word))};
  }).sort((a,b)=>b.score-a.score||a.label.textContent.localeCompare(b.label.textContent));
  let shown=0;let matches=0;
  for(const row of ranked){if(row.match)matches++;row.label.hidden=!row.match||shown>=contextLimit;if(!row.label.hidden)shown++;contextRecords.append(row.label);}
  document.getElementById('context-more').hidden=shown>=matches;
  document.getElementById('context-summary').textContent=matches?String(shown)+' of '+String(matches)+' references'+(query?'':' · Suggested for your message'):'No matching references.';
}
contextSearch.addEventListener('input',()=>{contextLimit=12;rankContext();});
document.getElementById('context-more').onclick=()=>{contextLimit+=12;rankContext();};
contextPanel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setContext(false);contextToggle.focus();}});
contextToggle.onclick = () => setContext(contextPanel.hidden);
function selectSession(id) {
  if (sessionId !== id) {
    remember();
    sessionId = id;
    const saved = sessionDrafts.get(id);
    draftVersion = saved?.version ?? crypto.randomUUID();
    goal.value = saved?.text ?? ''; model.value = saved?.model ?? ''; files.checked = saved?.files ?? false; restoreRecords(saved?.records ?? []);
    invalidate(); showGoal(); status.textContent = ''; setContext(false); setArtifacts(false);
  }
  renderSession(); renderChips();
  const flow = document.getElementById('chat-flow'); flow.scrollTop = sessionDrafts.get(id)?.scroll ?? flow.scrollHeight; remember();
}
function setPane(pane, focus = false) {
  if (!['chat','sessions','agents','knowledge'].includes(pane)) return;
  activePane = pane;
  workspace.hidden = pane === 'chat';
  document.querySelectorAll('[data-pane]').forEach(button => {
    const selected = button.dataset.pane === pane;
    button.setAttribute('role','tab'); button.id = 'tab-'+button.dataset.pane;
    button.setAttribute('aria-controls',button.dataset.pane+'-pane');
    button.setAttribute('aria-selected',String(selected)); button.tabIndex=selected?0:-1;
    const panel = document.getElementById(button.dataset.pane+'-pane'); panel.hidden=!selected;
    panel.setAttribute('aria-labelledby',button.id);
  });
  if (focus) goal.focus();
  remember();
}
function remember() {
  sessionDrafts.set(sessionId,{version:draftVersion,text:goal.value,model:model.value,files:files.checked,records:recordIds(),scroll:document.getElementById('chat-flow').scrollTop});
  api.setState?.({projectId,pane:activePane,sessionId,setupCompleted,drafts:[...sessionDrafts].slice(-50),models:[...model.options].map(option=>option.value)});
}
function renderChips() {
  const chips=document.getElementById('context-chips'); chips.replaceChildren();
  for(const id of selectedReferences) {
    const input=[...contextRecords.querySelectorAll('input')].find(item=>item.value===id);
    const label=input?.parentElement.textContent.trim() ?? 'Unavailable reference';
    const chip=document.createElement('button');chip.type='button';chip.textContent=label+' ×';
    chip.setAttribute('aria-label','Remove '+label);
    chip.onclick=()=>{if(input)input.checked=false;selectedReferences=selectedReferences.filter(value=>value!==id);renderChips();edited();goal.focus()};chips.append(chip);
  }
}
document.getElementById('new-session').onclick = () => api.postMessage({kind:'session-action',action:'new'});
document.getElementById('load-models').onclick = () => api.postMessage({kind:'load-models'});
document.querySelector('.workspace-nav').onclick = event => {
  const pane = event.target.closest('[data-pane]')?.dataset.pane;
  if (pane) setPane(pane);
};
document.querySelector('.workspace-nav').onkeydown = event => {
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const buttons=[...document.querySelectorAll('[data-pane]')];const i=buttons.indexOf(document.activeElement);
  const next=event.key==='Home'?0:event.key==='End'?3:(i+(event.key==='ArrowRight'?1:3))%4;
  setPane(buttons[next].dataset.pane);buttons[next].focus();
};
function openSessionMenu(row,x,y) {
  menuRow = row; menu.hidden = false;
  menu.style.left = Math.max(4, Math.min(x, innerWidth-menu.offsetWidth-4))+'px';
  menu.style.top = Math.max(4, Math.min(y, innerHeight-menu.offsetHeight-4))+'px';
  menu.querySelector('button').focus();
}
const sessionList = document.getElementById('sessions');
sessionList.onclick = event => {
  const id = event.target.closest('[data-session]')?.dataset.session;
  if (!id) return;
  selectSession(id); setPane('chat',true);
};
sessionList.oncontextmenu = event => {
  const row = event.target.closest('[data-session]'); if (!row) return;
  event.preventDefault(); openSessionMenu(row,event.clientX,event.clientY);
};
sessionList.onkeydown = event => {
  if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
  const row = event.target.closest('[data-session]'); if (!row) return;
  event.preventDefault(); const rect = row.getBoundingClientRect(); openSessionMenu(row,rect.x,rect.bottom);
};
menu.onclick = event => {
  const action = event.target.closest('[data-session-action]')?.dataset.sessionAction;
  if (!action || !menuRow) return;
  menu.hidden = true; menuRow.focus(); api.postMessage({kind:'session-action',action,id:menuRow.dataset.session});
};
menu.onkeydown = event => {
  if (event.key === 'Escape' || event.key === 'Tab') { menu.hidden = true; menuRow?.focus(); }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault(); const rows = [...menu.querySelectorAll('button')];
  rows[(rows.indexOf(document.activeElement)+(event.key==='ArrowDown'?1:rows.length-1))%rows.length].focus();
};
document.addEventListener('pointerdown', event => {
  if (!menu.contains(event.target)) menu.hidden = true;
  if (!contextPanel.contains(event.target) && !contextToggle.contains(event.target)) setContext(false);
});
let executionAnnouncements = new Map();
function syncSend() { send.disabled = connectionKind !== 'ready' || !!pendingSend || !sessions.some(item=>item.id===sessionId) || !goal.value.trim(); }
function connectCodex() {
  if(connectionKind !== 'disconnected') return;
  connectionAttempted=true;
  document.getElementById('connect-codex').disabled=true;
  document.getElementById('setup-status').textContent='Checking your local Codex connection…';
  api.postMessage({kind:'connect-codex'});
}
document.getElementById('connect-codex').addEventListener('click',connectCodex);
document.getElementById('reconnect-codex').addEventListener('click',connectCodex);
function syncSetup(message='') {
  const connected=['ready','busy','stopping'].includes(connectionKind);
  if(connected)setupCompleted=true;
  const open=!setupCompleted;
  document.getElementById('setup-overlay').hidden=!open;
  for(const element of document.querySelector('main').children)if(element.id!=='setup-overlay'&&element.id!=='active-execution'&&element.id!=='supporting-stop')element.inert=open;
  const button=document.getElementById('connect-codex');
  button.disabled=connectionKind==='connecting';
  button.hidden=connected;
  button.textContent=connectionKind==='connecting'?'Connecting…':connectionAttempted?'Try again':'Connect with Codex →';
  document.getElementById('setup-status').textContent=connectionKind==='connecting'||connectionAttempted?message:'';
  document.getElementById('reconnect-codex').hidden=connectionKind!=='disconnected'||!setupCompleted;
  if(setupWasOpen&&!open){setPane('chat',true);remember();}
  if(open&&!setupWasOpen)button.focus();
  setupWasOpen=open;
}

document.getElementById('disconnect-codex').addEventListener('click', () => api.postMessage({kind:'disconnect-codex'}));
document.getElementById('stop-conversation').addEventListener('click', () => api.postMessage({kind:'stop-conversation'}));
document.getElementById('stop-supporting').addEventListener('click', () => api.postMessage({kind:'stop-conversation'}));
document.addEventListener('click',event=>{const button=event.target instanceof Element?event.target.closest('[data-coordination-action]'):null;if(button)api.postMessage({kind:'coordination',action:button.dataset.coordinationAction,requestId:crypto.randomUUID(),...(button.dataset.coordinationId?{id:button.dataset.coordinationId}:{}),...(button.dataset.assignmentId?{assignmentId:button.dataset.assignmentId}:{})});});
document.addEventListener('click', event => { const button=event.target instanceof Element?event.target.closest('[data-execution-action]'):null; if(button)api.postMessage(button.dataset.executionId?{kind:'execution',action:button.dataset.executionAction,id:button.dataset.executionId}:{kind:'execution',action:button.dataset.executionAction}); });
function showGoal() {
  composer.hidden = false; preview.hidden = true; actions.hidden = true; next.hidden = true;
  title.hidden = true; step.hidden = true;
  title.textContent = 'Plan a task'; step.textContent = 'Step 1 of 2 · Goal';
}
workspace.addEventListener('click', (event) => {
  const reference = event.target.closest('[data-reference-assignment]')?.dataset.referenceAssignment;
  if (reference) {
    const input = [...contextRecords.querySelectorAll('input')].find(item => item.value === reference);
    if (!input) { status.textContent = 'This assignment is outside the current reference list.'; return; }
    if (!input.checked && recordIds().length >= 15) { status.textContent = 'Choose at most 15 project references.'; return; }
    input.checked = true; selectedReferences=[...new Set([...selectedReferences,input.value])];
    edited(); setPane('chat',true); renderChips();
    status.textContent = input.value.startsWith('skill-file:')?'Skill selected. Its text excerpt will be reviewed before sharing.':'Agent added as discussion context.'; goal.focus(); return;
  }
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
  status.textContent = ''; edited();
  if(!contextPanel.hidden)rankContext();
});
document.getElementById('composer').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!goal.value.trim()) return;
  if (event.submitter === send) {
    if (send.disabled) return;
    pendingSend = { id: crypto.randomUUID(), sessionId, version:draftVersion };
    api.postMessage({kind:'send-conversation', requestId:pendingSend.id, sessionId, text:goal.value, model:model.value, attachFiles:files.checked, recordIds:recordIds()});
    syncSend(); return;
  }
  invalidate();
  requestId = crypto.randomUUID();
  discard.disabled = false;
  prepare.disabled = true;
  status.textContent = 'Preparing a local preview…';
  api.postMessage({kind: 'preview', requestId, goal: goal.value, ...(sessionId && {sessionId})});
});
goal.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.isComposing) {
    event.preventDefault();
    if (!send.disabled) composer.requestSubmit(send);
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
  if (data.kind === 'select-session') { selectSession(data.id); setPane('chat',true); return; }
  if (data.kind === 'models') {
    const previous = model.value;
    model.replaceChildren(new Option('Codex default',''), ...data.models.map(name=>new Option(name,name)));
    model.value = data.models.includes(previous) ? previous : '';
    if(model.value!==previous)edited();
    return;
  }
  if (data.kind === 'send-accepted' && pendingSend?.id === data.requestId) {
    if (sessionId === data.sessionId && draftVersion === pendingSend.version) {
      goal.value = ''; files.checked = false; restoreRecords([]); invalidate();
      draftVersion = crypto.randomUUID();
    } else if (sessionDrafts.get(data.sessionId)?.version === pendingSend.version) {
      sessionDrafts.set(data.sessionId,{...sessionDrafts.get(data.sessionId),version:crypto.randomUUID(),text:'',files:false,records:[]});
    }
    renderChips(); remember(); syncSend(); return;
  }
  if (data.kind === 'send-finished' && pendingSend?.id === data.requestId) { pendingSend = undefined; syncSend(); return; }
  if (data.kind === 'conversation') {
    connectionKind = data.state.kind;
    if(connectionKind==='disconnected')modelsLoaded=false;
    if(connectionKind==='ready'&&!modelsLoaded){modelsLoaded=true;api.postMessage({kind:'load-models'});}
    document.getElementById('connection-status').textContent = data.state.message;
    syncSetup(data.state.message);
    document.getElementById('disconnect-codex').hidden = connectionKind === 'disconnected';
    const stop = document.getElementById('stop-conversation'); stop.hidden = !['busy','stopping'].includes(connectionKind); stop.disabled = connectionKind === 'stopping';
    document.getElementById('load-models').hidden = connectionKind !== 'ready';
    sessions = data.sessions ?? [];
    if (!sessions.some(item=>item.id===sessionId)) selectSession(sessions[0]?.id ?? '');
    else renderSession();
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
    const knowledge = document.getElementById('knowledge');
    const openKnowledge = new Set([...knowledge.querySelectorAll('details[open]')].map(detail=>detail.querySelector('summary')?.textContent));
    knowledge.innerHTML = data.knowledge ?? '';
    knowledge.querySelectorAll('details').forEach(detail=>{detail.open=openKnowledge.has(detail.querySelector('summary')?.textContent);});
    const selectedRecords = recordIds();
    contextRecords.replaceChildren();
    for (const source of data.sources ?? []) {
      const label = document.createElement('label'); const input = document.createElement('input');
      input.type = 'checkbox'; input.value = source.id; input.checked = selectedRecords.includes(source.id);
      input.addEventListener('change', () => {
        selectedReferences = [...contextRecords.querySelectorAll('input:checked')].map(input=>input.value);
        if (recordIds().length > 15) { input.checked = false; selectedReferences=selectedReferences.filter(id=>id!==input.value);status.textContent = 'Choose at most 15 project references.'; }
        renderChips(); edited();
      });
      const icon=document.createElement('span');icon.className='source-icon';icon.setAttribute('aria-hidden','true');
      const paths={assignment:'M12 3v4M4 7h16v12H4zM8 12h1m6 0h1m-7 4h6',knowledge:'M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15',skill:'m14 3-9 11h6l-1 7 9-12h-6z',work:'M4 4h16v13H9l-5 4zM8 9h8m-8 4h5'};
      icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="'+(paths[source.type]??paths.work)+'"/></svg>';
      const text=document.createElement('span');text.textContent=(source.type==='assignment'?'Agent':source.type==='knowledge'?'Knowledge':source.type==='skill'?'Skill':'Work')+' · '+source.label;
      label.append(input,icon,text);contextRecords.append(label);
    }
    const skills=document.getElementById('repository-skills');skills.replaceChildren();
    for(const source of (data.sources??[]).filter(source=>source.type==='skill')){
      const row=document.createElement('div');row.className='skill-row';
      const label=document.createElement('span');label.textContent=source.label;
      const add=document.createElement('button');add.type='button';add.textContent='+';add.dataset.referenceAssignment=source.id;add.setAttribute('aria-label','Reference skill '+source.label);
      row.append(label,add);skills.append(row);
    }
    if(!skills.childElementCount)skills.textContent=data.skillStatus??'No eligible repository skills found. Skills are referenced as text, never run automatically.';
    rankContext();
    renderChips();
    if (typeof data.agentOverview === 'string') document.getElementById('agent-overview').innerHTML = data.agentOverview;
    if (typeof data.executionControls === 'string') document.getElementById('execution-controls').innerHTML = data.executionControls;
    const activeControls = document.getElementById('active-execution');
    activeControls.replaceChildren();
    for (const original of document.getElementById('execution-controls').querySelectorAll('[data-execution-action="stop"],[data-execution-action="reconcile"]')) {
      const button = original.cloneNode(true); activeControls.append(button);
    }
    document.querySelectorAll('[data-review-key]').forEach(details => {
      details.open = expandedReviews.has(details.dataset.reviewKey);
      if (details.dataset.reviewKey === focusedReview) details.querySelector('summary')?.focus({preventScroll:true});
    });
    const executionStatus = document.getElementById('execution-controls').querySelector('[data-execution-status]')?.dataset.executionStatus;
    if (executionStatus) {
      const updates = JSON.parse(executionStatus);
      const changed = updates.filter(item => !(item.id === 'scheduling' && item.text.startsWith('Scheduling available')) && executionAnnouncements.get(item.id) !== item.text).map(item => item.text);
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
    document.getElementById('browse-status').textContent = data.groupId ? 'Proposal opened in the details pane. Your chat draft is preserved in the Piarre sidebar.' : '';
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
      composer.hidden = true; next.hidden = false; title.hidden = false; step.hidden = false; title.textContent = 'Proposal saved'; step.textContent = 'Saved · Not approved to run';
      title.focus();
    }
  }
  if (state.kind === 'ready') {
    composer.hidden = true; preview.hidden = false; actions.hidden = false;
    title.hidden = false; step.hidden = false; title.textContent = 'Review your proposal'; step.textContent = 'Step 2 of 2 · Review';
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
for(const name of stored?.models ?? []) if(typeof name==='string' && name && ![...model.options].some(option=>option.value===name)) model.add(new Option(name,name));
const initialDraft=sessionDrafts.get(sessionId);draftVersion=initialDraft?.version??crypto.randomUUID();goal.value=initialDraft?.text??'';model.value=initialDraft?.model??'';files.checked=initialDraft?.files??false;restoreRecords(initialDraft?.records??[]);prepare.disabled=!goal.value.trim();
const contextActions=document.querySelector('.context-actions');
for(const id of ['prepare','load-models','disconnect-codex','reconnect-codex'])contextActions.append(document.getElementById(id));
prepare.type='button';prepare.onclick=()=>{setContext(false);composer.requestSubmit();};

let modelsLoaded=false;
model.addEventListener('change',edited);files.addEventListener('change',edited);
document.getElementById('chat-flow').addEventListener('scroll',remember,{passive:true});
window.addEventListener('pagehide',remember);
setPane(activePane);
syncSetup();
api.postMessage({kind: 'ready'});
`;
