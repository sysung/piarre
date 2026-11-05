import { assignmentPrompt } from "./coordination-prompt.js";
import { assertSharedFilesCurrent } from "./file-context.js";
import type { SuppliedSource } from "../../../packages/core/src/supplied-source.js";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { CoordinationAction, CoordinationGroup, ProjectSnapshot } from "../../../packages/core/src/index.js";
import { assertCoordinationCurrent, type WorkerSpec } from "../../../packages/core/src/coordination.js";
import { inspectProject } from "../../../packages/core/src/inspection.js";
import { CodexConversationClient } from "./codex-conversation-client.js";
import type { SqliteProjectRepository } from "./sqlite-project-repository.js";

type Client = Pick<CodexConversationClient, "connect" | "respond" | "interrupt" | "dispose">;
type Prepare = { readonly fileSources?: readonly SuppliedSource[]; readonly ideaId?: string; readonly requestId: string; readonly parentTaskId: string; readonly purpose: string; readonly scope: string; readonly model: string; readonly workers: number; readonly durationMs: number; readonly maxTokens: number };
export class CoordinationController {
  private readonly clients = new Map<string, Client>();
  private disposed = false;
  constructor(private readonly repository: Pick<SqliteProjectRepository, "read" | "dispatch">,
    private readonly publish: (project: ProjectSnapshot) => void,
    private readonly createClient: () => Client = () => new CodexConversationClient(),
    private readonly canShare: (sources: readonly SuppliedSource[]) => boolean = () => true) {
    for (const group of repository.read().coordination.groups) for (const assignment of group.assignments) {
      if (assignment.state.kind === "active") this.record({ kind: "coordinate", operation: "finish", groupId: group.groupId,
        assignmentId: assignment.assignmentId, outcome: "unknown", observation: "Piarre restarted without terminal evidence. Remote completion and usage remain unknown. No request was retried.", sourceIndexes: [], observedAt: Date.now() });
    }
  }
  private record(action: CoordinationAction, commandId = randomUUID()): boolean {
    const snapshot = this.repository.read();
    const result = this.repository.dispatch({ commandId, projectId: snapshot.projectId, expectedProjectRevision: snapshot.revision, action });
    this.publish(this.repository.read());
    return result.kind === "applied";
  }
  captureIdea(input: { readonly requestId: string; readonly parentTaskId: string; readonly text: string; readonly returnPoint: string }): void {
    const existing = this.repository.read().coordination.ideas.find(idea => idea.ideaId === input.requestId);
    if (existing) {
      if (existing.parentTaskId !== input.parentTaskId || existing.text !== input.text || existing.returnPoint !== input.returnPoint) throw new Error("Conflicting idea request identity");
      return;
    }
    this.record({ kind: "coordinate", operation: "capture-idea", ideaId: input.requestId, parentTaskId: input.parentTaskId, text: input.text, returnPoint: input.returnPoint });
  }
  returnIdea(ideaId: string): void {
    this.record({ kind: "coordinate", operation: "return-idea", ideaId, observedAt: Date.now() });
  }
  prepare(input: Prepare): CoordinationGroup {
    const snapshot = this.repository.read();
    const existing = snapshot.coordination.groups.find(group => group.requestId === input.requestId);
    if (existing) {
      if (existing.ideaId !== (input.ideaId ?? null) || existing.parentTaskId !== input.parentTaskId || existing.durationMs !== input.durationMs || existing.maxTokens !== input.maxTokens || existing.assignments.length !== input.workers || existing.assignments.some(worker => worker.purpose !== input.purpose || worker.scope !== input.scope || worker.requestedModel !== input.model)) throw new Error("Conflicting assignment request identity");
      return existing;
    }
    if (!Number.isSafeInteger(input.workers) || input.workers < 1 || input.workers > 3) throw new Error("Bound fanout to 1–3 read-only workers");
    const recordSources = inspectProject(snapshot).recommendation.filter(entry => entry.text.length <= 10_000).slice(0, 10).map(({ reference, text }) => ({ reference, text }));
    const sources = [...recordSources, ...(input.fileSources ?? [])];
    if (!this.canShare(sources)) throw new Error("Source access, project trust or saved file state changed");
    assertSharedFilesCurrent(snapshot, sources);
    const groupId = randomUUID();
    const workers = Array.from({ length: input.workers }, (_, index) => ({ assignmentId: randomUUID(), role: index === 0 ? "investigation" : "review", purpose: input.purpose, scope: input.scope, requestedModel: input.model, provider: "codex-read-only", serviceTierForTurn: "default", permissions: "supplied-sources-only" } satisfies WorkerSpec));
    if (!this.record({ kind: "coordinate", operation: "prepare", groupId, ideaId: input.ideaId ?? null, requestId: input.requestId, parentTaskId: input.parentTaskId, sources, workers, durationMs: input.durationMs, maxTokens: input.maxTokens })) throw new Error("Assignment preparation was not saved");
    const group = this.repository.read().coordination.groups.find(group => group.groupId === groupId);
    if (!group) throw new Error("Saved assignment unavailable");
    return group;
  }
  steer(groupId: string, assignmentId: string, messageId: string, text: string): void {
    this.record({ kind: "coordinate", operation: "steer", groupId, assignmentId, messageId, text, observedAt: Date.now() });
  }
  compare(groupId: string, verdict: "agreement" | "disagreement" | "mixed", explanation: string): void {
    const group = this.repository.read().coordination.groups.find(group => group.groupId === groupId);
    if (!group) throw new Error("Unknown group");
    this.record({ kind: "coordinate", operation: "compare", groupId, verdict, explanation, assignmentIds: group.assignments.filter(worker => worker.state.kind === "terminal" && worker.state.outcome === "completed").map(worker => worker.assignmentId), observedAt: Date.now() });
  }
  reviewUnknown(groupId: string, assignmentId: string): void {
    this.record({ kind: "coordinate", operation: "review-unknown", groupId, assignmentId, observedAt: Date.now() });
  }
  async approveAndRun(groupId: string, preparedAtRevision: number, approvalId: string): Promise<void> {
    if (this.disposed) return;
    const prepared = this.repository.read().coordination.groups.find(group => group.groupId === groupId);
    if (!prepared) return;
    if (!this.canShare(prepared.sources)) throw new Error("Source access or project trust changed");
    assertSharedFilesCurrent(this.repository.read(), prepared.sources);
    if (!this.record({ kind: "coordinate", operation: "approve", groupId, preparedAtRevision, approvalId, observedAt: Date.now(), consent: "unknown-cost-and-shared-context" })) return;
    const group = this.repository.read().coordination.groups.find(group => group.groupId === groupId);
    if (!group) return;
    await Promise.allSettled(group.assignments.map(worker => this.run(group, worker.assignmentId)));
  }
  private async run(group: CoordinationGroup, assignmentId: string): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    let client: Client | undefined;
    const finish = (outcome: "completed" | "interrupted" | "failed" | "unknown", observation: string, sourceIndexes: readonly number[] = []) => {
      const worker = this.repository.read().coordination.groups.find(item => item.groupId === group.groupId)?.assignments.find(item => item.assignmentId === assignmentId);
      if (worker?.state.kind === "active") this.record({ kind: "coordinate", operation: "finish", groupId: group.groupId, assignmentId, outcome, observation, sourceIndexes, observedAt: Date.now() });
    };
    try {
      if (!this.record({ kind: "coordinate", operation: "start", groupId: group.groupId, assignmentId, observedAt: Date.now() })) return;
      const worker = group.assignments.find(item => item.assignmentId === assignmentId);
      if (!worker) throw new Error("Unknown assignment");
      client = this.createClient(); this.clients.set(assignmentId, client);
      const boundedClient = client;
      timer = setTimeout(() => {
        this.clients.delete(assignmentId);
        finish("unknown", "Hard local deadline reached. Provider termination and usage remain unconfirmed; no automatic retry.");
        boundedClient.dispose();
      }, group.durationMs);
      if ((await client.connect()).kind !== "ready") { finish("failed", "Provider requires login. No model turn was requested."); return; }
      if (this.clients.get(assignmentId) !== client || this.repository.read().schedulingPaused) { finish("unknown", "Scheduling paused or local connection ended before request; no automatic resumption."); return; }
      const snapshot = this.repository.read();
      assertCoordinationCurrent(snapshot, group);
      if (!this.canShare(group.sources)) throw new Error("Source access or project trust changed");
      assertSharedFilesCurrent(snapshot, group.sources);
      let metadata: { model: string | null; modelProvider: string | null } = { model: null, modelProvider: null };
      let serviceTier: string | null = null;
      const observe = () => {
        if (this.clients.get(assignmentId) === client) this.record({ kind: "coordinate", operation: "provider", groupId: group.groupId, assignmentId, model: metadata.model, provider: metadata.modelProvider, serviceTier, observedAt: Date.now() });
      };

      const response = await client.respond({ cwd: fileURLToPath(snapshot.repositoryUri), model: worker.requestedModel,
        serviceTierForTurn: worker.serviceTierForTurn,
        prompt: assignmentPrompt(group, worker),
        onTurnTerminal: value => {
          if (value.status === "failed") { finish("failed", "Provider reported failure for this exact assignment turn; usage unknown."); }
        },
        onThreadMetadata: value => { metadata = value; observe(); if (value.model !== null && value.model !== worker.requestedModel) throw new Error("Provider model differs from approved assignment"); },
        onServiceTier: value => { serviceTier = value; observe(); },
        onThreadStarted: threadId => {
          if (this.clients.get(assignmentId) !== client) throw new Error("Assignment disconnected before outbound turn");
          this.record({ kind: "coordinate", operation: "session", groupId: group.groupId, assignmentId, session: { kind: "thread", threadId }, observedAt: Date.now() });
          assertCoordinationCurrent(this.repository.read(), group);
          if (!this.canShare(group.sources)) throw new Error("Source access or project trust changed");
          assertSharedFilesCurrent(this.repository.read(), group.sources);
          if (this.repository.read().schedulingPaused) throw new Error("Assignment paused before outbound turn");
        },
        onTurnStarted: (threadId, turnId) => { if (this.clients.get(assignmentId) === client) this.record({ kind: "coordinate", operation: "session", groupId: group.groupId, assignmentId, session: { kind: "turn", threadId, turnId }, observedAt: Date.now() }); } });
      if (this.clients.get(assignmentId) !== client) return;
      const current = this.repository.read().coordination.groups.find(item => item.groupId === group.groupId)?.assignments.find(item => item.assignmentId === assignmentId);
      if (current?.state.kind !== "active" || current.state.session.kind !== "turn" || current.state.session.threadId !== response.threadId || current.state.session.turnId !== response.turnId) throw new Error("Uncorrelated worker response");
      if (response.status === "interrupted") { finish("interrupted", "Provider confirmed interruption for this assignment's exact thread and turn."); return; }
      const output = response.output;
      if (typeof output !== "object" || output === null || !("summary" in output) || !("sourceIndexes" in output) ||
        Object.keys(output).length !== 2 || typeof output.summary !== "string" || !output.summary.trim() || output.summary.length > 10_000 || !Array.isArray(output.sourceIndexes)) throw new Error("Invalid findings output");
      const indexes: number[] = [];
      for (const index of output.sourceIndexes) {
        if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0 || !group.sources[index]) throw new Error("Unavailable findings source");
        indexes.push(index);
      }
      finish("completed", output.summary, indexes);
    } catch {
      finish("unknown", "Provider failed, disconnected or returned invalid evidence. Completion and usage remain unknown. No retry or fallback was requested.");
    } finally {
      if (timer) clearTimeout(timer);
      this.clients.delete(assignmentId); client?.dispose();
    }
  }
  async stop(groupId: string, assignmentId: string): Promise<void> {
    const client = this.clients.get(assignmentId);
    if (!client) return;
    this.record({ kind: "coordinate", operation: "stop", groupId, assignmentId, observedAt: Date.now() });
    try { await client.interrupt(); } catch { this.disconnect(assignmentId); }
  }
  private disconnect(assignmentId: string): void {
    const client = this.clients.get(assignmentId); this.clients.delete(assignmentId);
    for (const group of this.repository.read().coordination.groups) {
      const worker = group.assignments.find(item => item.assignmentId === assignmentId);
      if (worker?.state.kind === "active") this.record({ kind: "coordinate", operation: "finish", groupId: group.groupId, assignmentId, outcome: "unknown", observation: "Disconnected without terminal evidence. Remote completion and usage unknown. No automatic retry.", sourceIndexes: [], observedAt: Date.now() });
    }
    client?.dispose();
  }
  async stopAll(): Promise<void> {
    const pending = this.repository.read().coordination.groups.flatMap(group => group.assignments.filter(worker => worker.state.kind === "active").map(worker => this.stop(group.groupId, worker.assignmentId)));
    await Promise.allSettled(pending);
  }
  dispose(): void { this.disposed = true; for (const id of [...this.clients.keys()]) this.disconnect(id); }
}
