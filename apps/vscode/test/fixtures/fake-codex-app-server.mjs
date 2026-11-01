import readline from "node:readline";
import { setTimeout } from "node:timers";

const controls = process.argv.includes("--controls");
const approvalArgument = process.argv.find((argument) =>
  argument.startsWith("--approval-command="),
);
const approvalCommand = approvalArgument?.slice("--approval-command=".length);
const fileChangeArgument = process.argv.find((argument) =>
  argument.startsWith("--file-change="),
);
const fileChangePath = fileChangeArgument?.slice("--file-change=".length);
const expectedDecision = process.argv.includes("--expect-decline")
  ? "decline"
  : "accept";
const missingCorrelation = process.argv.includes("--missing-correlation");
const turnFails = process.argv.includes("--turn-failed");
let nextId = 0;
let approvalRun;
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const stop = () => {
  lines.close();
  process.stdin.unref();
};

const lines = readline.createInterface({ input: process.stdin });
lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id === 900 && !("method" in message)) {
    if (message.result?.decision === expectedDecision && approvalRun) {
      send({ method: "turn/completed", params: approvalRun });
      stop();
    } else {
      process.exitCode = 2;
      stop();
    }
    return;
  }
  if (message.method === "initialized") return;
  if (!("id" in message)) return;
  if (message.method === "initialize") {
    send({ id: message.id, result: {} });
    return;
  }
  if (message.method === "thread/start") {
    send({ id: message.id, result: { thread: { id: `thread-${++nextId}` } } });
    return;
  }
  if (message.method === "turn/start") {
    const turnId = `turn-${++nextId}`;
    const threadId = message.params.threadId;
    send({ id: message.id, result: { turn: { id: turnId } } });
    if (approvalCommand) {
      approvalRun = { threadId, turnId };
      send({
        method: "item/started",
        params: {
          threadId,
          turnId,
          item: {
            id: "command-one",
            type: "commandExecution",
            command: approvalCommand,
          },
        },
      });
      send({
        id: 900,
        method: "item/commandExecution/requestApproval",
        params: { threadId, turnId, itemId: "command-one" },
      });
      return;
    }
    if (fileChangePath) {
      approvalRun = { threadId, turnId };
      if (!missingCorrelation)
        send({
          method: "item/started",
          params: {
            threadId,
            turnId,
            item: {
              id: "file-one",
              type: "fileChange",
              status: "inProgress",
              changes: [{ path: fileChangePath, kind: "add", diff: "+content" }],
            },
          },
        });
      send({
        id: 900,
        method: "item/fileChange/requestApproval",
        params: { threadId, turnId, itemId: "file-one" },
      });
      return;
    }
    setTimeout(() => {
      send({
        method: turnFails ? "turn/failed" : "turn/completed",
        params: { threadId, turnId },
      });
      stop();
    }, 20);
    return;
  }
  if (message.method === "turn/steer" || message.method === "turn/interrupt") {
    if (controls) {
      if (message.method === "turn/interrupt")
        send({
          method: "turn/completed",
          params: {
            threadId: message.params.threadId,
            turnId: message.params.turnId,
          },
        });
      send({ id: message.id, result: {} });
      if (message.method === "turn/interrupt") stop();
    }
    else send({ id: message.id, error: { code: -32601, message: "unsupported" } });
    return;
  }
  send({ id: message.id, error: { code: -32601, message: "unknown" } });
});
