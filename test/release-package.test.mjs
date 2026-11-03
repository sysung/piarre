import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { releasePackage } from "../scripts/release-package.mjs";

const sourceSha = "a".repeat(40);
const runUrl = "https://github.com/sysung/piarre/actions/runs/123";

function fixture(t, overrides = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "piarre-release-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const files = {
    "piarre-0.0.1.vsix": Buffer.from("tested package"),
    "build-info.json": Buffer.from(JSON.stringify({ commit: sourceSha, dirty: false, extensionId: "sysung.piarre", version: "0.0.1", ...overrides })),
  };
  const sums = [];
  for (const [name, bytes] of Object.entries(files)) {
    writeFileSync(path.join(directory, name), bytes);
    sums.push(`${createHash("sha256").update(bytes).digest("hex")}  ${name}`);
  }
  writeFileSync(path.join(directory, "SHA256SUMS"), `${sums.join("\n")}\n`);
  return directory;
}

function forge({ existing, failUpload = false, tagSha = existing ? sourceSha : undefined } = {}) {
  const calls = [];
  let release = existing;
  return {
    calls,
    gh(args) {
      calls.push(args);
      if (args[0] === "api") {
        if (args.includes("POST")) tagSha = args.find((arg) => arg.startsWith("sha=")).slice(4);
        if (!tagSha) throw Object.assign(new Error("tag not found"), { status: 1 });
        return JSON.stringify({ object: { type: "commit", sha: tagSha } });
      }
      if (args[1] === "view") {
        if (!release) throw Object.assign(new Error("release not found"), { status: 1 });
        return JSON.stringify(release);
      }
      if (args[1] === "create") release = { isDraft: true, targetCommitish: sourceSha };
      if (args[1] === "upload" && failUpload) {
        failUpload = false;
        throw new Error("interrupted upload");
      }
      if (args[1] === "edit") release.isDraft = false;
      return "";
    },
  };
}

test("publish the verified package through a draft without changing the source version", (t) => {
  const directory = fixture(t);
  const remote = forge();
  assert.equal(releasePackage({ directory, sourceSha, runUrl, gh: remote.gh }).status, "published");
  const releaseCalls = remote.calls.filter((args) => args[0] === "release");
  assert.deepEqual(releaseCalls.map((args) => args[1]), ["view", "create", "upload", "edit"]);
  assert.ok(releaseCalls[1].includes(sourceSha));
  assert.ok(releaseCalls[1].includes("--verify-tag"));
  assert.ok(releaseCalls[2].includes(path.join(directory, "piarre-0.0.1.vsix")));
  assert.ok(releaseCalls[3].includes("--latest=false"));
});

test("retry an interrupted upload, then leave a published release untouched", (t) => {
  const directory = fixture(t);
  const remote = forge({ failUpload: true });
  const release = () => releasePackage({ directory, sourceSha, runUrl, gh: remote.gh });
  assert.throws(release, /interrupted upload/);
  assert.equal(release().status, "published");
  assert.equal(release().status, "already-published");
  assert.deepEqual(remote.calls.filter((args) => args[0] === "release").map((args) => args[1]), ["view", "create", "upload", "view", "upload", "edit", "view"]);
});

test("do not mutate a release belonging to another source commit", (t) => {
  const remote = forge({ existing: { isDraft: true, targetCommitish: "b".repeat(40) } });
  assert.throws(() => releasePackage({ directory: fixture(t), sourceSha, runUrl, gh: remote.gh }), /another commit/);
  assert.deepEqual(remote.calls.filter((args) => args[0] === "release").map((args) => args[1]), ["view"]);
});

test("reject a pre-existing build tag pointing elsewhere even if release metadata claims the right commit", (t) => {
  const remote = forge({ existing: { isDraft: true, targetCommitish: sourceSha }, tagSha: "b".repeat(40) });
  assert.throws(() => releasePackage({ directory: fixture(t), sourceSha, runUrl, gh: remote.gh }), /Build tag points to another commit/);
  assert.equal(remote.calls.length, 1);
  assert.equal(remote.calls[0][0], "api");
});

test("reject dirty or mismatched build metadata before contacting GitHub", (t) => {
  for (const overrides of [{ dirty: true }, { commit: "b".repeat(40) }]) {
    assert.throws(() => releasePackage({ directory: fixture(t, overrides), sourceSha, runUrl, gh: () => assert.fail("unexpected GitHub call") }));
  }
});

test("reject corrupt packages and unexpected checksum paths before contacting GitHub", (t) => {
  const directory = fixture(t);
  writeFileSync(path.join(directory, "piarre-0.0.1.vsix"), "corrupt");
  const release = () => releasePackage({ directory, sourceSha, runUrl, gh: () => assert.fail("unexpected GitHub call") });
  assert.throws(release, /Checksum mismatch/);
  writeFileSync(path.join(directory, "SHA256SUMS"), `${"a".repeat(64)}  ../outside\n${"b".repeat(64)}  build-info.json\n`);
  assert.throws(release, /Unexpected or duplicate/);
});
