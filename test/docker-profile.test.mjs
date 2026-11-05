import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { vscodeVersion } from "../config/vscode-version.mjs";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "piarre-docker-test-"));
  const workspace = path.join(root, "Steven's folder with spaces");
  mkdirSync(workspace);
  const log = path.join(root, "calls.jsonl");
  const config = path.join(root, "config"); mkdirSync(config);
  writeFileSync(path.join(config, "config.json"), JSON.stringify({ credsStore: "must-not-run", auths: { private: "must-not-copy" } }));
  writeFileSync(path.join(root, "docker"), `#!${process.execPath}
const fs=require('node:fs');const args=process.argv.slice(2);
if(args[0]==='context'){console.log('unix:///tmp/fixture-docker.sock');process.exit(0)}
const config=JSON.parse(fs.readFileSync(process.env.DOCKER_CONFIG+'/config.json','utf8'));
fs.appendFileSync(process.env.PIARRE_DOCKER_TEST_LOG,JSON.stringify({args,workspace:process.env.PIARRE_WORKSPACE,endpoint:process.env.DOCKER_HOST,config})+'\\n');
process.exit(process.env.PIARRE_DOCKER_TEST_FAIL==='1'?7:0);
`, { mode: 0o755 });
  const run = (args, extra = {}) => spawnSync(process.execPath, ["scripts/docker-piarre.mjs", ...args], {
    encoding: "utf8", env: { ...process.env, PATH: `${root}${path.delimiter}${process.env.PATH ?? ""}`, DOCKER_CONFIG: config,
      PIARRE_DOCKER_TEST_LOG: log, ...extra },
  });
  return { root, workspace, run, calls: () => readFileSync(log, "utf8").trim().split("\n").map(line => JSON.parse(line)) };
}

test("workspace paths retain spaces and apostrophes, while registry credentials stay out of the launcher", () => {
  const f = fixture(); try {
    const result = f.run(["up", f.workspace]); assert.equal(result.status, 0, result.stderr);
    const calls = f.calls(); assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].args, ["compose", "build", "--build-arg", `VSCODE_VERSION=${vscodeVersion}`]);
    assert.deepEqual(calls[1].args, ["compose", "up", "-d", "--wait"]);
    assert.ok(calls.every(call => call.workspace === f.workspace && call.endpoint === "unix:///tmp/fixture-docker.sock"));
    assert.ok(calls.every(call => !JSON.stringify(call.config).includes("must-not")));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
test("missing mount sources are rejected before Docker starts", () => {
  const f = fixture(); try { const result = f.run(["up", path.join(f.root, "absent")]); assert.equal(result.status, 1); assert.match(result.stderr, /existing absolute workspace/); }
  finally { rmSync(f.root, { recursive: true, force: true }); }
});
test("a failed image build never starts the desktop", () => {
  const f = fixture(); try { assert.equal(f.run(["up", f.workspace], { PIARRE_DOCKER_TEST_FAIL: "1" }).status, 1); assert.equal(f.calls().length, 1); }
  finally { rmSync(f.root, { recursive: true, force: true }); }
});
test("stopping preserves volumes", () => {
  const f = fixture(); try { assert.equal(f.run(["down"]).status, 0); assert.deepEqual(f.calls()[0].args, ["compose", "down"]); }
  finally { rmSync(f.root, { recursive: true, force: true }); }
});
