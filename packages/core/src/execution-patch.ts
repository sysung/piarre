export type FileBaseline =
  | { readonly kind: "existing"; readonly fileId: string; readonly relativePath: string; readonly sha256: string; readonly bytes: number }
  | { readonly kind: "absent"; readonly fileId: string; readonly relativePath: string };

export type PatchOperation =
  | { readonly kind: "replace"; readonly baseline: Extract<FileBaseline, { kind: "existing" }>; readonly content: string }
  | { readonly kind: "create"; readonly baseline: Extract<FileBaseline, { kind: "absent" }>; readonly content: string }
  | { readonly kind: "delete"; readonly baseline: Extract<FileBaseline, { kind: "existing" }> };

export type PatchProposal =
  | { readonly kind: "change"; readonly summary: string; readonly operations: readonly [PatchOperation, ...PatchOperation[]] }
  | { readonly kind: "no-change"; readonly summary: string; readonly operations: readonly [] };

function invalid(): never { throw new Error("Invalid bounded patch proposal"); }
function object(value: unknown): value is object { return typeof value === "object" && value !== null && !Array.isArray(value); }
function keys(value: object, allowed: readonly string[]): boolean {
  return Object.keys(value).length === allowed.length && Object.keys(value).every(key => allowed.includes(key));
}

export function validateFileManifest(files: readonly FileBaseline[]): void {
  if (files.length < 1 || files.length > 20) invalid();
  const identities = new Set<string>();
  const paths = new Set<string>();
  let bytes = 0;
  for (const file of files) {
    if (!file.fileId.trim() || file.fileId.length > 128 || identities.has(file.fileId) || paths.has(file.relativePath) ||
        !file.relativePath || file.relativePath.startsWith("/") || /^[a-z]:/i.test(file.relativePath) || file.relativePath.includes("\\") || file.relativePath.includes("\u0000") ||
        file.relativePath.split("/").some(part => !part || part === "." || part === ".." || part === ".git" || part === ".piarre")) invalid();
    identities.add(file.fileId); paths.add(file.relativePath);
    if (file.kind === "existing") {
      if (!/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > 64_000) invalid();
      bytes += file.bytes;
    }
  }
  if (bytes > 256_000) invalid();
}

export function parsePatchProposal({ value, files }: { readonly value: unknown; readonly files: readonly FileBaseline[] }): PatchProposal {
  validateFileManifest(files);
  if (!object(value) || !keys(value, ["summary", "operations"]) || !("summary" in value) || !("operations" in value) ||
      typeof value.summary !== "string" || !value.summary.trim() || value.summary.length > 10_000 || !Array.isArray(value.operations) || value.operations.length > files.length) invalid();
  const ids = new Set<string>();
  let characters = 0;
  const operations = value.operations.map((item: unknown): PatchOperation => {
    if (!object(item) || !keys(item, ["fileId", "content"]) || !("fileId" in item) || !("content" in item) || typeof item.fileId !== "string" ||
        (typeof item.content !== "string" && item.content !== null) || ids.has(item.fileId)) invalid();
    const baseline = files.find(file => file.fileId === item.fileId);
    if (!baseline) invalid();
    ids.add(item.fileId);
    if (item.content === null) {
      if (baseline.kind !== "existing") invalid();
      return { kind: "delete", baseline };
    }
    characters += item.content.length;
    if (characters > 100_000 || item.content.includes("\u0000")) invalid();
    return baseline.kind === "existing" ? { kind: "replace", baseline, content: item.content } : { kind: "create", baseline, content: item.content };
  });
  const first = operations[0];
  return first ? { kind: "change", summary: value.summary, operations: [first, ...operations.slice(1)] }
    : { kind: "no-change", summary: value.summary, operations: [] };
}
