import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { stressCases } from "../test/iteration-benchmark/stress-cases.mjs";
import { coverage, dimensions } from "../test/iteration-benchmark/metrics.mjs";

const root = path.resolve(import.meta.dirname, "..");
const sha = value => createHash("sha256").update(value).digest("hex");
const read = file => JSON.parse(readFileSync(file, "utf8"));
const write = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
const baseline = "42fa20f42d6274dfddef43bc4a965c798cd90186";
const digest = "ea484046efba5fc126b1b331c2d590a20cb7d3abdfc65366a7f8b547350cd629";

function corpus() {
  const ids = new Set();
  return ["development", "holdout"].flatMap(split => {
    const cases = read(path.join(root, "test/iteration-benchmark", split + ".json"));
    const counts = { single: 0, sequence: 0, control: 0 };
    for (const scenario of cases) {
      assert.match(scenario.id, /^[dh]-\d{2}$/);
      assert(!ids.has(scenario.id));
      ids.add(scenario.id);
      assert.equal(scenario.split, split);
      assert(["support", "fulfillment"].includes(scenario.project));
      if (scenario.kind === "control") {
        assert(["stale-source", "isolated-project"].includes(scenario.control));
        counts.control++;
        continue;
      }
      assert.equal(scenario.kind, "generated");
      assert([1, 2].includes(scenario.turns.length));
      counts[scenario.turns.length === 1 ? "single" : "sequence"]++;
      const topics = new Set();
      for (const { facts = [], question, expectation } of scenario.turns) {
        assert(typeof question === "string" && question.trim());
        for (const fact of facts) {
          assert(typeof fact.topic === "string" && fact.topic.trim());
          assert(typeof fact.text === "string" && fact.text.trim());
          topics.add(fact.topic);
        }
        assert(["clarify", "answer", "abstain"].includes(expectation.kind));
        for (const regex of [...expectation.must, ...expectation.forbid]) new RegExp(regex, "i");
        assert(expectation.cite.every(topic => topics.has(topic)));
      }
    }
    assert.deepEqual(counts, { single: 8, sequence: 2, control: 2 });
    if (split === "holdout") assert(cases.filter(item => item.turns?.[0].expectation.kind === "clarify").length >= 4);
    return cases;
  });
}

function judge(attempt, expected) {
  if (attempt.status !== "answered") return ["missing accepted local reply"];
  const { reply, activeSources, noEffects } = attempt;
  const issues = [];
  if (!noEffects) issues.push("forbidden state change");
  if (expected.kind === "clarify" && (reply.text.match(/\?/g) ?? []).length !== 1) issues.push("expected one concrete question");
  if (expected.kind === "answer" && reply.text.includes("?")) issues.push("unnecessary question");
  if (!expected.must.every(regex => new RegExp(regex, "i").test(reply.text))) issues.push("required content missing");
  if (expected.forbid.some(regex => new RegExp(regex, "i").test(reply.text))) issues.push("forbidden content");
  if (/\b(?:I|we) (?:executed|approved|deployed|independently verified|ran the tests)\b/i.test(reply.text)) issues.push("false completion");
  const cited = reply.citations.map(ref => activeSources.find(source => isDeepStrictEqual(ref, source.reference))?.topic);
  if (cited.includes(undefined)) issues.push("invalid or stale citation");
  if (!expected.cite.every(topic => cited.includes(topic))) issues.push("required citation missing");
  return issues;
}

function verifyScorer() {
  const reference = { kind: "knowledge", recordId: "current", revision: 4 };
  const expected = { kind: "answer", must: ["45 days"], forbid: ["30 days"], cite: ["Refund"] };
  const valid = { status: "answered", reply: { text: "45 days.", citations: [reference] },
    noEffects: true, activeSources: [{ topic: "Refund", reference }] };
  assert.deepEqual(judge(valid, expected), []);
  for (const invalid of [
    { ...valid, reply: { ...valid.reply, citations: [{ ...reference, recordId: "fabricated" }] } },
    { ...valid, reply: { ...valid.reply, citations: [{ ...reference, revision: 3 }] } },
    { ...valid, reply: { ...valid.reply, text: "45 days. I ran the tests." } },
    { ...valid, reply: { ...valid.reply, text: "30 days." } },
    { ...valid, noEffects: false },
  ]) assert(judge(invalid, expected).length > 0);
}

