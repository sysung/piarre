import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runPublicationHelper, publicationParents } from "../../src/scoped-publication.js";
import { CandidateWorkspace } from "../../src/candidate-workspace.js";
import { parsePatchProposal } from "../../../../packages/core/src/execution-patch.js";

suite("Responsive scoped publication", function () {
  this.timeout(30_000);
  test("a control callback runs while a deliberately delayed native publication is pending", async () => {
    const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "piarre-publication-control-")));
    const source = path.join(directory, "source"); const control = path.join(directory, "control");
    mkdirSync(source); mkdirSync(control, { mode: 0o700 }); writeFileSync(path.join(source, "file.txt"), "before");
    const executable = ["/usr/bin/python3", "/opt/homebrew/bin/python3", "/usr/local/bin/python3"].find(existsSync); assert.ok(executable);
    const original = path.resolve(__dirname, "../../native/scoped-publication.py");
    const helper = path.join(directory, "delayed-publication.py");
    writeFileSync(helper, `import time\ntime.sleep(0.25)\n${readFileSync(original, "utf8")}`);
    try {
      let settled = false;
      const operation = runPublicationHelper({ executable, helper, input: { root: source, control, key: "a".repeat(64), commandId: "delayed", parents: publicationParents(source, "file.txt"), change: { relativePath: "file.txt", before: "before", after: "after", beforeMode: 0o644, afterMode: 0o644 } } });
      void operation.then(() => { settled = true; }, () => { settled = true; });
      await new Promise<void>(resolve => setTimeout(resolve, 25));
      assert.equal(settled, false, "Host control callback must run before the native receipt");
      assert.equal(readFileSync(path.join(source, "file.txt"), "utf8"), "before");
      const receipt = await operation;
      assert.ok(typeof receipt === "object" && receipt !== null && "kind" in receipt && receipt.kind === "complete");
      assert.equal(readFileSync(path.join(source, "file.txt"), "utf8"), "after");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  test("candidate journal publication yields before completion and preserves its durable receipt", async () => {
    const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "piarre-journal-control-")));
    const source = path.join(directory, "source"); const storage = path.join(directory, "storage"); mkdirSync(source); mkdirSync(storage);
    writeFileSync(path.join(source, "a.txt"), "before"); writeFileSync(path.join(source, "b.txt"), "before");
    try {
      const candidate = CandidateWorkspace.capture({ repositoryRoot: source, storageDirectory: storage, relativePaths: ["a.txt", "b.txt"] });
      const proposal = parsePatchProposal({ files: candidate.files.map(file => file.baseline), value: { summary: "responsive fixture", operations: candidate.files.map(file => ({ fileId: file.baseline.fileId, content: "after" })) } });
      let settled = false;
      const operation = candidate.apply({ commandId: "responsive", proposal });
      void operation.then(() => { settled = true; }, () => { settled = true; });
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.equal(settled, false);
      assert.equal((await operation).kind, "changed");
      const restarted = CandidateWorkspace.reopen({ controlDirectory: candidate.controlDirectory, storageDirectory: storage, expectedCaptureHash: candidate.captureHash });
      assert.equal((await restarted.reconcile({ commandId: "responsive" })).kind, "current");
      assert.equal(restarted.manifestHash(), candidate.manifestHash());
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
