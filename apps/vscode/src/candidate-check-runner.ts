import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { accessSync, constants, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, constants as osConstants } from "node:os";
import path from "node:path";

const MAX_OUTPUT_BYTES = 64_000;
const MAX_DURATION_MS = 120_000;
const SANDBOX = "/usr/bin/sandbox-exec";

export type CheckRunnerCapability =
  | { readonly kind: "supported"; readonly sandbox: "macos-seatbelt-single-process";
      readonly reads: "all-readable-local-files"; readonly writes: "candidate-only"; readonly network: "denied";
      readonly childProcesses: "denied"; readonly maxOutputBytes: number; readonly maxDurationMs: number; readonly probeExecutable: string }
  | { readonly kind: "unsupported"; readonly reason: string };
export interface CheckProcessIdentity {
  readonly pid: number; readonly watchdogPid: number; readonly nonce: string; readonly startedAt: number; readonly controlDirectory: string;
}
interface CheckOutput {
  readonly stdout: string; readonly stderr: string; readonly truncated: boolean;
  readonly processIdentity: CheckProcessIdentity | null;
}
export type CandidateCheckResult = CheckOutput & (
  | { readonly kind: "exited"; readonly termination: "observed"; readonly exitCode: number | null; readonly signal: string | null }
  | { readonly kind: "timed-out" | "interrupted"; readonly termination: "observed"; readonly exitCode: number | null; readonly signal: string | null }
  | { readonly kind: "unknown"; readonly termination: "unconfirmed"; readonly reason: string }
  | { readonly kind: "unsupported"; readonly termination: "not-started"; readonly reason: string }
);
export type CheckInterruptResult =
  | { readonly kind: "terminal"; readonly result: CandidateCheckResult }
  | { readonly kind: "not-running" }
  | { readonly kind: "unknown"; readonly reason: string };
interface ActiveCheck {
  readonly closed: Promise<CandidateCheckResult>;
  stop(): void;
}
type RunnerState = { readonly kind: "idle" } | { readonly kind: "preparing" } | { readonly kind: "running"; readonly active: ActiveCheck };
const emptyOutput = (): CheckOutput => ({ stdout: "", stderr: "", truncated: false, processIdentity: null });
const unavailable = (reason: string): CandidateCheckResult => ({ kind: "unsupported", termination: "not-started", reason, ...emptyOutput() });
const watchdog = String.raw`
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const config = JSON.parse(process.argv[1]);
let stopping, force, deadline, child, identity=null, count=0, truncated=false;
const stdout=[],stderr=[];
process.stdout.on('error',()=>{});
function atomic(name,value){const target=path.join(config.controlDirectory,name),fd=fs.openSync(target+'.tmp','wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(target+'.tmp',target);const directory=fs.openSync(config.controlDirectory,'r');try{fs.fsyncSync(directory);}finally{fs.closeSync(directory);}}
function stop(reason){if(stopping)return;stopping=reason;if(child){child.kill(reason==='timed-out'?'SIGKILL':'SIGTERM');if(reason!=='timed-out')force=setTimeout(()=>child.kill('SIGKILL'),250);}}
function collect(target,chunk){const remaining=Math.max(0,config.maxOutputBytes-count);if(remaining>0)target.push(chunk.subarray(0,remaining));count+=Math.min(remaining,chunk.length);if(chunk.length>remaining)truncated=true;}
let input='';process.stdin.on('data',chunk=>{input+=chunk.toString();if(input.length>16000){stop('interrupted');return;}let newline;while((newline=input.indexOf('\n'))>=0){const frame=input.slice(0,newline);input=input.slice(newline+1);try{const value=JSON.parse(frame);if(value.kind==='interrupt'&&value.nonce===config.nonce&&Object.keys(value).length===2)stop('interrupted');}catch{stop('interrupted');}}});
process.stdin.on('end',()=>stop('interrupted'));
atomic('watchdog.json',{nonce:config.nonce,watchdogPid:process.pid,startedAt:Date.now(),deadlineAt:config.deadlineAt});
if(Date.now()>=config.deadlineAt){atomic('receipt.json',{nonce:config.nonce,completedAt:Date.now(),result:{kind:'unsupported',termination:'not-started',reason:'Deadline expired before watchdog child launch.',stdout:'',stderr:'',truncated:false,processIdentity:null}});process.exit(0);}
child=cp.spawn(config.sandbox,['-p',config.profile,config.executable,...config.args],{cwd:config.root,env:config.env,shell:false,stdio:'pipe'});
child.stdin.end();
child.stdout.on('data',chunk=>collect(stdout,chunk));child.stderr.on('data',chunk=>collect(stderr,chunk));
child.on('error',()=>stop('interrupted'));
child.on('spawn',()=>{
 identity={pid:child.pid,watchdogPid:process.pid,nonce:config.nonce,startedAt:Date.now(),controlDirectory:config.controlDirectory};
 atomic('started.json',identity);process.stdout.write(JSON.stringify(identity)+'\n');
 if(stopping){child.kill(stopping==='timed-out'?'SIGKILL':'SIGTERM');if(stopping!=='timed-out')force=setTimeout(()=>child.kill('SIGKILL'),250);}
});
deadline=setTimeout(()=>stop('timed-out'),Math.max(0,config.deadlineAt-Date.now()));
child.on('close',(code,signal)=>{
 clearTimeout(deadline);if(force)clearTimeout(force);
 const result={kind:stopping||'exited',termination:'observed',stdout:Buffer.concat(stdout).toString('utf8'),stderr:Buffer.concat(stderr).toString('utf8'),truncated,processIdentity:identity};
 result.exitCode=code;result.signal=signal;
 atomic('receipt.json',{nonce:config.nonce,completedAt:Date.now(),result});process.exit(0);
});
`;

