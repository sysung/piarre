import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers";
import { candidateLayout, candidateStatus, initializeCandidate, resetCandidate, stopCandidate } from "../scripts/candidate-profile.mjs";

function sandbox(t) { const root = realpathSync(mkdtempSync(path.join(tmpdir(), "piarre-profile-test-"))); t.after(() => rmSync(root, { recursive: true, force: true })); return root; }
test("candidate reset preserves stable bytes, source fixture, and independent exports", t => {
  const root = sandbox(t); const stable = path.join(root, "stable"); mkdirSync(stable); writeFileSync(path.join(stable, "context.sqlite"), "stable-context-bytes");
  const directory = path.join(root, "candidate"); const layout = initializeCandidate(directory);
  writeFileSync(path.join(layout.user, "candidate-state"), "candidate-context-bytes");
  writeFileSync(path.join(directory, "export.json"), "independent-export");
  assert.equal(candidateStatus(directory).kind, "stopped");
  resetCandidate(directory);
  assert.ok(!existsSync(layout.user)); assert.ok(!existsSync(layout.extensions));
  assert.equal(readFileSync(path.join(stable, "context.sqlite"), "utf8"), "stable-context-bytes");
  assert.equal(readFileSync(path.join(directory, "export.json"), "utf8"), "independent-export");
  resetCandidate(directory);
});
test("candidate lifecycle rejects unowned profiles, symlinks and source directories", t => {
  const root = sandbox(t); const unowned = path.join(root, "daily-profile"); mkdirSync(unowned);
  assert.throws(() => initializeCandidate(unowned), /Not an owned/);
  assert.throws(() => resetCandidate(unowned), /Not an owned/);
  const link = path.join(root, "alias"); symlinkSync(unowned, link);
  assert.throws(() => candidateLayout(link), /symlinks/);
  assert.throws(() => candidateLayout(process.cwd()), /outside the source/);
});
test("candidate stop targets its recorded main process and blocks reset while running", { skip: process.platform === "win32" }, async t => {
  const root = sandbox(t); const directory = path.join(root, "candidate"); const layout = initializeCandidate(directory);
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "--", "--user-data-dir", layout.user], { detached: true, stdio: "ignore" });
  t.after(() => { try { process.kill(-child.pid, "SIGKILL"); } catch { /* Already stopped. */ } });
  await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
  const identity = execFileSync("ps", ["-p", String(child.pid), "-o", "pgid=,lstart=,command="], { encoding: "utf8" }).trim();
  writeFileSync(layout.process, JSON.stringify({ pid: child.pid, identity }));
  assert.equal(candidateStatus(directory).kind, "running");
  assert.throws(() => resetCandidate(directory), /Stop the candidate/);
  await stopCandidate(directory);
  assert.equal(candidateStatus(directory).kind, "stopped");
  resetCandidate(directory);
});
test("cross-repository fixture is a real committed Git repository with an executable test", t => {
  const root = sandbox(t); const directory = path.join(root, "candidate");
  const script = new URL("../scripts/candidate-profile.mjs", import.meta.url);
  execFileSync(process.execPath, [script.pathname, "fixture", "--directory", directory], { stdio: "pipe" });
  const repository = path.join(directory, "fixture-repository");
  assert.match(execFileSync("git", ["-C", repository, "rev-parse", "HEAD"], { encoding: "utf8" }), /^[a-f0-9]{40}\n$/);
  execFileSync(process.execPath, ["--test"], { cwd: repository, stdio: "pipe" });
  resetCandidate(directory);
  assert.ok(existsSync(path.join(repository, "counter.mjs")));
});

test("main-only stop permits renderer shutdown while the previous group signal reproduces renderer termination", { skip: process.platform === "win32" }, async t => {
  const root = sandbox(t);
  const parentScript = path.join(root, "host-parent.mjs");
  const childScript = path.join(root, "renderer-child.mjs");
  writeFileSync(childScript, `import { writeFileSync } from "node:fs";
process.on("SIGTERM", () => { writeFileSync(process.argv[2], "renderer-received-SIGTERM"); process.exit(0); });
process.on("message", message => { if (message === "quit") process.exit(0); });
process.send("ready");\n`);
  writeFileSync(parentScript, `import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
let closing = false;
const child = spawn(process.execPath, [process.argv[2], process.argv[3]], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
child.on("message", message => { if (message === "ready") writeFileSync(process.argv[4], "ready"); });
child.on("exit", () => { if (closing) process.exit(0); });
process.on("SIGTERM", () => { closing = true; if (child.exitCode !== null) process.exit(0); else setTimeout(() => { if (child.connected) child.send("quit"); else process.exit(0); }, 100); });\n`);
  const waitFor = async predicate => {
    for (let attempt = 0; attempt < 100 && !predicate(); attempt++) await new Promise(resolve => setTimeout(resolve, 25));
    assert.ok(predicate(), "Owned subprocess condition did not converge");
  };
  const groupGone = pid => !execFileSync("ps", ["-axo", "pgid="], { encoding: "utf8" }).split(/\s+/).some(value => Number(value) === pid);
  for (const variant of ["previous-group-signal", "corrected-main-signal"]) {
    const layout = initializeCandidate(path.join(root, variant));
    const sentinel = path.join(layout.root, "renderer-killed.txt");
    const ready = path.join(layout.root, "ready.txt");
    const parent = spawn(process.execPath, [parentScript, childScript, sentinel, ready, "--user-data-dir", layout.user], { detached: true, stdio: "ignore" });
    t.after(() => { try { process.kill(parent.pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; } });
    await new Promise((resolve, reject) => { parent.once("spawn", resolve); parent.once("error", reject); });
    await waitFor(() => existsSync(ready));
    const identity = execFileSync("ps", ["-p", String(parent.pid), "-o", "pgid=,lstart=,command="], { encoding: "utf8" }).trim();
    writeFileSync(layout.process, JSON.stringify({ pid: parent.pid, identity }));
    assert.throws(() => resetCandidate(layout.root), /Stop the candidate/);
    if (variant === "previous-group-signal") {
      process.kill(-parent.pid, "SIGTERM");
      await waitFor(() => groupGone(parent.pid));
      assert.equal(readFileSync(sentinel, "utf8"), "renderer-received-SIGTERM", "Previous group-stop variant must reproduce the renderer-killed sentinel");
    } else {
      await stopCandidate(layout.root);
      assert.ok(groupGone(parent.pid), "Main and renderer must both exit before reset");
      assert.ok(!existsSync(sentinel), "Corrected stop must let renderer quit through parent IPC without SIGTERM");
    }
    resetCandidate(layout.root);
  }
});
