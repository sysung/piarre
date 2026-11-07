import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { readFileSync, appendFileSync, existsSync } from "node:fs";
assert(!existsSync("annotations.jsonl"), "Use a new run directory. Existing attempts must remain preserved.");
const corpus = JSON.parse(readFileSync("corpus.json"));
for (const source of corpus) {
 const input = { instruction: "Describe this passage for a search index. Write a short paraphrase and 8 to 12 common search keywords including alternative terms a reader may use. Preserve numbers, negation, conditions and uncertainty. Do not invent additional facts. This description will only locate the original passage.", passage: source.text };
 const start = performance.now();
 const response = await globalThis.fetch("http://model-runner.docker.internal/engines/v1/chat/completions", {
  method: "POST", headers: { "content-type": "application/json" }, signal: globalThis.AbortSignal.timeout(60_000),
  body: JSON.stringify({ model: "docker.io/ai/qwen3.5:4b-q6_K", messages: [{ role: "user", content: JSON.stringify(input) }],
   temperature: 0, stream: false, max_tokens: 512, chat_template_kwargs: { enable_thinking: false },
   response_format: { type: "json_schema", json_schema: { name: "index_context", strict: true, schema: {
    type: "object", properties: { description: { type: "string" }, keywords: { type: "array", items: { type: "string" }, minItems: 8, maxItems: 12 } },
    required: ["description","keywords"], additionalProperties: false } } },
  })
 });
 assert(response.ok, String(response.status));
 const reply = await response.json();
 assert(reply.model.includes("/bundles/sha256/ea484046efba5fc126b1b331c2d590a20cb7d3abdfc65366a7f8b547350cd629/model/"));
 assert.equal(reply.choices[0].finish_reason, "stop");
 const output = JSON.parse(reply.choices[0].message.content);
 appendFileSync("annotations.jsonl", JSON.stringify({ id: source.id, revision: source.revision, input, output, elapsedMs: Math.round(performance.now() - start), usage: reply.usage ?? null }) + "\n", { flag: "a" });
}
