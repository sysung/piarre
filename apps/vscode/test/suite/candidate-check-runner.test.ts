import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CandidateCheckRunner, readCheckReceipt, inspectCheckControl, type CheckProcessIdentity } from "../../src/candidate-check-runner.js";

const node = process.env.PIARRE_TEST_NODE ?? process.execPath;
suite("Contained candidate checks", () => {
  let directory: string;
  let root: string;
  let control: string;
  let runner: CandidateCheckRunner;
  setup(() => {
    directory = mkdtempSync(path.join(tmpdir(), "piarre-check-test-"));
    root = path.join(directory, "candidate"); control = path.join(directory, "control");
    mkdirSync(root); mkdirSync(control);
    runner = new CandidateCheckRunner({ probeExecutable: node });
  });
  teardown(async () => {
    const stopped = await runner.interrupt();
    assert.notEqual(stopped.kind, "unknown", "Do not remove a workspace while its writer is unknown");
    rmSync(directory, { recursive: true, force: true });
  });
  function request(script: string, extras: { deadlineAt?: number; onStarted?: (identity: CheckProcessIdentity) => void } = {}) {
    return runner.run({ root, controlDirectory: control, argv: [node, "-e", script], deadlineAt: Date.now() + 5_000, nonce: "check-test", ...extras });
  }
  async function supported(context: Mocha.Context): Promise<void> {
    const capability = await runner.capability();
    if (process.platform !== "darwin") { assert.equal(capability.kind, "unsupported"); context.skip(); }
    assert.equal(capability.kind, "supported", "macOS checks require an observed passing containment probe");
  }

  test("capability observes containment and discloses its actual read and child-process scope", async function () {
    const capability = await runner.capability();
    if (process.platform !== "darwin") { assert.equal(capability.kind, "unsupported"); return; }
    assert.equal(capability.kind, "supported");
      assert.equal(capability.reads, "all-readable-local-files"); assert.equal(capability.childProcesses, "denied");
      assert.equal(capability.network, "denied"); assert.equal(capability.writes, "candidate-only");
  });
  test("runs an actual check and retains a nonce-bound restart receipt", async function () {
    await supported(this);
    let identity: CheckProcessIdentity | undefined;
    const result = await request("console.log('criterion observed'); process.exit(3)", { onStarted: value => { identity = value; } });
    assert.equal(result.kind, "exited");
    assert.equal(result.exitCode, 3);
    assert.equal(result.stdout, "criterion observed\n"); assert.ok(identity);
    assert.deepEqual(readCheckReceipt(identity), result);
    assert.deepEqual(inspectCheckControl({ controlDirectory: control, nonce: "check-test" }), { kind: "terminal", result });
    assert.equal(inspectCheckControl({ controlDirectory: control, nonce: "other-run" }).kind, "unconfirmed");
    assert.equal(readCheckReceipt({ ...identity, pid: identity.pid + 1 }), undefined);
    assert.equal(readCheckReceipt({ ...identity, nonce: "another-run" }), undefined);
  });
  test("writes only the candidate, denies outside/symlink/hardlink writes, children and loopback network", async function () {
    await supported(this);
    const outside = path.join(directory, "manual.txt"); writeFileSync(outside, "manual");
    const result = await request(`const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process'),net=require('node:net');
fs.writeFileSync('inside.txt','inside'); const outside=${JSON.stringify(outside)};
assert.throws(()=>fs.writeFileSync(outside,'overwritten'),/EPERM|EACCES/);
fs.symlinkSync(outside,'escape'); assert.throws(()=>fs.writeFileSync('escape','overwritten'),/EPERM|EACCES/);
try{fs.linkSync(outside,'hard');assert.throws(()=>fs.writeFileSync('hard','overwritten'),/EPERM|EACCES/);}catch(e){assert.match(e.code,/EPERM|EACCES/);}
assert.throws(()=>process.kill(process.ppid,0),/EPERM|EACCES/);
for(const detached of [false,true]){const result=cp.spawnSync(process.execPath,['-e','process.exit(0)'],{detached});assert.match(result.error?.code??'',/EPERM|EACCES/);}
const socket=net.connect({host:'127.0.0.1',port:9});socket.on('connect',()=>process.exit(99));socket.on('error',error=>{assert.match(error.code,/EPERM|EACCES/);console.log('contained');});`);
    assert.equal(result.kind, "exited"); assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /contained/); assert.equal(readFileSync(outside, "utf8"), "manual");
    assert.equal(readFileSync(path.join(root, "inside.txt"), "utf8"), "inside");
  });
  test("does not inherit unrelated environment values and caps combined output", async function () {
    await supported(this);
    const previous = process.env.PIARRE_SHOULD_NOT_ESCAPE; process.env.PIARRE_SHOULD_NOT_ESCAPE = "private-fixture";
    try {
      const result = await request("require('node:assert/strict').equal(process.env.PIARRE_SHOULD_NOT_ESCAPE,undefined);process.stdout.write('x'.repeat(80000));process.stderr.write('y'.repeat(80000));");
      assert.equal(result.kind, "exited"); assert.equal(result.exitCode, 0);
      assert.equal(result.truncated, true); assert.equal(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr), 64_000);
    } finally { if (previous === undefined) delete process.env.PIARRE_SHOULD_NOT_ESCAPE; else process.env.PIARRE_SHOULD_NOT_ESCAPE = previous; }
  });
  test("deadline waits for observed termination and does not reuse the launch journal", async function () {
    await supported(this);
    const result = await request("setInterval(()=>{},1000)", { deadlineAt: Date.now() + 700 });
    assert.equal(result.kind, "timed-out"); assert.equal(result.termination, "observed"); assert.equal(result.signal, "SIGKILL");
    const again = await request("console.log('must not run')"); assert.equal(again.kind, "unsupported");
    assert.equal(again.stdout, "");
  });
  test("interrupt acknowledges terminal child close, not merely delivery of a signal", async function () {
    await supported(this);
    let started: (() => void) | undefined;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const pending = request("process.on('SIGTERM',()=>{});setInterval(()=>{},1000)", { onStarted: () => { started?.(); } });
    await ready;
    const interruption = await runner.interrupt();
    assert.equal(interruption.kind, "terminal");
    const result = await pending; assert.equal(result.kind, "interrupted"); assert.equal(result.termination, "observed");
  });
  test("interrupting asynchronous preparation prevents the approved command from starting", async function () {
    await supported(this);
    let started = false;
    const pending = request("console.log('must not run')", { onStarted: () => { started = true; } });
    assert.equal((await runner.interrupt()).kind, "not-running");
    const result = await pending;
    assert.equal(result.kind, "unsupported"); assert.equal(started, false); assert.equal(result.stdout, "");
  });
  test("concurrent launch cannot pass the asynchronous capability gate twice", async function () {
    await supported(this);
    const first = request("setTimeout(()=>{},100)");
    const otherControl = path.join(directory, "other-control"); mkdirSync(otherControl);
    const second = await runner.run({ root, controlDirectory: otherControl, argv: [node, "-e", "console.log('duplicate')"], deadlineAt: Date.now() + 5_000, nonce: "other" });
    assert.equal(second.kind, "unsupported");
    assert.equal((await first).kind, "exited");
  });
  test("a Node test runs with explicitly selected single-process isolation", async function () {
    await supported(this);
    writeFileSync(path.join(root, "refund.test.cjs"), "const test=require('node:test'),assert=require('node:assert/strict');test('refund',()=>assert.equal(45,45));");
    const result = await runner.run({ root, controlDirectory: control, argv: [node, "--test", "--experimental-test-isolation=none", "refund.test.cjs"], deadlineAt: Date.now() + 5_000, nonce: "node-test" });
    assert.equal(result.kind, "exited"); assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /pass 1/);
  });
  test("host launcher exit leaves a watchdog that records observed child termination", async function () {
    this.timeout(10_000);
    await supported(this);
    const bundle = path.resolve(__dirname, "candidate-check-runner.test.js");
    const launcher = path.join(directory, "launcher.cjs");
    const modulePath = path.join(directory, "runner.cjs");
    const sourcePath = path.resolve(__dirname, "../../src/candidate-check-runner.ts");
    const esbuild = path.resolve(__dirname, "../../../../node_modules/esbuild/bin/esbuild");
    const compilation = spawn(node, [esbuild, sourcePath, "--bundle", "--platform=node", "--format=cjs", `--outfile=${modulePath}`], { stdio: "ignore" });
    assert.equal(await new Promise(resolve => compilation.once("close", resolve)), 0, bundle);
    writeFileSync(launcher, `const {CandidateCheckRunner}=require(${JSON.stringify(modulePath)});new CandidateCheckRunner({probeExecutable:${JSON.stringify(node)}}).run({root:${JSON.stringify(root)},controlDirectory:${JSON.stringify(control)},argv:[${JSON.stringify(node)},'-e','setInterval(()=>{},1000)'],deadlineAt:Date.now()+1500,nonce:'crash-probe',onStarted:identity=>{require('node:fs').writeFileSync(${JSON.stringify(path.join(directory, "identity.json"))},JSON.stringify(identity));process.exit(0);}});`);
    const launch = spawn(node, [launcher], { stdio: "ignore" });
    assert.equal(await new Promise(resolve => launch.once("close", resolve)), 0);
    const identity: unknown = JSON.parse(readFileSync(path.join(directory, "identity.json"), "utf8"));
    assert.ok(typeof identity === "object" && identity !== null && "pid" in identity && "watchdogPid" in identity && "nonce" in identity && "startedAt" in identity && "controlDirectory" in identity);
    assert.equal(typeof identity.pid, "number"); assert.equal(typeof identity.watchdogPid, "number"); assert.equal(typeof identity.startedAt, "number"); assert.equal(typeof identity.nonce, "string"); assert.equal(typeof identity.controlDirectory, "string");
    if (typeof identity.pid !== "number" || typeof identity.watchdogPid !== "number" || typeof identity.startedAt !== "number" || typeof identity.nonce !== "string" || typeof identity.controlDirectory !== "string") throw new Error("Invalid child identity");
    const observed: CheckProcessIdentity = { pid: identity.pid, watchdogPid: identity.watchdogPid, nonce: identity.nonce, startedAt: identity.startedAt, controlDirectory: identity.controlDirectory };
    const until = Date.now() + 5_000;
    let receipt = readCheckReceipt(observed);
    while (!receipt && Date.now() < until) { await new Promise(resolve => setTimeout(resolve, 20)); receipt = readCheckReceipt(observed); }
    assert.ok(receipt, "Surviving watchdog must record a receipt after host exit");
    assert.equal(receipt.termination, "observed"); assert.ok(receipt.kind === "interrupted" || receipt.kind === "timed-out");
  });
  test("watchdog deadline still stops a check while the host event loop is frozen", async function () {
    this.timeout(10_000);
    await supported(this);
    const modulePath = path.join(directory, "runner-frozen.cjs");
    const sourcePath = path.resolve(__dirname, "../../src/candidate-check-runner.ts");
    const esbuild = path.resolve(__dirname, "../../../../node_modules/esbuild/bin/esbuild");
    const compilation = spawn(node, [esbuild, sourcePath, "--bundle", "--platform=node", "--format=cjs", `--outfile=${modulePath}`], { stdio: "ignore" });
    assert.equal(await new Promise(resolve => compilation.once("close", resolve)), 0);
    const launcherPath = path.join(directory, "frozen.cjs");
    writeFileSync(launcherPath, `const {CandidateCheckRunner}=require(${JSON.stringify(modulePath)});new CandidateCheckRunner({probeExecutable:${JSON.stringify(node)}}).run({root:${JSON.stringify(root)},controlDirectory:${JSON.stringify(control)},argv:[${JSON.stringify(node)},'-e','setInterval(()=>{},1000)'],deadlineAt:Date.now()+900,nonce:'frozen-host',onStarted:()=>{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10000);}});`);
    const launch = spawn(node, [launcherPath], { stdio: "ignore" });
    const closed = new Promise(resolve => launch.once("close", resolve));
    try {
      const until = Date.now() + 5_000;
      let inspection = inspectCheckControl({ controlDirectory: control, nonce: "frozen-host" });
      while (inspection.kind !== "terminal" && Date.now() < until) {
        await new Promise(resolve => setTimeout(resolve, 20)); inspection = inspectCheckControl({ controlDirectory: control, nonce: "frozen-host" });
      }
      assert.equal(inspection.kind, "terminal", "Watchdog must not depend on the frozen extension host timer");
      assert.equal(inspection.result.kind, "timed-out"); assert.equal(inspection.result.termination, "observed");
    } finally { launch.kill("SIGKILL"); await closed; }
  });

});
