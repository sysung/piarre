const globalActions = ["pause-all", "resume", "reconcile-all"];
const itemActions = ["prepare", "view", "stop", "reconcile", "apply-accept", "restore-source", "restore-candidate", "open-candidate", "steer"];
type GlobalAction = "pause-all" | "resume" | "reconcile-all";
type ItemAction = "prepare" | "view" | "stop" | "reconcile" | "apply-accept" | "restore-source" | "restore-candidate" | "open-candidate" | "steer";
export type ExecutionMessage = { readonly kind: "execution"; readonly action: GlobalAction }
  | { readonly kind: "execution"; readonly action: ItemAction; readonly id: string };
function globalAction(value: string): value is GlobalAction { return globalActions.includes(value); }
function itemAction(value: string): value is ItemAction { return itemActions.includes(value); }
export function parseExecutionMessage(value: unknown): ExecutionMessage | undefined {
  if (typeof value !== "object" || value === null || !("kind" in value) || value.kind !== "execution" || !("action" in value) || typeof value.action !== "string") return;
  if (globalAction(value.action) && Object.keys(value).length === 2) return { kind: "execution", action: value.action };
  if (itemAction(value.action) && Object.keys(value).length === 3 && "id" in value && typeof value.id === "string" && value.id.length > 0 && value.id.length <= 2048) return { kind: "execution", action: value.action, id: value.id };
  return;
}
