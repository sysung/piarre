import { execFileSync } from "node:child_process";
import type { SuppliedSource } from "../../../packages/core/src/supplied-source.js";
import { createHash } from "node:crypto";
import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface RetrievalRecord {
  readonly projectId: string;
  readonly recordId: string;
  readonly revision: number;
  readonly text: string;
  readonly category: "business" | "decision";
  readonly standing: "observed" | "inferred" | "confirmed";
}
export interface RetrievalCoverage {
  readonly files: number;
  readonly records: number;
  readonly issues: readonly string[];
  readonly limitation: string;
}
export type RetrievalSource =
  | { readonly kind: "file"; readonly path: string; readonly startLine: number; readonly endLine: number }
  | { readonly kind: "record"; readonly recordId: string; readonly revision: number;
      readonly category: RetrievalRecord["category"]; readonly standing: RetrievalRecord["standing"] };
export interface RetrievalHit {
  readonly projectId: string;
  readonly source: RetrievalSource;
  readonly text: string;
  readonly contentHash: string;
  readonly method: "exact" | "fts5" | "compiler-reference";
}
export type RetrievalResult =
  | { readonly kind: "matched" | "no-match"; readonly hits: readonly RetrievalHit[]; readonly coverage: RetrievalCoverage }
  | { readonly kind: "stale" | "error"; readonly reason: string; readonly hits: readonly []; readonly coverage: RetrievalCoverage };

type IndexedSource = { readonly identity: string; readonly contentHash: string; readonly origin: RetrievalSource; readonly text: string };
const supported = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".md", ".json", ".yaml", ".yml", ".toml", ".tf", ".sql"]);
const excludedDirectories = new Set(["node_modules", "vendor", "dist", "dist-test", "dist-package", "coverage", "build"]);
const MAX_FILES = 500;
const MAX_BYTES = 2_000_000;
const MAX_FILE_BYTES = 100_000;
const MAX_RECORDS = 500;
const limitation = "Bounded literal and Unicode full-text lookup only; no semantic understanding, automatic contradiction resolution, runtime evidence, or complete dependency coverage. Hidden, secret-named, generated, unsupported and oversized files are excluded. Results are source excerpts, not verified facts.";
const hash = (text: string): string => createHash("sha256").update(text).digest("hex");

export class ProjectRetrieval {
  private readonly root: string;
  private readonly database: DatabaseSync;
  private sources: readonly IndexedSource[] = [];
  private coverage: RetrievalCoverage = { files: 0, records: 0, issues: ["Index has not been built."], limitation };
  private manifest = "";
  private ready = false;
  private closed = false;

  constructor(private readonly options: { readonly projectId: string; readonly root: string; readonly readRecords?: () => readonly RetrievalRecord[] }) {
    if (!options.projectId.trim() || !path.isAbsolute(options.root)) throw new Error("A project and absolute repository root are required.");
    this.root = realpathSync(options.root);
    if (!lstatSync(this.root).isDirectory()) throw new Error("Repository root must be a directory.");
    this.database = new DatabaseSync(":memory:");
    this.database.exec("CREATE VIRTUAL TABLE chunks USING fts5(text, tokenize='unicode61');");
  }

