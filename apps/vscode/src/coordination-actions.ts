export type CoordinationMessage = { readonly kind: "coordination"; readonly action: "prepare" | "prepare-idea" | "capture" | "approve" | "return" | "steer" | "stop" | "compare" | "review-unknown"; readonly requestId: string; readonly id?: string; readonly assignmentId?: string };
export function parseCoordinationMessage(value: unknown): CoordinationMessage | undefined {
  if (typeof value !== "object" || value === null || !("kind" in value) || value.kind !== "coordination" || !("action" in value) || !("requestId" in value) || typeof value.requestId !== "string" || !value.requestId || value.requestId.length > 512) return;
  const action = value.action;
  if (action !== "prepare" && action !== "prepare-idea" && action !== "capture" && action !== "approve" && action !== "return" && action !== "steer" && action !== "stop" && action !== "compare" && action !== "review-unknown") return;
  const keys = action === "prepare" || action === "capture" ? ["kind", "action", "requestId"] : action === "steer" || action === "stop" || action === "review-unknown" ? ["kind", "action", "requestId", "id", "assignmentId"] : ["kind", "action", "requestId", "id"];
  if (Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) return;
  const id = "id" in value && typeof value.id === "string" && value.id.length <= 512 ? value.id : undefined;
  const assignmentId = "assignmentId" in value && typeof value.assignmentId === "string" && value.assignmentId.length <= 512 ? value.assignmentId : undefined;
  if (keys.includes("id") && !id || keys.includes("assignmentId") && !assignmentId) return;
  return { kind: "coordination", action, requestId: value.requestId, ...(id ? { id } : {}), ...(assignmentId ? { assignmentId } : {}) };
}
