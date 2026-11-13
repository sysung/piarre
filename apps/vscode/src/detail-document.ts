import { randomUUID } from "node:crypto";

export const escapeDetail = (value: string): string => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
export type DetailDocument<Request> = Readonly<{
  recordKey: string;
  documentId: string;
  content: string;
  html: string;
  controls: ReadonlyMap<string, Request>;
}>;

export function detailControls<Request>() {
  const controls = new Map<string, Request>();
  const occurrences = new Map<string, number>();
  return {
    controls,
    attributes(request: Request, region: string): string {
      const semanticKey = JSON.stringify([region, request]);
      const occurrence = occurrences.get(semanticKey) ?? 0;
      occurrences.set(semanticKey, occurrence + 1);
      const key = JSON.stringify([semanticKey, occurrence]);
      controls.set(key, request);
      return `data-detail-control="${escapeDetail(key)}"`;
    },
  };
}

export function detailRequest<Request>(raw: unknown, document: DetailDocument<Request>): { key: string; request: Request } | undefined {
  if (typeof raw !== "object" || raw === null || Object.keys(raw).length !== 4 || !("kind" in raw) || raw.kind !== "detail-action"
    || !("recordKey" in raw) || raw.recordKey !== document.recordKey || !("documentId" in raw) || raw.documentId !== document.documentId
    || !("controlKey" in raw) || typeof raw.controlKey !== "string") return;
  const request = document.controls.get(raw.controlKey);
  return request === undefined ? undefined : { key: raw.controlKey, request };
}

export function renderDetailDocument<Request>(recordKey: string, content: string, styles: string, controls: ReadonlyMap<string, Request>): DetailDocument<Request> {
  const documentId = randomUUID();
  const encoded = JSON.stringify({ recordKey, documentId }).replaceAll("<", "\\u003c");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${documentId}'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body>${content}<script nonce="${documentId}">
const api = acquireVsCodeApi();
const identity = ${encoded};
const disclosures = [...document.querySelectorAll('details[data-review-key]')];
const buttons = [...document.querySelectorAll('[data-detail-control]')];
const state = api.getState();
let restoring = true;
function remember() {
  if (restoring) return;
  api.setState({recordKey:identity.recordKey, open:disclosures.filter(item=>item.open).map(item=>item.dataset.reviewKey), scroll:window.scrollY,
    focus:disclosures.find(item=>item.querySelector('summary')===document.activeElement)?.dataset.reviewKey,
    control:document.activeElement?.dataset.detailControl});
}
if (state && state.recordKey === identity.recordKey) {
  disclosures.forEach(item=>{item.open=Array.isArray(state.open)&&state.open.includes(item.dataset.reviewKey);});
}
requestAnimationFrame(()=>{
  if (state && state.recordKey === identity.recordKey) {
    window.scrollTo(0,Number.isFinite(state.scroll)?state.scroll:0);
    disclosures.find(item=>item.dataset.reviewKey===state.focus)?.querySelector('summary')?.focus({preventScroll:true});
    buttons.find(item=>item.dataset.detailControl===state.control)?.focus({preventScroll:true});
  } else window.scrollTo(0,0);
  restoring=false;
  remember();
});
disclosures.forEach(item=>item.addEventListener('toggle',remember));
window.addEventListener('scroll',remember,{passive:true});
document.addEventListener('focusin',remember);
document.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('[data-detail-control]'):null;
  if(button&&!button.disabled)api.postMessage({kind:'detail-action',...identity,controlKey:button.dataset.detailControl});
});
</script></body></html>`;
  return { recordKey, documentId, content, html, controls };
}
