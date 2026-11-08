import { createHash } from "node:crypto";

export interface IntentRecord {
  readonly id: string;
  readonly topic: string;
  readonly category: "business" | "decision";
  readonly author: string;
  readonly statement: string;
  readonly rationale: string;
  readonly scope: string;
  readonly sources: string;
  readonly linkedTaskIds: readonly string[];
  readonly openQuestions: string;
}

export interface ReviewedIntentDocument {
  readonly path: string;
  readonly sha256: string;
  readonly markdown: string;
}

const identity = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,199}$/;
const format = /^# ([^\r\n]+)\n\nId: ([^\r\n]+)\nCategory: (business|decision)\nAuthor: ([^\r\n]+)\nLinked tasks: ([^\r\n]+)\n\n## Statement\n([\s\S]+?)\n\n## Rationale\n([\s\S]+?)\n\n## Scope\n([\s\S]+?)\n\n## Sources\n([\s\S]+?)\n\n## Open questions\n([\s\S]+)\n$/;
function invalid(): never { throw new Error("Invalid intent document"); }

export function intentDocumentPath(id: string): string {
  if (!identity.test(id)) invalid();
  return `docs/project-intent/${encodeURIComponent(id)}.md`;
}

export function intentDocumentHash(markdown: string): string {
  return createHash("sha256").update(markdown, "utf8").digest("hex");
}

export function parseIntentMarkdown(markdown: string): IntentRecord {
  if (typeof markdown !== "string" || Buffer.byteLength(markdown, "utf8") > 65_536) invalid();
  const match = format.exec(markdown);
  if (!match) invalid();
  const [, topic, id, category, author, linked, rawStatement, rawRationale, rawScope, rawSources, rawOpenQuestions] = match;
  if (!topic?.trim() || !id || !identity.test(id) || (category !== "business" && category !== "decision") || !author?.trim() || !linked ||
      !rawStatement || !rawRationale || !rawScope || !rawSources || !rawOpenQuestions) invalid();
  const section = (body: string): string => {
    const lines = body.split("\n");
    const quoted = lines.every(line => line.startsWith("> "));
    if (!quoted && (/^\s{0,3}#{1,6}(?:\s|$)/m.test(body) || /^\s*(?:Id|Category|Author|Linked tasks|Status):/im.test(body))) invalid();
    const decoded = quoted ? lines.map(line => line.slice(2)).join("\n") : body;
    if (!decoded.trim()) invalid();
    return decoded;
  };
  const statement = section(rawStatement);
  const rationale = section(rawRationale);
  const scope = section(rawScope);
  const sources = section(rawSources);
  const openQuestions = section(rawOpenQuestions);
  const linkedTaskIds = linked === "none" ? [] : linked.split(", ");
  if (linkedTaskIds.some(taskId => !identity.test(taskId)) || new Set(linkedTaskIds).size !== linkedTaskIds.length) invalid();
  return { id, topic, category, author, statement, rationale, scope, sources, linkedTaskIds, openQuestions };
}

export function renderIntentMarkdown(record: IntentRecord): string {
  const quote = (body: string): string => body.split("\n").map(line => `> ${line}`).join("\n");
  const markdown = `# ${record.topic}\n\nId: ${record.id}\nCategory: ${record.category}\nAuthor: ${record.author}\nLinked tasks: ${record.linkedTaskIds.length ? record.linkedTaskIds.join(", ") : "none"}\n\n## Statement\n${quote(record.statement)}\n\n## Rationale\n${quote(record.rationale)}\n\n## Scope\n${quote(record.scope)}\n\n## Sources\n${quote(record.sources)}\n\n## Open questions\n${quote(record.openQuestions)}\n`;
  parseIntentMarkdown(markdown);
  return markdown;
}

export function parseReviewedIntentDocument(value: unknown): ReviewedIntentDocument {
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.keys(value).length !== 3 || Object.keys(value).some(key => !["path", "sha256", "markdown"].includes(key)) ||
      !("path" in value) || !("sha256" in value) || !("markdown" in value) ||
      typeof value.path !== "string" || typeof value.sha256 !== "string" || typeof value.markdown !== "string") invalid();
  const record = parseIntentMarkdown(value.markdown);
  if (value.path !== intentDocumentPath(record.id) || value.sha256 !== intentDocumentHash(value.markdown)) invalid();
  return { path: value.path, sha256: value.sha256, markdown: value.markdown };
}