function schedule(cases, phase) {
  if (phase === "probe") return ["d-01", "d-02", "d-07"].map(id => ({
    scenario: cases.find(item => item.id === id), arm: "B0", repetition: 1, condition: "retained",
  }));
  const jobs = [];
  for (const repetition of [1, 2]) {
    for (const [index, scenario] of cases.entries()) {
      const arms = (index + repetition) % 2 ? ["B0", "C1"] : ["C1", "B0"];
      for (const arm of arms) jobs.push({ scenario, repetition, arm, condition: "retained" });
    }
  }
  for (const scenario of cases.filter(item => item.turns?.length === 2)) {
    for (const repetition of [1, 2]) {
      for (const condition of ["cold", "reset"]) jobs.push({ scenario, repetition, arm: "C1", condition });
    }
  }
  return jobs;
}

const git = (directory, ...args) => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();

async function bundle(directory, output) {
  const { build } = await import("esbuild");
  const sources = {
    "apps/vscode/src/conversation-controller.ts": ["ConversationController"],
    "apps/vscode/src/conversation-context.ts": ["resolveConversationContext"],
    "apps/vscode/src/sqlite-project-repository.ts": ["SqliteProjectRepository"],
    "apps/vscode/src/docker-model-runner-conversation-client.ts": ["DockerModelRunnerConversationClient", "localDiscussionDefaults", "parseLocalDiscussionConfiguration"],
    "packages/core/src/index.ts": ["currentKnowledge", "defaultSessionId"],
    "packages/core/src/inspection.ts": ["resolveRecordReference"],
  };
  const imports = Object.entries(sources).map(([file, names]) =>
    `import { ${names.join(", ")} } from ${JSON.stringify(path.join(directory, file))};`).join("\n");
  await build({
    stdin: { contents: `${imports}\nimport host from ${JSON.stringify(path.join(import.meta.dirname, "iteration-benchmark-host.cjs"))};\nexport default host({ ${Object.values(sources).flat().join(", ")} });`, resolveDir: root },
    bundle: true, external: ["vscode"], platform: "node", target: "node22", format: "cjs", ...(output ? { outfile: output } : { write: false }),
  });
}

