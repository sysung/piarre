import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { setTimeout } from "node:timers";

if (process.env.PIARRE_LIVE_CODEX !== "1")
  throw new Error("Set PIARRE_LIVE_CODEX=1 to run the authenticated live probe");

const root = "/tmp/piarre-b03-live/workspace";
const allowedFile = path.join(root, "allowed.txt");
const deniedFile = "/tmp/piarre-b03-live-denied.txt";
await rm("/tmp/piarre-b03-live", { recursive: true, force: true });
await rm(deniedFile, { force: true });
await mkdir(root, { recursive: true });

const child = spawn("codex", ["app-server", "--stdio"], {
  cwd: root,
  shell: false,
  stdio: ["pipe", "pipe", "pipe"],
});
let stderr = "";
let requestId = 0;
const pending = new Map();
const commandByItem = new Map();
const decisions = [];
const turns = [];

const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
const request = (method, params) => {
  const id = ++requestId;
  send({ id, method, params });
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
};

const lines = readline.createInterface({ input: child.stdout });
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});
const rejectPending = (reason) => {
  for (const waiter of pending.values()) waiter.reject(reason);
  pending.clear();
};
child.on("error", rejectPending);
child.on("exit", (code, signal) => {
  rejectPending(
    new Error(
      `Codex app-server exited code=${code} signal=${signal}: ${stderr}`,
    ),
  );
});
lines.on("line", (line) => {
  const message = JSON.parse(line);
  if ("id" in message && ("result" in message || "error" in message)) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
    return;
  }
  if (message.method === "item/started") {
    const item = message.params?.item;
    if (item?.type === "commandExecution" && typeof item.id === "string")
      commandByItem.set(item.id, item.command);
    return;
  }
  if ("id" in message && message.method === "item/commandExecution/requestApproval") {
    const command = commandByItem.get(message.params?.itemId);
    const accepted =
      command === "/bin/zsh -c /bin/pwd" ||
      command === `/bin/zsh -c '/usr/bin/touch ${allowedFile}'`;
    decisions.push({ command, decision: accepted ? "accept" : "decline" });
    send({ id: message.id, result: { decision: accepted ? "accept" : "decline" } });
    return;
  }
  if ("id" in message && typeof message.method === "string") {
    send({ id: message.id, result: { decision: "decline" } });
    return;
  }
  if (message.method === "turn/completed") turns.push(message.params?.turn?.id ?? "completed");
});

try {
  await request("initialize", {
    clientInfo: { name: "piarre-live-probe", version: "0.0.1" },
    capabilities: { experimentalApi: true },
  });
  send({ method: "initialized", params: {} });
  const thread = await request("thread/start", {
    cwd: root,
    ephemeral: true,
    approvalPolicy: "untrusted",
    approvalsReviewer: "user",
    sandbox: "workspace-write",
  });
  const prompts = [
    "Run /bin/pwd exactly once and no other command.",
    "Run /bin/pwd --extra exactly once and no other command.",
    `Run /usr/bin/touch ${allowedFile} exactly once and no other command.`,
    `Run /usr/bin/touch ${deniedFile} exactly once and no other command.`,
  ];
  for (const text of prompts) {
    const before = turns.length;
    await request("turn/start", {
      threadId: thread.thread.id,
      input: [{ type: "text", text }],
      cwd: root,
      approvalPolicy: "untrusted",
      approvalsReviewer: "user",
      sandboxPolicy: {
        type: "workspaceWrite",
        writableRoots: [root],
        networkAccess: false,
      },
    });
    const deadline = Date.now() + 120_000;
    while (turns.length === before) {
      if (Date.now() > deadline) throw new Error(`Live probe did not complete: ${text}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  const required = [
    "/bin/zsh -c /bin/pwd",
    "/bin/zsh -c '/bin/pwd --extra'",
    `/bin/zsh -c '/usr/bin/touch ${allowedFile}'`,
    `/bin/zsh -c '/usr/bin/touch ${deniedFile}'`,
  ];
  for (const command of required) {
    if (!decisions.some((decision) => decision.command === command))
      throw new Error(
        `Live probe never observed ${command}. Observed ${JSON.stringify(decisions)}`,
      );
  }
  await readFile(allowedFile, "utf8");
  try {
    await readFile(deniedFile, "utf8");
    throw new Error("Denied command changed the filesystem");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  process.stdout.write(`${JSON.stringify({ codex: "0.164.0", decisions }, null, 2)}\n`);
} finally {
  child.kill("SIGTERM");
}
