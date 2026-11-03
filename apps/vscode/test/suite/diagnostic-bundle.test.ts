import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDiagnosticBundle, DiagnosticBundleStore, redactDiagnosticText, type DiagnosticInput } from "../../src/diagnostic-bundle.js";
import { SqliteProjectRepository } from "../../src/sqlite-project-repository.js";

suite("Diagnostic bundles", () => {
  const roots: string[] = [];
  const temporary = (): string => { const root = realpathSync(mkdtempSync(path.join(tmpdir(), "piarre-diagnostics-"))); roots.push(root); return root; };
  teardown(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
  function input(): DiagnosticInput {
    const repository = new SqliteProjectRepository(path.join(temporary(), "project.sqlite"));
    repository.open({ repositoryUri: "file:///private/customer-repository", name: "arbitrary-secret-pear-tree" });
    const diagnostic = repository.readDiagnosticSnapshot(); repository.close();
    return { ...diagnostic, extensionId: "sysung.piarre-candidate", extensionVersion: "0.0.1", vscodeVersion: "1.144.0",
      repository: { commit: "a".repeat(40), dirty: true }, providers: [{ role: "coding", provider: "provider-private-name", model: "secret-model-identifier", apiKey: "arbitrary-secret-pear-tree" }], detail: "metadata", retentionDays: 1 };
  }
  test("metadata excludes arbitrary secrets, paths and configuration strings without relying on regex", () => {
    const source = input();
    const bundle = createDiagnosticBundle(source);
    for (const secret of ["arbitrary-secret-pear-tree", "/private/customer-repository", "provider-private-name", "secret-model-identifier", "apiKey"]) assert.ok(!bundle.includes(secret), secret);
    assert.match(bundle, /"projectRevision": 1/);
    assert.match(bundle, /"revision": 1,\s+"kind": "project-created"/);
    assert.match(bundle, /"id": "sysung.piarre-candidate"/);
    assert.ok(bundle.includes("user statements, prompts, command arguments, output, paths, memory text, configuration strings"));
  });
  test("content mode redacts actual token, credential key, auth, assignment, JWT and private key bytes", () => {
    const source = input();
    const token = "sk-proj-this-is-a-real-shaped-secret-123456789";
    const bundle = createDiagnosticBundle({ ...source, detail: "reviewable-content", providers: { apiKey: "arbitrary-secret-pear-tree", nested: [{ password: "other-unpatterned-secret" }], text: `${token} Bearer auth-value-123 password=hidden123 eyJhbGciOiJub25lIn0.e30.signature` } });
    for (const secret of [token, "other-unpatterned-secret", "auth-value-123", "hidden123", "eyJhbGciOiJub25lIn0.e30.signature"]) assert.ok(!bundle.includes(secret), secret);
    assert.ok(bundle.includes("REDACTED"));
    assert.equal(redactDiagnosticText("-----BEGIN PRIVATE KEY-----\nverysecret\n-----END PRIVATE KEY-----"), "[REDACTED PRIVATE KEY]");
    assert.ok(!redactDiagnosticText("https://user:pass@example.com?token=hidden").includes("hidden"));
  });
  test("collection rejects mismatched revisions, credential-bearing recording links and oversized content", () => {
    const source = input();
    assert.throws(() => createDiagnosticBundle({ ...source, events: [] }), /revision disagree/);
    assert.throws(() => createDiagnosticBundle({ ...source, recordingLink: "https://example.com/recording?token=secret" }), /recording link/);
    assert.throws(() => createDiagnosticBundle({ ...source, detail: "reviewable-content", providers: "x".repeat(2 * 1024 * 1024) }), /exceeds 2 MiB/);
    const bundle = createDiagnosticBundle({ ...source, recordingLink: "https://example.com/recording/123" });
    assert.match(bundle, /"capturedByPiarre": false/);
  });
  test("export readback, local expiration and deletion preserve independent exports and stable context", () => {
    const root = temporary();
    const stable = path.join(root, "stable-context.json"); writeFileSync(stable, "stable-context-preserved");
    const store = new DiagnosticBundleStore(path.join(root, "candidate"));
    const content = createDiagnosticBundle(input());
    const name = store.save(content);
    assert.equal(statSync(store.path(name)).mode & 0o777, 0o600);
    const exported = path.join(root, "export.json");
    store.export(name, exported);
    assert.equal(readFileSync(exported, "utf8"), content);
    assert.throws(() => { store.export(name, exported); }, /EEXIST/);
    assert.equal(store.expire(Date.now() + 2 * 86_400_000), 1);
    assert.ok(!existsSync(store.path(name)));
    assert.equal(readFileSync(exported, "utf8"), content);
    assert.equal(readFileSync(stable, "utf8"), "stable-context-preserved");
    const next = store.save(content); store.delete(next); store.delete(next);
    assert.deepEqual(store.list(), []);
  });
  test("bundle store rejects traversal and symbolic links without deleting their targets", () => {
    const root = temporary(); const store = new DiagnosticBundleStore(root);
    assert.throws(() => { store.delete("../stable-context.json"); }, /Invalid diagnostic/);
    const stable = path.join(root, "stable.json"); writeFileSync(stable, "preserved");
    const name = "bundle-00000000-0000-0000-0000-000000000000.json";
    symlinkSync(stable, path.join(root, "diagnostics", name));
    assert.throws(() => store.read(name), /regular file/);
    assert.throws(() => { store.delete(name); }, /regular file/);
    assert.equal(readFileSync(stable, "utf8"), "preserved");
  });
});
