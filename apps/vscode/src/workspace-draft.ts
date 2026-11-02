import { randomUUID } from "node:crypto";
import type { ProjectSnapshot, ProposalDraft } from "../../../packages/core/src/index.js";

export type ComposerMessage =
  | { readonly kind: "preview"; readonly requestId: string; readonly goal: string }
  | { readonly kind: "discard"; readonly requestId: string }
  | { readonly kind: "save"; readonly requestId: string };

export function parseComposerMessage(value: unknown): ComposerMessage | undefined {
  if (typeof value !== "object" || value === null || !("kind" in value) ||
      !("requestId" in value) || typeof value.requestId !== "string" ||
      value.requestId.length < 1 || value.requestId.length > 128) return;
  if (value.kind === "preview" && "goal" in value && typeof value.goal === "string" &&
      value.goal.trim().length > 0 && value.goal.length <= 10000 &&
      Object.keys(value).length === 3) {
    return { kind: "preview", requestId: value.requestId, goal: value.goal.trim() };
  }
  if ((value.kind === "discard" || value.kind === "save") && Object.keys(value).length === 2) {
    return { kind: value.kind, requestId: value.requestId };
  }
  return;
}

export type DraftState =
  | { readonly kind: "idle"; readonly requestId: string | undefined; readonly message: string }
  | { readonly kind: "preparing"; readonly requestId: string; readonly message: string }
  | { readonly kind: "ready"; readonly requestId: string; readonly message: string; readonly draft: ProposalDraft };

export interface DraftOperations {
  readonly prepare: (goal: string) => Promise<ProposalDraft>;
  readonly save: (project: ProjectSnapshot, draft: ProposalDraft, commandId: string) => ProjectSnapshot | undefined;
}

export class WorkspaceDraft {
  state: DraftState = { kind: "idle", requestId: undefined, message: "" };
  private ticket: { readonly requestId: string; readonly project: ProjectSnapshot; readonly commandId: string } | undefined;
  private active = true;

  constructor(private project: ProjectSnapshot, private readonly operations: DraftOperations,
    private readonly changed: () => void) {}

  update(project: ProjectSnapshot): void {
    if (project.projectId !== this.project.projectId || project.revision !== this.project.revision) {
      this.clear("The project changed. Preview your goal again before saving.");
    }
    this.project = project;
  }

  async receive(value: unknown): Promise<void> {
    const message = parseComposerMessage(value);
    if (!message || !this.active) return;
    if (message.kind === "discard") {
      if (this.ticket?.requestId === message.requestId) this.clear("Preview discarded. Nothing was saved.");
      return;
    }
    if (message.kind === "save") {
      const ticket = this.ticket;
      const state = this.state;
      if (!ticket || state.kind !== "ready" || ticket.requestId !== message.requestId) return;
      this.ticket = undefined;
      try {
        const saved = this.operations.save(ticket.project, state.draft, ticket.commandId);
        if (saved) {
          this.project = saved;
          this.clear("Proposal saved. Nothing has started.");
        } else this.clear("The project changed or is unavailable. Preview again before saving.");
      } catch {
        this.clear("The proposal could not be saved. Check the project and preview again.");
      }
      return;
    }
    const ticket = { requestId: message.requestId, project: this.project, commandId: randomUUID() };
    this.ticket = ticket;
    this.state = { kind: "preparing", requestId: message.requestId, message: "Preparing your proposal…" };
    this.changed();
    try {
      const draft = await this.operations.prepare(message.goal);
      if (!this.isCurrent(ticket)) return;
      this.state = { kind: "ready", requestId: message.requestId, draft,
        message: "Local preview ready. Saving records an unapproved proposal only." };
      this.changed();
    } catch {
      if (this.isCurrent(ticket)) this.clear("Could not prepare this goal. Edit it and try again.");
    }
  }

  private isCurrent(ticket: NonNullable<WorkspaceDraft["ticket"]>): boolean {
    return this.active && this.ticket === ticket;
  }

  private clear(message: string): void {
    const requestId = this.ticket?.requestId ?? this.state.requestId;
    this.ticket = undefined;
    this.state = { kind: "idle", requestId, message };
    this.changed();
  }

  dispose(): void {
    this.active = false;
    this.ticket = undefined;
  }
}