  private readFile(relative: string): string {
    if (path.isAbsolute(relative) || relative.split(path.sep).some(part => part === ".." || part.startsWith("."))) throw new Error("Unsafe retrieval path.");
    const absolute = path.join(this.root, relative);
    let cursor = this.root;
    for (const part of relative.split(path.sep)) {
      cursor = path.join(cursor, part);
      if (lstatSync(cursor).isSymbolicLink()) throw new Error("Symbolic links are excluded.");
    }
    if (!realpathSync(absolute).startsWith(this.root + path.sep)) throw new Error("Source is outside the repository.");
    const descriptor = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const before = fstatSync(descriptor);
      if (!before.isFile() || before.size > MAX_FILE_BYTES) throw new Error("Source is not a supported bounded file.");
      const bytes = readFileSync(descriptor);
      const text = bytes.toString("utf8");
      if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error("Unsupported source encoding.");
      const after = fstatSync(descriptor);
      if (before.mtimeMs !== after.mtimeMs || before.size !== after.size || before.mode !== after.mode || before.ino !== after.ino || before.dev !== after.dev || before.ctimeMs !== after.ctimeMs || !realpathSync(absolute).startsWith(this.root + path.sep)) throw new Error("Source changed during retrieval.");
      if (text.includes("\u0000") || /^(?:<<<<<<< |=======\s*$|>>>>>>> )/m.test(text)) throw new Error("Binary or conflicted source is excluded.");
      return text;
    } finally { closeSync(descriptor); }
  }

  private records(): readonly RetrievalRecord[] {
    const records = this.options.readRecords?.() ?? [];
    if (records.length > MAX_RECORDS) throw new Error("Knowledge record limit exceeded.");
    const identities = new Set<string>();
    for (const record of records) {
      if (record.projectId !== this.options.projectId || !record.recordId.trim() || !Number.isSafeInteger(record.revision) || record.revision < 1 || !record.text.trim() ||
          Buffer.byteLength(record.text) > MAX_FILE_BYTES || identities.has(record.recordId)) throw new Error("Invalid or duplicate authoritative record.");
      identities.add(record.recordId);
    }
    return records;
  }

  private scan(): { paths: string[]; issues: string[]; manifest: string } {
    const paths: string[] = [];
    const issues: string[] = [];
    const manifest: unknown[] = [];
    let entries = 0;
    const walk = (directory: string, depth: number): void => {
      const absolute = path.join(this.root, directory);
      const directoryStat = lstatSync(absolute);
      manifest.push([directory, directoryStat.mode, directoryStat.uid, directoryStat.gid, directoryStat.dev, directoryStat.ino, directoryStat.ctimeMs]);
      if (lstatSync(absolute).isSymbolicLink() || (directory && !realpathSync(absolute).startsWith(this.root + path.sep))) {
        issues.push(`Excluded unsafe directory: ${directory}`); manifest.push([directory, "unsafe"]); return;
      }
      if (depth > 12) { issues.push(`Directory depth limit: ${directory}`); return; }
      for (const entry of readdirSync(path.join(this.root, directory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (++entries > 5000) { issues.push("Directory entry limit reached; coverage is incomplete."); return; }
        const relative = path.join(directory, entry.name);
        if (entry.name.startsWith(".") || /(?:secret|credential|private[-_]?key|token|password)/i.test(entry.name)) continue;
        if (entry.isSymbolicLink()) { issues.push(`Excluded symbolic link: ${relative}`); manifest.push([relative, "symlink"]); continue; }
        if (entry.isDirectory()) { if (!excludedDirectories.has(entry.name)) walk(relative, depth + 1); continue; }
        if (!entry.isFile()) continue;
        const stat = lstatSync(path.join(this.root, relative));
        manifest.push([relative, stat.size, stat.mtimeMs, stat.mode, stat.uid, stat.gid, stat.dev, stat.ino, stat.ctimeMs]);
        if (!supported.has(path.extname(entry.name).toLowerCase())) { issues.push(`Unsupported source: ${relative}`); continue; }
        paths.push(relative);
      }
    };
    walk("", 0);
    return { paths, issues, manifest: JSON.stringify(manifest) };
  }

  rebuild(): RetrievalCoverage {
    if (this.closed) throw new Error("Retrieval index is closed.");
    this.ready = false;
    const sources: IndexedSource[] = [];
    const scanned = this.scan();
    const issues = [...scanned.issues];
    let files = 0;
    let bytes = 0;
    for (const relative of scanned.paths) {
      if (files >= MAX_FILES || bytes >= MAX_BYTES) { issues.push("Corpus limit reached; remaining sources are not indexed."); break; }
      try {
        const text = this.readFile(relative);
        if (bytes + Buffer.byteLength(text) > MAX_BYTES) { issues.push(`Corpus byte limit excludes: ${relative}`); continue; }
        const contentHash = hash(text);
        const lines = text.split(/\r?\n/);
        for (let start = 0; start < lines.length; start += 12) {
          sources.push({ identity: relative, contentHash, origin: { kind: "file", path: relative, startLine: start + 1, endLine: Math.min(start + 12, lines.length) }, text: lines.slice(start, start + 12).join("\n") });
        }
        files++; bytes += Buffer.byteLength(text);
      } catch { issues.push(`Unreadable, changed, conflicted, or oversized source: ${relative}`); }
    }
    const records = this.records();
    for (const record of records) sources.push({ identity: record.recordId, contentHash: hash(JSON.stringify(record)),
      origin: { kind: "record", recordId: record.recordId, revision: record.revision, category: record.category, standing: record.standing }, text: record.text });
    this.database.exec("BEGIN; DELETE FROM chunks;");
    try {
      const insert = this.database.prepare("INSERT INTO chunks(rowid,text) VALUES (?,?)");
      for (let index = 0; index < sources.length; index++) insert.run(index + 1, sources[index]?.text ?? "");
      this.database.exec("COMMIT");
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
    this.sources = sources;
    this.manifest = scanned.manifest;
    this.coverage = { files, records: records.length, issues: [...new Set(issues)].slice(0, 100), limitation };
    this.ready = true;
    return this.coverage;
  }

  search({ projectId, query, limit = 5 }: { readonly projectId: string; readonly query: string; readonly limit?: number }): RetrievalResult {
    if (projectId !== this.options.projectId) return { kind: "error", reason: "Retrieval project identity mismatch.", hits: [], coverage: this.coverage };
    if (this.closed || !this.ready) return { kind: "error", reason: "Retrieval index is unavailable; rebuild before searching.", hits: [], coverage: this.coverage };
    if (!query.trim() || query.length > 1000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 20) return { kind: "error", reason: "Enter a bounded query and result limit.", hits: [], coverage: this.coverage };
    try {
      if (this.scan().manifest !== this.manifest) return { kind: "stale", reason: "Workspace source inventory or metadata changed. Rebuild before reuse.", hits: [], coverage: this.coverage };
      const checked = new Map<string, string>();
      for (const source of this.sources) {
        if (source.origin.kind !== "file" || checked.has(source.identity)) continue;
        let currentHash: string;
        try { currentHash = hash(this.readFile(source.identity)); }
        catch { return { kind: "stale", reason: `Source is missing, inaccessible or unsafe: ${source.identity}. Rebuild before reuse.`, hits: [], coverage: this.coverage }; }
        if (currentHash !== source.contentHash) return { kind: "stale", reason: `Source changed: ${source.identity}. Rebuild before reuse.`, hits: [], coverage: this.coverage };
        checked.set(source.identity, currentHash);
      }
      const currentRecords = this.records();
      const indexedRecords = this.sources.filter(source => source.origin.kind === "record");
      if (currentRecords.length !== indexedRecords.length || indexedRecords.some(source => !currentRecords.some(record => record.recordId === source.identity && hash(JSON.stringify(record)) === source.contentHash))) {
        return { kind: "stale", reason: "Authoritative knowledge changed. Rebuild before reusing retrieved context.", hits: [], coverage: this.coverage };
      }
      const exact = this.sources.flatMap((source, index) => source.text.includes(query) || source.identity === query ? [index] : []);
      const terms = query.match(/[\p{L}\p{N}_]+/gu) ?? [];
      const rows = terms.length === 0 ? [] : this.database.prepare("SELECT rowid FROM chunks WHERE chunks MATCH ? ORDER BY bm25(chunks),rowid LIMIT ?")
        .all(terms.map(term => `"${term.replaceAll('"', '""')}"`).join(" AND "), limit);
      const fullText = rows.map(row => {
        if (typeof row.rowid !== "number" || !Number.isSafeInteger(row.rowid)) throw new Error("Invalid retrieval index row.");
        return row.rowid - 1;
      });
      const selected = [...new Set([...exact, ...fullText])].slice(0, limit);
      const hits: RetrievalHit[] = [];
      for (const index of selected) {
        const source = this.sources[index];
        if (!source) throw new Error("Retrieval index does not resolve to a source.");
        hits.push({ projectId, source: source.origin, text: source.text, contentHash: source.contentHash, method: exact.includes(index) ? "exact" : "fts5" });
      }
      return { kind: hits.length ? "matched" : "no-match", hits, coverage: this.coverage };
    } catch { return { kind: "error", reason: "Retrieval failed. No context may be inferred from this result.", hits: [], coverage: this.coverage }; }
  }

  captureFile(relative: string, revision: number, startLine = 1, endLine = 200): SuppliedSource {
    if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || startLine < 1 || endLine < startLine || endLine - startLine > 199) throw new Error("Choose at most 200 lines");
    const scan = this.scan();
    if (!scan.paths.includes(relative)) throw new Error("File is excluded from source context");
    const fullText = this.readFile(relative);
    const lines = fullText.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    const text = lines.slice(startLine - 1, endLine).join("");
    if (!text.trim() || Buffer.byteLength(text) > 10_000) throw new Error("Excerpt is empty or exceeds 10,000 UTF-8 bytes; select fewer lines");
    const contentHash = hash(fullText);
    return { text, reference: { kind: "file", projectId: this.options.projectId, recordId: `${relative}:${String(startLine)}:${String(Math.min(endLine, lines.length))}:${contentHash}`, revision,
      path: relative, startLine, endLine: Math.min(endLine, lines.length), contentHash, inventoryHash: hash(scan.manifest), excerptHash: hash(text), version: "worktree-at-capture", representation: { kind: "file-excerpt" } } };
  }

  captureDiff(relative: string, revision: number): SuppliedSource {
    const scan = this.scan();
    if (!scan.paths.includes(relative)) throw new Error("File is excluded from source context");
    const current = this.readFile(relative);
    const contentHash = hash(current);
    const git = (args: string[]): string => execFileSync("git", ["--no-replace-objects", "-c", "core.fsmonitor=false", ...args], { cwd: this.root, encoding: "utf8", timeout: 2000, maxBuffer: 100_000, stdio: ["ignore", "pipe", "pipe"] });
    const baseCommit = git(["rev-parse", "HEAD"]).trim();
    if (!/^[a-f0-9]{40,64}$/.test(baseCommit)) throw new Error("Git base unavailable");
    const original = git(["show", `${baseCommit}:${relative}`]);
    if (original === current) throw new Error("No current tracked change against HEAD");
    const lines = (text: string): string[] => text ? text.replace(/\n$/, "").split("\n") : [];
    const originalLines = lines(original);
    const currentLines = lines(current);
    const changes = (text: string, content: string[], prefix: string): string[] => [...content.map(line => `${prefix}${line}`), ...(text && !text.endsWith("\n") ? ["\\ No newline at end of file"] : [])];
    const text = [`diff --git ${JSON.stringify(`a/${relative}`)} ${JSON.stringify(`b/${relative}`)}`, `--- ${JSON.stringify(`a/${relative}`)}`, `+++ ${JSON.stringify(`b/${relative}`)}`,
      `@@ -${originalLines.length ? "1" : "0"},${String(originalLines.length)} +${currentLines.length ? "1" : "0"},${String(currentLines.length)} @@`, ...changes(original, originalLines, "-"), ...changes(current, currentLines, "+")].join("\n");
    if (!text.trim() || Buffer.byteLength(text) > 10_000 || text.split("\n").length > 200) throw new Error("No tracked diff or diff exceeds 200 lines / 10,000 UTF-8 bytes; choose a file excerpt");
    const endLine = text.split("\n").length;
    return { text, reference: { kind: "file", projectId: this.options.projectId, path: relative, revision, contentHash, inventoryHash: hash(scan.manifest), version: "worktree-at-capture", recordId: `${relative}:diff:${baseCommit}:${hash(text)}`, startLine: 1, endLine, excerptHash: hash(text), representation: { kind: "git-diff", baseCommit } } };
  }

  assertCapturedCurrent(sources: readonly SuppliedSource[]): void {
    const inventory = hash(this.scan().manifest);
    for (const source of sources) {
      const ref = source.reference;
      if (ref.kind !== "file") continue;
      if (ref.projectId !== this.options.projectId || ref.inventoryHash !== inventory || ref.excerptHash !== hash(source.text)) throw new Error("Captured source inventory, permissions or bytes changed; select and review fresh context");
      const current = ref.representation.kind === "git-diff" ? this.captureDiff(ref.path, ref.revision) : this.captureFile(ref.path, ref.revision, ref.startLine, ref.endLine);
      if (current.reference.kind !== "file" || current.reference.contentHash !== ref.contentHash || JSON.stringify(current.reference.representation) !== JSON.stringify(ref.representation) || current.text !== source.text) throw new Error("Captured source changed; select and review fresh context");
    }
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true; this.ready = false;
    this.database.close();
  }
}

export function lookupProjectSources(options: ConstructorParameters<typeof ProjectRetrieval>[0] & { readonly query: string }): RetrievalResult {
  let index: ProjectRetrieval | undefined;
  try {
    index = new ProjectRetrieval(options);
    index.rebuild();
    return index.search({ projectId: options.projectId, query: options.query });
  } catch {
    return { kind: "error", reason: "Project lookup could not build or read current sources. No context is available from this attempt.", hits: [],
      coverage: { files: 0, records: 0, issues: ["Current index unavailable; earlier results cannot be reused."], limitation } };
  } finally { index?.dispose(); }
}