function isObject(value: unknown): value is object { return typeof value === "object" && value !== null && !Array.isArray(value); }
function processIdentity(value: unknown, nonce: string, controlDirectory: string): CheckProcessIdentity | undefined {
  if (!isObject(value) || !("pid" in value) || !("watchdogPid" in value) || !("nonce" in value) || !("startedAt" in value) || !("controlDirectory" in value) ||
      typeof value.pid !== "number" || !Number.isSafeInteger(value.pid) || value.pid < 1 || typeof value.watchdogPid !== "number" || !Number.isSafeInteger(value.watchdogPid) || value.watchdogPid < 1 ||
      value.nonce !== nonce || typeof value.startedAt !== "number" || !Number.isSafeInteger(value.startedAt) || value.startedAt < 1 || value.pid === value.watchdogPid || value.controlDirectory !== controlDirectory) return undefined;
  return { pid: value.pid, watchdogPid: value.watchdogPid, nonce, startedAt: value.startedAt, controlDirectory };
}
function readControlJson(controlDirectory: string, filename: string): unknown {
  const target = path.join(controlDirectory, filename);
  const stat = lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 512_000) throw new Error("Invalid check control file.");
  return JSON.parse(readFileSync(target, "utf8"));
}
function controlReceipt({ nonce, controlDirectory }: { readonly nonce: string; readonly controlDirectory: string }): CandidateCheckResult | undefined {
  try {
    const value = readControlJson(controlDirectory, "receipt.json");
    if (!isObject(value) || !("nonce" in value) || value.nonce !== nonce || !("result" in value) || !isObject(value.result)) return undefined;
    const result = value.result;
    if (!("kind" in result) || !("termination" in result) || !("stdout" in result) || typeof result.stdout !== "string" || !("stderr" in result) || typeof result.stderr !== "string" ||
        !("truncated" in result) || typeof result.truncated !== "boolean" || !("processIdentity" in result)) return undefined;
    if (result.kind === "unsupported" && result.termination === "not-started" && result.processIdentity === null && "reason" in result && typeof result.reason === "string" && result.stdout === "" && result.stderr === "") return unavailable(result.reason);
    if (result.termination !== "observed") return undefined;
    const stored = processIdentity(result.processIdentity, nonce, controlDirectory);
    if (!stored) return undefined;
    const output = { stdout: result.stdout, stderr: result.stderr, truncated: result.truncated, processIdentity: stored };
    if (Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) > MAX_OUTPUT_BYTES + 8) return undefined;
    if ((result.kind !== "exited" && result.kind !== "timed-out" && result.kind !== "interrupted") || !("exitCode" in result) || !("signal" in result) || (result.exitCode !== null && (typeof result.exitCode !== "number" || !Number.isInteger(result.exitCode)))) return undefined;
    if (result.signal !== null && (typeof result.signal !== "string" || !Object.hasOwn(osConstants.signals, result.signal))) return undefined;
    if (result.exitCode !== null && (result.exitCode < 0 || result.exitCode > 255 || result.signal !== null)) return undefined;
    return { kind: result.kind, termination: "observed", exitCode: result.exitCode, signal: result.signal, ...output };
  } catch { return undefined; }
}
export function readCheckReceipt(identity: CheckProcessIdentity): CandidateCheckResult | undefined {
  const result = controlReceipt(identity);
  const stored = result?.processIdentity;
  return stored && stored.pid === identity.pid && stored.watchdogPid === identity.watchdogPid && stored.startedAt === identity.startedAt ? result : undefined;
}
export type CheckControlInspection =
  | { readonly kind: "terminal"; readonly result: CandidateCheckResult }
  | { readonly kind: "started"; readonly processIdentity: CheckProcessIdentity }
  | { readonly kind: "unconfirmed"; readonly reason: string };
