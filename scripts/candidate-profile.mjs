import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { setTimeout } from "node:timers";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron";

const sourceRoot = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const markerName = "piarre-candidate-profile.json";
function canonicalFuture(value) {
  const missing = []; let current = path.resolve(value);
  while (!existsSync(current)) { missing.unshift(path.basename(current)); current = path.dirname(current); }
  return path.join(realpathSync(current), ...missing);
}
export function candidateLayout(directory) {
  let root = path.resolve(directory);
  if (process.platform === "darwin") for (const alias of ["/tmp", "/var"]) {
    if (root === alias || root.startsWith(`${alias}/`)) root = path.join(realpathSync(alias), path.relative(alias, root));
  }
  assert.equal(canonicalFuture(root), root, "Candidate profile must not contain symlinks");
  assert.ok(root !== path.parse(root).root && path.dirname(root) !== path.parse(root).root, "Choose a dedicated candidate directory");
  const relative = path.relative(sourceRoot, root);
  assert.ok(relative.startsWith(`..${path.sep}`) || relative === "..", "Candidate profile must be outside the source repository");
  return { root, user: path.join(root, "user-data"), extensions: path.join(root, "extensions"), marker: path.join(root, markerName), process: path.join(root, "host-process.json") };
}
function owned(layout) {
  assert.ok(existsSync(layout.marker) && !lstatSync(layout.marker).isSymbolicLink(), "Not an owned candidate profile");
  const marker = JSON.parse(readFileSync(layout.marker, "utf8"));
  assert.equal(marker.schemaVersion, 1); assert.equal(marker.extensionId, "sysung.piarre-candidate"); assert.equal(marker.directory, layout.root);
  for (const location of [layout.user, layout.extensions, layout.process]) if (existsSync(location)) assert.equal(canonicalFuture(location), location, "Candidate paths must not contain symlinks");
}
export function initializeCandidate(directory) {
  const layout = candidateLayout(directory);
  if (existsSync(layout.root)) owned(layout);
  else {
    mkdirSync(layout.root, { recursive: true, mode: 0o700 });
    writeFileSync(layout.marker, JSON.stringify({ schemaVersion: 1, extensionId: "sysung.piarre-candidate", directory: layout.root }) + "\n", { flag: "wx", mode: 0o600 });
  }
  const userSettings = path.join(layout.user, "User");
  assert.equal(canonicalFuture(userSettings), userSettings, "Candidate settings must not contain symlinks");
  mkdirSync(userSettings, { recursive: true });
  mkdirSync(layout.extensions, { recursive: true });
  const settings = path.join(userSettings, "settings.json");
  assert.equal(canonicalFuture(settings), settings, "Candidate settings must not be a symlink");
  if (!existsSync(settings)) writeFileSync(settings, JSON.stringify({ "extensions.autoUpdate": false, "extensions.autoCheckUpdates": false, "window.restoreWindows": "none", "update.mode": "none", "telemetry.telemetryLevel": "off", "chat.disableAIFeatures": true, "window.title": "Piarre Candidate | ${rootName} | ${appName}" }, null, 2), { flag: "wx", mode: 0o600 });
  return layout;
}
function processIdentity(pid) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "pgid=,lstart=,command="], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status === 0) return result.stdout.trim();
  if (result.status === 1 && !result.stdout.trim()) return null;
  throw new Error("Cannot inspect the candidate process. Refusing stop/reset.");
}
function groupAlive(pid) {
  const result = spawnSync("ps", ["-axo", "pgid="], { encoding: "utf8", maxBuffer: 1024 * 1024 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, "Cannot verify candidate process-group exit. Refusing reset.");
  return result.stdout.split(/\s+/).some(value => Number(value) === pid);
}
export function candidateStatus(directory) {
  const layout = candidateLayout(directory); owned(layout);
  if (!existsSync(layout.process)) return { kind: "stopped" };
  const record = JSON.parse(readFileSync(layout.process, "utf8"));
  assert.ok(Number.isSafeInteger(record.pid) && record.pid > 1 && typeof record.identity === "string", "Invalid candidate process record");
  const identity = processIdentity(record.pid);
  if (!identity) { assert.ok(!groupAlive(record.pid), "Candidate main process exited while its process group is still active. Reconcile before reset."); return { kind: "stopped" }; }
  assert.equal(identity, record.identity, "Candidate PID identity changed; refusing to signal or reset. Close the candidate manually.");
  assert.ok(identity.includes(layout.user) && Number(identity.split(/\s+/)[0]) === record.pid, "Candidate process does not own its isolated process group");
  return { kind: "running", pid: record.pid };
}
export async function stopCandidate(directory) {
  assert.notEqual(process.platform, "win32", "Use Close Window on Windows; automated stop is supported on macOS/Linux only");
  const layout = candidateLayout(directory); const status = candidateStatus(directory);
  if (status.kind === "running") {
    process.kill(status.pid, "SIGTERM");
    for (let attempt = 0; attempt < 150 && groupAlive(status.pid); attempt++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(groupAlive(status.pid), false, "Candidate process group has not stopped. Inspect it before reset; no forced kill was sent.");
  }
  rmSync(layout.process, { force: true });
}
export function resetCandidate(directory) {
  const layout = candidateLayout(directory); owned(layout);
  assert.equal(candidateStatus(directory).kind, "stopped", "Stop the candidate before resetting its local state");
  for (const name of ["user-data", "extensions", "host-process.json"]) rmSync(path.join(layout.root, name), { recursive: true, force: true });
  assert.ok(!existsSync(layout.user) && !existsSync(layout.extensions), "Candidate reset deletion verification failed");
  return { deleted: ["user-data", "extensions", "host-process.json"], preserved: [markerName, "repository fixture", "stable profile", "source repository", "exports"] };
}
function fixture(layout) {
  const repository = path.join(layout.root, "fixture-repository");
  if (!existsSync(repository)) {
    mkdirSync(repository);
    writeFileSync(path.join(repository, "package.json"), JSON.stringify({ name: "candidate-counter-fixture", private: true, type: "module", scripts: { test: "node --test" } }, null, 2));
    writeFileSync(path.join(repository, "counter.mjs"), "export const increment = value => value + 1;\n");
    writeFileSync(path.join(repository, "counter.test.mjs"), 'import assert from "node:assert/strict";\nimport test from "node:test";\nimport { increment } from "./counter.mjs";\ntest("increments", () => assert.equal(increment(1), 2));\n');
    execFileSync("git", ["init", repository], { stdio: "ignore" });
    execFileSync("git", ["-C", repository, "add", "."]);
    execFileSync("git", ["-C", repository, "-c", "user.name=Candidate fixture", "-c", "user.email=candidate@localhost", "commit", "-m", "Create cross-repository candidate fixture"], { stdio: "ignore" });
  }
  execFileSync(process.execPath, ["--test"], { cwd: repository, stdio: "inherit" });
  return repository;
}
async function main(args) {
  const [action, ...options] = args;
  const allowed = new Set(["--directory", "--code", "--vsix", "--repository"]);
  const values = new Map();
  for (let index = 0; index < options.length; index += 2) { const key = options[index]; const value = options[index + 1]; assert.ok(allowed.has(key) && value && !values.has(key), "Use --directory, --code, --vsix, --repository with one value each"); values.set(key, value); }
  assert.ok(values.has("--directory"), "Specify an owned --directory outside your repository");
  const directory = values.get("--directory");
  if (action === "status") return console.log(candidateStatus(directory));
  if (action === "stop") { await stopCandidate(directory); return console.log("Candidate stopped. Stable profile preserved."); }
  if (action === "reset") return console.log(resetCandidate(directory));
  assert.ok(["prepare", "fixture", "launch"].includes(action), "Use prepare, fixture, launch, status, stop or reset");
  const layout = initializeCandidate(directory);
  if (action === "fixture") return console.log(fixture(layout));
  const executable = realpathSync(values.get("--code") ?? "");
  assert.equal(candidateStatus(directory).kind, "stopped", "Candidate is already running");
  const profile = ["--user-data-dir", layout.user, "--extensions-dir", layout.extensions];
  const [cli] = resolveCliArgsFromVSCodeExecutablePath(executable);
  if (action === "prepare") {
    assert.ok(values.has("--vsix"), "Pass the candidate VSIX with --vsix");
    execFileSync(cli, [...profile, "--install-extension", path.resolve(values.get("--vsix")), "--force"], { stdio: "inherit" });
    const installed = execFileSync(cli, [...profile, "--list-extensions", "--show-versions"], { encoding: "utf8" });
    assert.match(installed, /^sysung\.piarre-candidate@\d/m, "Candidate package missing");
    assert.doesNotMatch(installed, /^sysung\.piarre@/m, "Stable must not be installed in the candidate profile");
    return console.log(installed.trim());
  }
  assert.notEqual(process.platform, "win32", "Automated isolated launch/stop currently supports macOS/Linux");
  const installed = execFileSync(cli, [...profile, "--list-extensions"], { encoding: "utf8" });
  assert.ok(installed.split(/\r?\n/).includes("sysung.piarre-candidate"), "Prepare the candidate package first");
  const repository = realpathSync(values.get("--repository") ?? fixture(layout));
  execFileSync("git", ["-C", repository, "rev-parse", "--show-toplevel"], { stdio: "ignore" });
  assert.ok(Buffer.byteLength(layout.user) <= 80, "Candidate user-data path is too long for the VS Code IPC socket. Choose a short directory such as /tmp/piarre-candidate.");
  const host = spawn(executable, [...profile, "--new-window", "--disable-updates", "--skip-welcome", "--skip-release-notes", repository], { detached: true, stdio: "ignore", env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } });
  await new Promise((resolve, reject) => { host.once("spawn", resolve); host.once("error", reject); });
  await new Promise(resolve => setTimeout(resolve, 1000));
  const identity = processIdentity(host.pid);
  assert.ok(identity && identity.includes(layout.user), "Candidate host failed to start. No stable profile was touched.");
  writeFileSync(layout.process, JSON.stringify({ pid: host.pid, identity }) + "\n", { mode: 0o600 });
  host.unref();
  console.log(`Candidate running with isolated identity sysung.piarre-candidate. Profile ${layout.root}. Repository ${repository}. No model call was made by the launcher.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
