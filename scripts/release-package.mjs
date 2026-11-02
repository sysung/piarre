import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function releasePackage({ directory, sourceSha, runUrl, gh = (args) => execFileSync("gh", args, { encoding: "utf8" }) }) {
  assert.match(sourceSha, /^[a-f0-9]{40}$/);
  assert.match(runUrl, /^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/\d+$/);
  const info = JSON.parse(readFileSync(path.join(directory, "build-info.json"), "utf8"));
  assert.equal(info.commit, sourceSha, "Package source does not match this workflow");
  assert.equal(info.dirty, false, "Cannot release a dirty build");
  assert.equal(info.extensionId, "sysung.piarre");
  assert.match(info.version, /^\d+\.\d+\.\d+$/);
  const packageName = `piarre-${info.version}.vsix`;
  const checksums = readFileSync(path.join(directory, "SHA256SUMS"), "utf8").trim().split("\n");
  assert.equal(checksums.length, 2, "Expected package and build-info checksums");
  const remaining = new Set([packageName, "build-info.json"]);
  for (const line of checksums) {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    assert.ok(match && remaining.delete(match[2]), "Unexpected or duplicate checksum entry");
    const actual = createHash("sha256").update(readFileSync(path.join(directory, match[2]))).digest("hex");
    assert.equal(actual, match[1], `Checksum mismatch for ${match[2]}`);
  }
  assert.equal(remaining.size, 0);

  const tag = `build-${sourceSha}`;
  let reference;
  try {
    reference = JSON.parse(gh(["api", `repos/{owner}/{repo}/git/ref/tags/${tag}`]));
  } catch (error) {
    if (error.status !== 1) throw error;
    reference = JSON.parse(gh(["api", "repos/{owner}/{repo}/git/refs", "--method", "POST", "-f", `ref=refs/tags/${tag}`, "-f", `sha=${sourceSha}`]));
  }
  assert.equal(reference.object?.type, "commit", "Build tag must directly identify a source commit");
  assert.equal(reference.object.sha, sourceSha, "Build tag points to another commit");
  let existing;
  try {
    existing = JSON.parse(gh(["release", "view", tag, "--json", "isDraft,targetCommitish"]));
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  if (existing) {
    assert.equal(existing.targetCommitish, sourceSha, "Existing release targets another commit");
    assert.equal(typeof existing.isDraft, "boolean");
    if (!existing.isDraft) return { tag, status: "already-published" };
  } else {
    gh(["release", "create", tag, "--draft", "--verify-tag", "--target", sourceSha,
      "--title", `Piarre ${info.version} · ${sourceSha.slice(0, 7)}`,
      "--notes", `Install the attached VSIX with Extensions: Install from VSIX... in VS Code.\n\nSource: ${sourceSha}\nValidated workflow: ${runUrl}\n\nThe VSIX keeps manifest version ${info.version}; the build tag identifies this exact source. This is not a Marketplace publication or proof of integrated product readiness.`]);
  }
  gh(["release", "upload", tag, ...[packageName, "build-info.json", "SHA256SUMS"].map((name) => path.join(directory, name)), "--clobber"]);
  gh(["release", "edit", tag, "--draft=false", "--latest=false"]);
  return { tag, status: "published" };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = releasePackage({ directory: process.argv[2] ?? "package", sourceSha: process.env.SOURCE_SHA, runUrl: process.env.RUN_URL });
  process.stdout.write(`${result.status}: ${result.tag}\n`);
}
