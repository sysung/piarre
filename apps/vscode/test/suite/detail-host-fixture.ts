import assert from "node:assert/strict";
import * as vscode from "vscode";

export class DetailHost {
  readonly panels = new Map<string, vscode.WebviewPanel>();
  readonly requests: unknown[] = [];
  hold = false;
  private sequence = 0;
  private readonly replies = new Map<number, (value: unknown) => void>();
  readonly createPanel: typeof vscode.window.createWebviewPanel = (...args) => {
    const panel = vscode.window.createWebviewPanel(...args);
    this.panels.set(args[0], panel);
    if (args[0] === "piarre.work") return panel;
    panel.webview.onDidReceiveMessage((message: unknown) => {
      if (typeof message === "object" && message !== null && "testReply" in message && typeof message.testReply === "number") {
        this.replies.get(message.testReply)?.("value" in message ? message.value : undefined);
      }
    });
    const webview = new Proxy(panel.webview, {
      set: (target, key, value: unknown) => {
        if (key === "html" && typeof value === "string") {
          target.html = value.replace("</script>", `${driver}</script>`); return true;
        }
        return Reflect.set(target, key, value);
      },
      get: (target, key) => {
        if (key === "onDidReceiveMessage") return (listener: (message: unknown) => void) => target.onDidReceiveMessage((message: unknown) => {
          if (typeof message === "object" && message !== null && "testReply" in message) return;
          this.requests.push(message);
          if (!this.hold) listener(message);
        });
        const value: unknown = Reflect.get(target, key);
        return typeof value === "function" ? (...args: unknown[]) => Reflect.apply(value, target, args) as unknown : value;
      },
    });
    return new Proxy(panel, { get: (target, key) => {
      if (key === "webview") return webview;
      const value: unknown = Reflect.get(target, key);
      return typeof value === "function" ? (...args: unknown[]) => Reflect.apply(value, target, args) as unknown : value;
    } });
  };
  panel(kind = "piarre.proposal"): vscode.WebviewPanel { const panel = this.panels.get(kind); assert.ok(panel); return panel; }
  async command(command: Record<string, unknown>, kind = "piarre.proposal"): Promise<unknown> {
    if (command.operation === "reading") {
      this.panel(kind).reveal(undefined, false);
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    }
    const id = ++this.sequence;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise((resolve, reject) => {
        this.replies.set(id, value => { if (value && typeof value === "object" && "error" in value) reject(new Error(String(value.error))); else resolve(value); });
        timer = setTimeout(() => { reject(new Error(`Detail driver timed out: ${JSON.stringify(command)}`)); }, 8000);
        void this.panel(kind).webview.postMessage({ ...command, nativeFocus: process.env.PIARRE_DETAIL_NATIVE_FOCUS === "1", testCommand: id });
      });
    } finally { clearTimeout(timer); this.replies.delete(id); }
  }
  async click(selector: string, kind = "piarre.proposal"): Promise<unknown> {
    await this.command({ operation: "click", selector }, kind);
    return this.requests.at(-1);
  }
}

const driver = `
window.addEventListener('message', async event => {
  const message = event.data;
  if (!message || !message.testCommand) return;
  let value;
  try {
    if (message.operation === 'click') document.querySelector(message.selector)?.click();
    if (message.operation === 'post') api.postMessage(message.payload);
    if (message.operation === 'inspect') { await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); value = {state:api.getState(), active:document.activeElement?.outerHTML, scroll:window.scrollY, open:[...document.querySelectorAll('details')].filter(item=>item.open).map(item=>item.dataset.reviewKey), focused:document.hasFocus(),reduced:matchMedia('(prefers-reduced-motion:reduce)').matches}; }
    if (message.operation === 'reading') {
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      window.focus(); if(message.nativeFocus&&!document.hasFocus())throw new Error('Native focus unavailable: unlock and focus the isolated VS Code Host'); const item=document.querySelector(message.selector); if(item){if(item.tagName==='DETAILS')item.open=true;(item.querySelector('summary')||item).focus({preventScroll:true});if(!message.nativeFocus)document.dispatchEvent(new FocusEvent('focusin'));}
      window.scrollTo(0,message.scroll||0);if(!message.nativeFocus)window.dispatchEvent(new Event('scroll'));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    }
    api.postMessage({testReply:message.testCommand,value});
  } catch(error) { api.postMessage({testReply:message.testCommand,value:{error:String(error)}}); }
});
`;
