import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";
import { ProjectRetrieval } from "../../src/project-retrieval.js";
import { renderConversation } from "../../src/work-view.js";

suite("Historical file citation rendering", () => {
  test("displays captured original bytes, exact hashes and honest current-freshness limits", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "piarre-file-citation-render-"));
    const repository = new SqliteProjectRepository(path.join(directory, ".project.sqlite"));
    try {
      writeFileSync(path.join(directory, "policy.ts"), 'export const policy = "<45>";\n');
      let project = repository.open({ repositoryUri: pathToFileURL(directory).href, name: "Render fixture" });
      const index = new ProjectRetrieval({ projectId: project.projectId, root: directory });
      const captured = index.captureFile("policy.ts", project.revision, 1, 1); index.dispose();
      repository.dispatch({ commandId: "begin", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "begin-conversation", submitted: { requestId: "question", projectId: project.projectId, contextRevision: project.revision, originalStatement: "Where is policy declared?" }, sources: [captured] } });
      project = repository.read();
      repository.dispatch({ commandId: "reply", projectId: project.projectId, expectedProjectRevision: project.revision, action: { kind: "record-conversation-reply", requestId: "question", text: "The declaration is source-derived; deployment and rationale are unknown.", citations: [captured.reference], providerThreadId: "fixture-thread", providerTurnId: "fixture-turn" } });
      writeFileSync(path.join(directory, "policy.ts"), 'export const policy = "90";\n');
      const rendered = renderConversation(repository.read());
      assert.match(rendered, /Codex · Inferred/); assert.match(rendered, /exact historical bytes/); assert.match(rendered, /has not been revalidated/);
      assert.ok(rendered.includes("&lt;45&gt;")); assert.ok(!rendered.includes('policy = &quot;90&quot;'));
      assert.ok(captured.reference.kind === "file"); assert.ok(rendered.includes(captured.reference.contentHash)); assert.ok(rendered.includes(captured.reference.inventoryHash));
      assert.match(rendered, /Exact citation provenance/); assert.match(rendered, /Cited: file policy.ts/);
    } finally { repository.close(); rmSync(directory, { recursive: true, force: true }); }
  });
});
