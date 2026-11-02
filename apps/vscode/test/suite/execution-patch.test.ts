import assert from "node:assert/strict";
import { parsePatchProposal, validateFileManifest, type FileBaseline } from "../../../../packages/core/src/execution-patch.js";

suite("Bounded coding patch proposals", () => {
  const files: readonly FileBaseline[] = [
    { kind: "existing", fileId: "opaque-1", relativePath: "src/refunds.ts", sha256: "a".repeat(64), bytes: 100 },
    { kind: "absent", fileId: "opaque-2", relativePath: "test/refunds.test.ts" },
  ];
  test("model file IDs resolve only to the approved immutable baseline", () => {
    const parsed = parsePatchProposal({ files, value: { summary: "Raise the refund window", operations: [
      { fileId: "opaque-1", content: "export const days = 45;" }, { fileId: "opaque-2", content: "test('refunds', () => {});" },
    ] } });
    assert.equal(parsed.kind, "change");
    assert.deepEqual(parsed.operations.map(operation => operation.baseline), files);
    assert.equal(parsed.operations[0].kind, "replace"); assert.equal(parsed.operations[1]?.kind, "create");
  });
  test("empty output is explicitly no-change rather than a verified successful task", () => {
    assert.deepEqual(parsePatchProposal({ files, value: { summary: "No patch proposed", operations: [] } }),
      { kind: "no-change", summary: "No patch proposed", operations: [] });
  });
  test("unknown files, paths, hashes and authority cannot be supplied by the model", () => {
    for (const operation of [
      { fileId: "unknown", content: "attack" }, { fileId: "opaque-1", content: "attack", path: "/outside" },
      { fileId: "opaque-1", content: "attack", sha256: "forged" }, { fileId: "opaque-2", content: null },
    ]) assert.throws(() => parsePatchProposal({ files, value: { summary: "Attack", operations: [operation] } }));
    assert.throws(() => parsePatchProposal({ files, value: { summary: "Approved", operations: [], approved: true } }));
    assert.throws(() => parsePatchProposal({ files, value: { summary: "Duplicates", operations: [{ fileId: "opaque-1", content: "one" }, { fileId: "opaque-1", content: "two" }] } }));
  });
  test("manifest rejects escapes, reserved storage, duplicate identities and excessive bounds", () => {
    for (const relativePath of ["../escape", "/outside", "C:\\outside", "src/../escape", ".git/config", ".piarre/state", "src//file", "src/./file"]) {
      assert.throws(() => { validateFileManifest([{ kind: "absent", fileId: "file", relativePath }]); });
    }
    const first = files[0]; assert.ok(first);
    assert.throws(() => { validateFileManifest([...files, first]); });
    assert.throws(() => parsePatchProposal({ files, value: { summary: "Oversize", operations: [{ fileId: "opaque-1", content: "a".repeat(100_001) }] } }));
  });
});