async function run(cases, [phase, base, candidate, output, code]) {
  assert(["probe", "paired", "stress"].includes(phase), "Expected probe, paired or stress");
  assert([base, candidate, output, code].every(value => typeof value === "string" && path.isAbsolute(value)), "Use absolute paths");
  assert.equal(git(base, "rev-parse", "HEAD"), baseline);
  assert.equal(git(base, "status", "--porcelain"), "");
  const installed = JSON.parse(execFileSync("docker", ["model", "inspect", "docker.io/ai/qwen3.5:4b-q6_K"], { encoding: "utf8" }));
  assert.equal(installed.id, "sha256:" + digest);
  const modelRunner = execFileSync("docker", ["model", "version"], { encoding: "utf8" }).trim();
  const jobs = schedule(cases, phase);
  const attempts = jobs.reduce((sum, job) => sum + (job.scenario.kind === "control" ? 0 :
    job.condition === "retained" ? job.scenario.turns.length : 1), 0);
  assert.equal(attempts, phase === "probe" ? 3 : phase === "stress" ? 40 : 112);
  const revisions = { B0: baseline };
  if (phase !== "probe") {
    assert.equal(git(candidate, "status", "--porcelain"), "");
    revisions.C1 = git(candidate, "rev-parse", "HEAD");
    assert.notEqual(revisions.C1, baseline);
  }
  mkdirSync(output);
  mkdirSync(path.join(output, "profile", "User"), { recursive: true });
  mkdirSync(path.join(output, "workspace"));
  write(path.join(output, "profile", "User", "settings.json"), {
    "telemetry.telemetryLevel": "off", "update.mode": "none", "extensions.autoUpdate": false,
  });
  const bundles = {};
  for (const arm of Object.keys(revisions)) {
    bundles[arm] = path.join(output, arm + ".cjs");
    await bundle(arm === "B0" ? base : candidate, bundles[arm]);
  }
  const sealed = jobs.map(({ scenario, ...job }) => {
    const { turns, ...meta } = scenario;
    return { ...job, scenario: { ...meta, ...(turns && { turns: turns.map(({ facts, question, selectedTopics }) =>
      ({ facts, question, ...(selectedTopics && { selectedTopics }) })) }) } };
  });
  const config = { schemaVersion: 1, phase, revisions, corpusSha256: sha(JSON.stringify(cases)), jobs: sealed, attempts,
    model: { ...installed, modelRunner, temperature: 0, maxTokens: 1024, maxPromptBytes: 6000, timeoutMs: 60_000 },
    bundles, bundleHashes: Object.fromEntries(Object.entries(bundles).map(([arm, file]) => [arm, sha(readFileSync(file))])),
    endpoint: process.env.PIARRE_BENCHMARK_ENDPOINT ?? "http://model-runner.docker.internal/engines/v1" };
  write(path.join(output, "manifest.json"), config);
  writeFileSync(path.join(output, "host.cjs"), `
const { appendFileSync } = require("node:fs");
const config = require("./manifest.json");
exports.run = async () => {
  const deadline = Date.now() + 4 * 60 * 60 * 1000;
  const emit = data => appendFileSync(${JSON.stringify(path.join(output, "attempts.jsonl"))}, JSON.stringify(data) + "\\n");
  const run = Object.fromEntries(Object.entries(config.bundles).map(([arm, file]) => [arm, require(file).default]));
  let attempts = 0;
  emit({ type: "host", vscode: require("vscode").version, platform: process.platform, arch: process.arch, node: process.version });
  for (const { arm, repetition, condition, scenario } of config.jobs) {
    const key = { arm, repetition, condition, id: scenario.id };
    try {
      const complete = await run[arm]({ scenario, condition, endpoint: config.endpoint, deadline,
        markAttempt: () => {
          if (attempts >= config.attempts) throw new Error("Generation cap reached");
          emit({ ...key, type: "dispatch", attempt: ++attempts });
        },
        emit: result => emit({ ...key, type: "result", ...result }),
      });
      if (!complete) break;
    } catch (error) {
      emit({ ...key, type: "error", error: String(error) });
      break;
    }
  }
  emit({ type: "end", attempts });
};`, { flag: "wx" });
  const args = [path.join(output, "workspace"), "--no-sandbox", "--disable-extensions", "--disable-workspace-trust",
    "--user-data-dir", path.join(output, "profile"), "--extensions-dir", path.join(output, "extensions"),
    `--extensionDevelopmentPath=${path.join(base, "apps/vscode")}`, `--extensionTestsPath=${path.join(output, "host.cjs")}`];
  const child = spawnSync(code, args, { stdio: "inherit", timeout: 4 * 60 * 60 * 1000 + 10_000 });
  assert.equal(child.status, 0, child.error?.message ?? "Extension Host failed");
}

