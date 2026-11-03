import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { renderCoordination } from "../../src/coordination-view.js";
import { ProjectRetrieval } from "../../src/project-retrieval.js";
import { assertSharedFilesCurrent } from "../../src/file-context.js";
import { parseSuppliedSources, type SuppliedSource } from "../../../../packages/core/src/supplied-source.js";
import { CoordinationController } from "../../src/coordination-controller.js";
import { ConversationController } from "../../src/conversation-controller.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { GoalInterpreter } from "../../src/goal-interpreter.js";
import type { CodexConversationClient } from "../../src/codex-conversation-client.js";

type Client = Pick<CodexConversationClient, "connect" | "respond" | "interrupt" | "dispose">;
class Fixture implements Client {
  requests: Parameters<Client["respond"]>[0][] = [];
  beforeOutbound: () => void = () => undefined;
  connect(): ReturnType<Client["connect"]> { return Promise.resolve({ kind: "ready", authType: "unknown" }); }
  respond(input: Parameters<Client["respond"]>[0]): ReturnType<Client["respond"]> {
    this.requests.push(input); this.beforeOutbound();
    input.onThreadStarted?.("fixture-thread"); input.onTurnStarted?.("fixture-thread", "fixture-turn");
    const parsed: unknown = JSON.parse(input.prompt);
    assert.ok(typeof parsed === "object" && parsed !== null && "sources" in parsed && Array.isArray(parsed.sources));
    return Promise.resolve({ threadId: "fixture-thread", turnId: "fixture-turn", status: "completed", output: { summary: "Static declaration only; rationale and deployment unavailable.", sourceIndexes: [parsed.sources.length - 1] } });
  }
  interrupt(): Promise<void> { return Promise.resolve(); }
  dispose(): void { /* No process is owned by this fixture. */ }
}
suite("Frozen file sharing and citations", () => {
  let root: string; let db: SqliteProjectRepository; let index: ProjectRetrieval; let taskId: string; let dbFile: string;
  const capture = () => index.captureFile("refund.ts", db.read().revision, 1, 2);
  setup(async () => {
    root = mkdtempSync(path.join(tmpdir(), "piarre-file-context-")); dbFile = path.join(root, ".project.sqlite");
    writeFileSync(path.join(root, "refund.ts"), "export const days = 45;\n// declaration only\n");
    db = new SqliteProjectRepository(dbFile); const project = db.open({ repositoryUri: pathToFileURL(root).href, name: "source fixture" });
    const draft = await new GoalInterpreter().propose("Keep the refund window at 45 days");
    db.dispatch({ commandId: "parent", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "propose-tasks", draft } });
    taskId = db.read().tasks[0]?.taskId ?? ""; index = new ProjectRetrieval({ projectId: project.projectId, root });
  });
  teardown(() => { index.dispose(); db.close(); rmSync(root, { recursive: true, force: true }); for (const suffix of ["", "-wal", "-shm"]) rmSync(dbFile + suffix, { force: true }); });
  const prepare = (controller: CoordinationController, sources = [capture()]) => controller.prepare({ requestId: "review-files", parentTaskId: taskId, purpose: "Locate declaration", scope: "Selected source only", model: "fixture", workers: 1, durationMs: 5000, maxTokens: 100, fileSources: sources });
  test("hidden journal and canonical dispatch churn preserve frozen files through outbound and completion", async () => {
    const source = capture();
    writeFileSync(path.join(root, ".project.sqlite-journal"), "excluded journal");
    rmSync(path.join(root, ".project.sqlite-journal"));
    const project = db.read();
    assert.equal(db.dispatch({ commandId: "sqlite-churn", projectId: project.projectId, expectedProjectRevision: project.revision,
      action: { kind: "set-explanation-preference", preference: "brief" } }).kind, "applied");
    assertSharedFilesCurrent(db.read(), [source]);
    const client = new Fixture(); const controller = new CoordinationController(db, () => undefined, () => client);
    const group = prepare(controller, [source]);
    controller.steer(group.groupId, group.assignments[0]?.assignmentId ?? "", "frozen-steer", "Keep original bytes");
    const reviewed = db.read().coordination.groups[0]; assert.ok(reviewed);
    await controller.approveAndRun(group.groupId, reviewed.preparedAtRevision, "hidden-journal-approval");
    assert.equal(client.requests.length, 1);
    const state = db.read().coordination.groups[0]?.assignments[0]?.state;
    assert.ok(state?.kind === "terminal"); assert.equal(state.outcome, "completed");
    assert.deepEqual(state.deliveredMessageIds, ["frozen-steer"]);
    assert.ok(renderCoordination(db.read()).includes("Supplied source freshness: unknown"));
    writeFileSync(path.join(root, "refund.ts"), "changed after completed finding\n");
    const html = renderCoordination(db.read());
    assert.ok(html.includes("Supplied source freshness: unknown"));
    assert.ok(html.includes(source.text)); assert.equal(state.outcome, "completed");
    assert.throws(() => { assertSharedFilesCurrent(db.read(), [source]); });
    controller.dispose();
  });
  test("exact bytes survive strict parsing; edits and tampering invalidate but preserve historical bytes", () => {
    const source = capture(); assert.deepEqual(parseSuppliedSources([source]), [source]); assertSharedFilesCurrent(db.read(), [source]);
    assert.throws(() => { assertSharedFilesCurrent(db.read(), [{ ...source, text: "invented" }]); });
    writeFileSync(path.join(root, "refund.ts"), "export const days = 60;\n// declaration only\n");
    assert.throws(() => { assertSharedFilesCurrent(db.read(), [source]); }); assert.match(source.text, /45/);
  });
  test("selected excerpts retain original CRLF bytes rather than normalizing their evidence", () => {
    writeFileSync(path.join(root, "refund.ts"), "export const days = 45;\r\n// original newline\r\n");
    assert.equal(capture().text, "export const days = 45;\r\n// original newline\r\n");
  });
  test("file permission, directory permission and new member invalidate context", () => {
    let source = capture(); chmodSync(path.join(root, "refund.ts"), 0o600); assert.throws(() => { assertSharedFilesCurrent(db.read(), [source]); });
    source = capture(); chmodSync(root, 0o755); assert.throws(() => { assertSharedFilesCurrent(db.read(), [source]); });
    source = capture(); writeFileSync(path.join(root, "new-rule.md"), "A new constraint"); assert.throws(() => { assertSharedFilesCurrent(db.read(), [source]); });
  });
  test("hidden/secret/symlink/outside paths and oversized source sets are denied", () => {
    writeFileSync(path.join(root, "secret-config.ts"), "secret"); writeFileSync(path.join(root, ".env"), "secret"); symlinkSync(path.join(root, "refund.ts"), path.join(root, "alias.ts"));
    for (const file of ["secret-config.ts", ".env", "alias.ts", "../refund.ts"]) assert.throws(() => index.captureFile(file, 1));
    assert.throws(() => index.captureFile("refund.ts", 1, 1, 201)); assert.throws(() => parseSuppliedSources(Array.from({ length: 21 }, capture)));
    const source = capture(); assert.throws(() => parseSuppliedSources([{ ...source, reference: { ...source.reference, injected: true } }]));
  });
  test("tracked diff preserves staged edits, HEAD identity and exact bytes; changed base invalidates", () => {
    const git = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
    git(["init", "--quiet"]); git(["add", "refund.ts"]); git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "baseline"]);
    writeFileSync(path.join(root, "refund.ts"), "export const days = 60;\n// declaration only\n"); git(["add", "refund.ts"]);
    const source = index.captureDiff("refund.ts", db.read().revision); assert.match(source.text, /-export const days = 45/); assert.match(source.text, /\+export const days = 60/);
    assert.deepEqual(parseSuppliedSources([source]), [source]); assertSharedFilesCurrent(db.read(), [source]);
    execFileSync("git", ["apply", "--reverse", "--check", "-"], { cwd: root, input: source.text + "\n", stdio: ["pipe", "pipe", "pipe"] });
    git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "new base"]); assert.throws(() => { assertSharedFilesCurrent(db.read(), [source]); });
  });
  test("coordination shares chosen bytes and SQLite replays immutable source identity", async () => {
    const client = new Fixture(); const controller = new CoordinationController(db, () => undefined, () => client); const source = capture(); const group = prepare(controller, [source]);
    await controller.approveAndRun(group.groupId, group.preparedAtRevision, "fixture-native-approval"); assert.equal(client.requests.length, 1);
    assert.ok(client.requests[0]?.prompt.includes(source.text.replaceAll("\n", "\\n"))); assert.equal(db.read().coordination.groups[0]?.assignments[0]?.state.kind, "terminal");
    controller.dispose(); db.close(); db = new SqliteProjectRepository(dbFile); db.open({ repositoryUri: pathToFileURL(root).href, name: "source fixture" }); assert.deepEqual(db.read().coordination.groups[0]?.sources.at(-1), source);
  });
  test("permission change after review prevents a provider request", async () => {
    const client = new Fixture(); const controller = new CoordinationController(db, () => undefined, () => client); const group = prepare(controller);
    chmodSync(path.join(root, "refund.ts"), 0o600); await assert.rejects(controller.approveAndRun(group.groupId, group.preparedAtRevision, "fixture-review")); assert.equal(client.requests.length, 0); controller.dispose();
  });
  test("new canonical knowledge blocks approval despite an unchanged selected hit", async () => {
    const client = new Fixture(); const controller = new CoordinationController(db, () => undefined, () => client); const group = prepare(controller); const project = db.read();
    db.dispatch({ commandId: "new-rule", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "observe-knowledge", topic: "new rule", category: "business", affectedTaskIds: [], submitted: { requestId: "new-rule", projectId: project.projectId, contextRevision: project.revision, originalStatement: "Preserve audit records." } } });
    await assert.rejects(controller.approveAndRun(group.groupId, group.preparedAtRevision, "fixture-review"), /source collection changed/); assert.equal(db.read().coordination.groups[0]?.approval.kind, "unapproved"); assert.equal(client.requests.length, 0); controller.dispose();
  });
  test("conversation citations keep exact historical file bytes after correction and SQLite replay", async () => {
    const client = new Fixture(); const conversation = new ConversationController(db, () => undefined, () => client); await conversation.connect(); const source = capture(); await conversation.send("Where is the declaration?", [source], db.read().revision);
    const turn = db.read().conversation[0]; assert.ok(turn?.kind === "answered"); assert.deepEqual(turn.citations, [source.reference]); assert.deepEqual(turn.sources.at(-1), source);
    writeFileSync(path.join(root, "refund.ts"), "export const days = 90;\n"); conversation.dispose(); db.close(); db = new SqliteProjectRepository(dbFile); db.open({ repositoryUri: pathToFileURL(root).href, name: "source fixture" }); assert.deepEqual(db.read().conversation[0]?.sources.at(-1), source);
  });
  test("lost sharing permission blocks pre-turn reuse and preserves an unknown observation", async () => {
    const client = new Fixture(); let allowed = true;
    client.beforeOutbound = () => { allowed = false; };
    const conversation = new ConversationController(db, () => undefined, () => client, () => allowed);
    await conversation.connect(); await conversation.send("Locate", [capture()]);
    assert.equal(db.read().conversation[0]?.kind, "unknown"); conversation.dispose();
  });
  test("legacy record-only histories retain their prior parsing while new outbound contexts enforce byte budgets", () => {
    const project = db.read();
    const legacy: readonly SuppliedSource[] = [{ reference: { kind: "task", projectId: project.projectId, recordId: taskId, revision: project.revision }, text: "中文".repeat(9000) }];
    assert.equal(parseSuppliedSources(legacy)[0]?.text, legacy[0]?.text);
    assert.throws(() => { assertSharedFilesCurrent(project, legacy); }, /UTF-8/);
    const source = capture();
    assert.throws(() => { assertSharedFilesCurrent(project, [{ ...source, text: "中文".repeat(2000) }]); }, /UTF-8/);
  });
  test("thread-time mutation blocks the outbound turn and records unknown", async () => {
    const client = new Fixture(); client.beforeOutbound = () => { writeFileSync(path.join(root, "refund.ts"), "changed before turn\n"); }; const conversation = new ConversationController(db, () => undefined, () => client);
    await conversation.connect(); await conversation.send("Locate", [capture()]); assert.equal(db.read().conversation[0]?.kind, "unknown"); conversation.dispose();
  });
});