export function inspectCheckControl({ controlDirectory: requestedControlDirectory, nonce }: { readonly controlDirectory: string; readonly nonce: string }): CheckControlInspection {
  try {
    const controlDirectory = realpathSync(requestedControlDirectory);
    const intent = readControlJson(controlDirectory, "intent.json");
    if (!isObject(intent) || !("nonce" in intent) || intent.nonce !== nonce) throw new Error("Check launch identity mismatch.");
    const receipt = controlReceipt({ nonce, controlDirectory });
    if (receipt) return { kind: "terminal", result: receipt };
    const started = processIdentity(readControlJson(controlDirectory, "started.json"), nonce, controlDirectory);
    if (started) return { kind: "started", processIdentity: started };
  } catch { return { kind: "unconfirmed", reason: "No trustworthy terminal receipt or start identity is available. Do not relaunch or release ownership." }; }
  return { kind: "unconfirmed", reason: "Check completion is unconfirmed. Do not relaunch or release ownership." };
}

function profile(root: string, executable: string): string {
  return `(version 1)\n(deny default)\n(allow process-exec (literal ${JSON.stringify(executable)}))\n(allow file-read*)\n(allow sysctl-read)\n(allow file-write* (subpath ${JSON.stringify(root)}))\n`;
}
function environment(root: string): NodeJS.ProcessEnv {
  return { PATH: (process.env.PATH ?? "").split(path.delimiter).filter(value => path.isAbsolute(value)).join(path.delimiter), HOME: root, TMPDIR: root, LANG: "C.UTF-8" };
}
export function resolveCheckExecutable(value: string): string | undefined {
  const candidates = path.isAbsolute(value) ? [value] : value.includes(path.sep) ? [] :
    (process.env.PATH ?? "").split(path.delimiter).filter(directory => path.isAbsolute(directory)).map(directory => path.join(directory, value));
  for (const candidate of candidates) {
    try { const resolved = realpathSync(candidate); accessSync(resolved, constants.X_OK); if (lstatSync(resolved).isFile()) return resolved; }
    catch { continue; }
  }
  return undefined;
}

export class CandidateCheckRunner {
  private state: RunnerState = { kind: "idle" };
  constructor(private readonly options: { readonly probeExecutable?: string } = {}) {}