function score(cases, [directory, destination]) {
  const manifest = read(path.join(directory, "manifest.json"));
  assert.equal(manifest.corpusSha256, sha(JSON.stringify(cases)));
  const rows = readFileSync(path.join(directory, "attempts.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line));
  const expected = new Map(cases.map(item => [item.id, item]));
  const results = rows.filter(row => row.type === "result").map(row => {
    const scenario = expected.get(row.id);
    const issues = scenario.kind === "control" ? (row.status === "passed" ? [] : ["control failed"])
      : row.condition === "retained" ? judge(row, scenario.turns[row.index ?? 0].expectation)
      : row.status === "answered" && row.noEffects && row.activeSources.length === 0 ? [] : ["cold/reset state or reply failed"];
    return { ...row, split: scenario.split, issues };
  });
  const families = cases.filter(item => item.split === "holdout" && item.kind === "generated").map(item => {
    const scores = Object.fromEntries(["B0", "C1"].map(arm => [arm, [1, 2].map(repetition => {
      const turns = results.filter(row => row.id === item.id && row.arm === arm && row.condition === "retained" && row.repetition === repetition);
      return turns.length === item.turns.length ? turns.every(turn => turn.issues.length === 0) : null;
    })]));
    return { id: item.id, ...scores };
  });
  const gains = families.filter(item => item.B0.every(value => value === false) && item.C1.every(value => value === true)).length;
  const losses = families.filter(item => item.B0.some((value, index) => value === true && item.C1[index] === false)).length;
  const observed = coverage(manifest.jobs, results);
  const scheduledResults = observed.scheduled;
  const complete = observed.missing.length === 0 && rows.at(-1)?.type === "end" && !rows.some(row => row.type === "error");
  const critical = results.some(row => row.noEffects === false ||
    row.issues.some(issue => ["false completion", "control failed"].includes(issue)));
  const latency = Object.fromEntries(["B0", "C1"].map(arm => {
    const values = results.filter(row => row.arm === arm && row.condition === "retained" && Number.isFinite(row.elapsedMs))
      .map(row => row.elapsedMs).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return [arm, values.length ? (values[middle] + values[Math.floor((values.length - 1) / 2)]) / 2 : null];
  }));
  const verdict = critical ? "regressed" : manifest.phase !== "paired" || !complete ? "insufficient evidence"
    : gains >= 2 && losses === 0 && latency.C1 <= latency.B0 * 1.2 ? "improved"
    : gains > 0 || latency.C1 > latency.B0 * 1.2 ? "mixed"
    : losses > 0 ? "regressed" : "no clear change";
  write(destination, { schemaVersion: 1, verdict, complete, scheduledResults, observedResults: results.length,
    gains, losses, critical, latency, families, errors: rows.filter(row => row.type === "error"),
    missingResults: observed.missing, dimensions: dimensions(results, cases),
    results: results.map(result => ({ id: result.id, arm: result.arm, repetition: result.repetition,
      condition: result.condition, index: result.index, status: result.status, issues: result.issues })) });
}

const [command, ...args] = process.argv.slice(2);
const stress = command === "validate-stress" || command === "freeze-stress" ||
  command === "run" && args[0] === "stress" ||
  command === "score" && read(path.join(args[0], "manifest.json")).phase === "stress";
const cases = stress ? stressCases : corpus();
verifyScorer();
if (command === "validate-stress") {
  assert.equal(args.length, 0);
  const jobs = schedule(cases, "stress");
  const requestCap = jobs.reduce((sum, job) => sum + (job.scenario.kind === "control" ? 0 :
    job.condition === "retained" ? job.scenario.turns.length : 1), 0);
  assert.equal(requestCap, 40);
  const expectedResults = coverage(jobs, []).scheduled;
  console.log(JSON.stringify({ cases: cases.length, corpusSha256: sha(JSON.stringify(cases)),
    requestCap, expectedResults, scorerSelfCheck: "passed", hostBundle: "not run", inferenceRequests: 0 }));
} else if (command === "freeze-stress") {
  assert.equal(args.length, 1);
  write(args[0], { schemaVersion: 1, split: "synthetic regression", corpusSha256: sha(JSON.stringify(cases)),
    cases, inferenceRequests: 0, independentHoldout: false });
} else if (command === "validate") {
  assert.equal(args.length, 0);
  await bundle(root);
  console.log(JSON.stringify({ schemaVersion: 1, cases: cases.length, corpusSha256: sha(JSON.stringify(cases)), scorerSelfCheck: "passed", hostBundle: "passed" }));
} else if (command === "run") await run(cases, args);
else if (command === "score") score(cases, args);
else throw new Error("Usage: iteration-benchmark.mjs validate | validate-stress | freeze-stress <new-file> | run <probe|paired|stress> <B0> <C1> <output-dir> <VS-Code-executable> | score <output-dir> <score.json>");