  async capability(): Promise<CheckRunnerCapability> {
    if (process.platform !== "darwin") return { kind: "unsupported", reason: "This adapter requires the observed macOS Seatbelt single-process sandbox. No unsafe native fallback is available." };
    const executable = resolveCheckExecutable(this.options.probeExecutable ?? "node");
    if (!executable) return { kind: "unsupported", reason: "A Node executable is required for the containment probe." };
    let scratch: string | undefined;
    try {
      scratch = realpathSync(mkdtempSync(path.join(tmpdir(), "piarre-check-probe-")));
      const root = path.join(scratch, "candidate"); mkdirSync(root);
      const outside = path.join(scratch, "outside.txt"); writeFileSync(outside, "preserve");
      const marker = randomUUID();
      const script = `const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),net=require('node:net');
const root=${JSON.stringify(root)},outside=${JSON.stringify(outside)};
fs.writeFileSync(root+'/allowed','allowed');assert.equal(fs.readFileSync(outside,'utf8'),'preserve');
assert.throws(()=>fs.writeFileSync(outside,'forbidden'),e=>e.code==='EPERM'||e.code==='EACCES');
fs.symlinkSync(outside,root+'/symlink');assert.throws(()=>fs.writeFileSync(root+'/symlink','forbidden'),e=>e.code==='EPERM'||e.code==='EACCES');
try{fs.linkSync(outside,root+'/hardlink');assert.throws(()=>fs.writeFileSync(root+'/hardlink','forbidden'),e=>e.code==='EPERM'||e.code==='EACCES');}catch(e){assert.match(e.code??'',/EPERM|EACCES/);}
assert.throws(()=>process.kill(process.ppid,0),e=>e.code==='EPERM'||e.code==='EACCES');
for(const detached of [false,true]){const child=cp.spawnSync(process.execPath,['-e','process.exit(0)'],{detached});assert.match(child.error?.code??'',/EPERM|EACCES/);}
const socket=net.connect({host:'127.0.0.1',port:9});socket.on('connect',()=>process.exit(9));socket.on('error',e=>{assert.match(e.code,/EPERM|EACCES/);process.stdout.write(${JSON.stringify(marker)});});`;
      const result = await new Promise<{ readonly status: number | null; readonly stdout: string }>((resolve) => {
        const child = spawn(SANDBOX, ["-p", profile(root, executable), executable, "-e", script], { env: environment(root), shell: false, stdio: "pipe" });
        child.stdin.end(); child.stderr.resume();
        let stdout = "";
        const timer = setTimeout(() => { child.kill("SIGKILL"); }, 5_000);
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => { if (stdout.length + chunk.length > 16_000) child.kill("SIGKILL"); else stdout += chunk; });
        child.once("error", () => { clearTimeout(timer); resolve({ status: null, stdout }); });
        child.once("close", status => { clearTimeout(timer); resolve({ status, stdout }); });
      });
      if (result.status !== 0 || result.stdout !== marker || readFileSync(outside, "utf8") !== "preserve") throw new Error("Containment probe did not pass.");
      return { kind: "supported", sandbox: "macos-seatbelt-single-process", reads: "all-readable-local-files", writes: "candidate-only", network: "denied",
        childProcesses: "denied", maxOutputBytes: MAX_OUTPUT_BYTES, maxDurationMs: MAX_DURATION_MS, probeExecutable: executable };
    } catch {
      return { kind: "unsupported", reason: "The local sandbox containment probe failed. Checks are blocked rather than run without containment." };
    } finally { if (scratch) rmSync(scratch, { recursive: true, force: true }); }
  }

  async run(input: { readonly root: string; readonly controlDirectory: string; readonly argv: readonly [string, ...string[]]; readonly deadlineAt: number; readonly nonce: string;
    readonly onStarted?: (identity: CheckProcessIdentity) => void }): Promise<CandidateCheckResult> {
    if (this.state.kind !== "idle") return unavailable("This runner still owns a launch or process; reconcile it before starting another check.");
    if (!input.nonce.trim() || input.nonce.length > 512 || !Number.isSafeInteger(input.deadlineAt) || input.deadlineAt <= Date.now() || input.deadlineAt - Date.now() > MAX_DURATION_MS) return unavailable("A current bounded deadline and launch nonce are required.");
    const preparing = { kind: "preparing" } satisfies Extract<RunnerState, { kind: "preparing" }>;
    this.state = preparing;
    const reject = (reason: string): CandidateCheckResult => { if (this.owns(preparing)) this.state = { kind: "idle" }; return unavailable(reason); };
    const capability = await this.capability();
    if (!this.owns(preparing)) return reject("The check was interrupted before launch.");
    if (capability.kind === "unsupported") return reject(capability.reason);
    let root: string; let controlDirectory: string;
    try {
      root = realpathSync(input.root); controlDirectory = realpathSync(input.controlDirectory);
      const relative = path.relative(root, controlDirectory);
      if (!lstatSync(root).isDirectory() || !lstatSync(controlDirectory).isDirectory() || root === path.parse(root).root || /[\r\n]/.test(root) ||
          relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative)) || readdirSync(controlDirectory).length !== 0) return reject("Check control storage must be empty and outside the candidate workspace.");
    } catch { return reject("The candidate or control directory is unavailable."); }
    const executable = resolveCheckExecutable(input.argv[0]);
    if (!executable) return reject("The approved executable is unavailable.");
    if (["npm", "npx", "pnpm", "yarn"].includes(path.basename(executable).replace(/\.c?js$/, ""))) return reject("This sandbox denies child processes; package-manager commands need a separately supported runner.");
    if (Date.now() >= input.deadlineAt) return reject("The check deadline expired before launch.");
    try { writeFileSync(path.join(controlDirectory, "intent.json"), JSON.stringify({ nonce: input.nonce, deadlineAt: input.deadlineAt, root }), { flag: "wx", mode: 0o600 }); }
    catch { return reject("Check launch intent could not be recorded; no process was started."); }
    const config = { root, controlDirectory, executable, args: input.argv.slice(1), sandbox: SANDBOX, profile: profile(root, executable), env: environment(root),
      nonce: input.nonce, deadlineAt: input.deadlineAt, maxOutputBytes: MAX_OUTPUT_BYTES };
    const child = spawn(capability.probeExecutable, ["-e", watchdog, JSON.stringify(config)], { detached: true, env: environment(controlDirectory), shell: false, stdio: "pipe" });
    let identity: CheckProcessIdentity | null = null;
    let buffer = "";
    let settle: (result: CandidateCheckResult) => void = () => undefined;
    const closed = new Promise<CandidateCheckResult>(resolve => { settle = resolve; });
    const unknown = (): CandidateCheckResult => ({ kind: "unknown", termination: "unconfirmed", reason: "Watchdog termination receipt is unavailable. Retain ownership and reconcile the persisted control directory.", ...emptyOutput(), processIdentity: identity });
    const stop = (): void => { if (!child.stdin.destroyed) child.stdin.write(JSON.stringify({ kind: "interrupt", nonce: input.nonce }) + "\n"); };
    child.stdin.on("error", () => undefined);
    child.stderr.resume();
    const active: ActiveCheck = { closed, stop }; this.state = { kind: "running", active };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 16_000) { stop(); return; }
      const newline = buffer.indexOf("\n");
      if (newline < 0 || identity) return;
      try {
        const value: unknown = JSON.parse(buffer.slice(0, newline));
        identity = processIdentity(value, input.nonce, controlDirectory) ?? null;
        if (!identity || identity.watchdogPid !== child.pid) { stop(); return; }
        try { input.onStarted?.(identity); } catch { stop(); }
      } catch { stop(); }
    });
    child.once("error", () => { settle(unknown()); });
    child.once("close", () => {
      const inspection = inspectCheckControl({ controlDirectory, nonce: input.nonce });
      if (inspection.kind === "terminal") { if (this.state.kind === "running" && this.state.active === active) this.state = { kind: "idle" }; settle(inspection.result); }
      else { if (inspection.kind === "started") identity = inspection.processIdentity; settle(unknown()); }
    });
    let timer: NodeJS.Timeout | undefined;
    const result = await Promise.race([closed, new Promise<CandidateCheckResult>(resolve => { timer = setTimeout(() => { resolve(unknown()); }, Math.max(0, input.deadlineAt - Date.now()) + 5_000); })]);
    if (timer) clearTimeout(timer);
    return result;
  }

  private owns(state: RunnerState): boolean { return this.state === state; }

  async interrupt(): Promise<CheckInterruptResult> {
    const state = this.state;
    if (state.kind === "idle") return { kind: "not-running" };
    if (state.kind === "preparing") { this.state = { kind: "idle" }; return { kind: "not-running" }; }
    state.active.stop();
    let timer: NodeJS.Timeout | undefined;
    const result = await Promise.race([state.active.closed, new Promise<undefined>(resolve => { timer = setTimeout(() => { resolve(undefined); }, 3_000); })]);
    if (timer) clearTimeout(timer);
    return !result || result.termination === "unconfirmed" ? { kind: "unknown", reason: "Check termination was not observed." } : { kind: "terminal", result };
  }
}
