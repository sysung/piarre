import { randomUUID } from "node:crypto";
import { existsSync, lstatSync } from "node:fs";
import path from "node:path";
import type { ExecutionRun } from "../../../packages/core/src/execution.js";
import { unresolvedRecoveryOperation, type RecoverySelection, type SavedVersion } from "../../../packages/core/src/recovery.js";
import { digest, imageChanges, imageHash, parseImages, parseJournal, readImage, readRecord, replayJournal, writeRecord, type FileImage, type JournalResult } from "./candidate-journal.js";
import { checkEscrowLayout, publicationParents, retainedEscrowDirectories } from "./scoped-publication.js";

export interface RecoveryPreview {
  readonly supersedes: string | null; readonly previewId: string; readonly runId: string; readonly projectRevision: number; readonly selection: RecoverySelection;
  readonly parentIdentities: readonly (readonly import("./scoped-publication.js").ParentIdentity[])[];
  readonly bindingHash: string; readonly currentManifestHash: string; readonly intendedManifestHash: string;
  readonly current: readonly FileImage[]; readonly intended: readonly FileImage[];
  readonly states: readonly { readonly relativePath: string; readonly kind: "before" | "after" | "diverged" | "snapshot" | "unavailable" }[];
  readonly blockers: readonly string[];
}
export type VersionInspection = { readonly version: SavedVersion; readonly kind: "available"; readonly images: readonly FileImage[] }
  | { readonly version: SavedVersion; readonly kind: "unavailable"; readonly reason: string };
function validateCapture(run: ExecutionRun): unknown {
  const capture = readRecord(run.grant.plan.controlDirectory, "capture.json");
  if (typeof capture !== "object" || capture === null || !("sourceRoot" in capture) || capture.sourceRoot !== run.grant.plan.sourceRoot || !("root" in capture) || capture.root !== run.grant.plan.candidateRoot || !("files" in capture) || digest(JSON.stringify({ sourceRoot: capture.sourceRoot, root: capture.root, files: capture.files })) !== run.grant.plan.captureHash) throw new Error("Saved capture identity differs from this run.");
  return capture;
}
function scope(run: ExecutionRun, images: readonly FileImage[]): readonly FileImage[] {
  if (images.length !== run.grant.plan.files.length || images.some((image, index) => image.relativePath !== run.grant.plan.files[index]?.relativePath)) throw new Error("Saved version scope differs from the approved files.");
  return images;
}
export function recoveryRoot(run: ExecutionRun, target: "source" | "candidate"): string { return target === "source" ? run.grant.plan.sourceRoot : run.grant.plan.candidateRoot; }
function journalFilename(run: ExecutionRun, selection: Extract<RecoverySelection, { kind: "journal" }>): string {
  return run.recoveries.some(record => record.operationId === selection.operationId) ? `recovery-journal-${digest(selection.operationId)}.json`
    : `${selection.target === "source" ? "integration-" : ""}journal-${digest(selection.operationId)}.json`;
}
export function currentImages(run: ExecutionRun, target: "source" | "candidate"): readonly FileImage[] {
  return run.grant.plan.files.map(file => readImage(recoveryRoot(run, target), file.relativePath));
}
function inspectImages(run: ExecutionRun, target: "source" | "candidate") {
  const unavailable: string[] = []; const reasons: string[] = [];
  const images = run.grant.plan.files.map((file): FileImage => {
    try { return readImage(recoveryRoot(run, target), file.relativePath); }
    catch (error) { unavailable.push(file.relativePath); reasons.push(`${target}/${file.relativePath}: ${error instanceof Error ? error.message : "current image unavailable"}`); return { relativePath: file.relativePath, content: null, mode: null }; }
  });
  return { images, unavailable, reasons };
}
function checkpointFilename(version: SavedVersion): string {
  return version.purpose === "retained-entry" ? `recovery-retained-${digest(version.checkpointId)}.json` : version.purpose === "preserved-before-recovery" ? `recovery-before-${digest(version.operationId)}.json`
    : `${version.target === "source" ? "integration-" : ""}checkpoint-${digest(version.checkpointId)}.json`;
}
export function inspectVersion(run: ExecutionRun, version: SavedVersion): VersionInspection {
  try {
    validateCapture(run);
    if (version.captureHash !== run.grant.plan.captureHash) throw new Error("Version capture identity differs.");
    const images = scope(run, parseImages(readRecord(run.grant.plan.controlDirectory, checkpointFilename(version))));
    if (imageHash(images) !== version.manifestHash) throw new Error("Saved version checksum differs.");
    return { version, kind: "available", images };
  } catch (error) { return { version, kind: "unavailable", reason: error instanceof Error ? error.message : "Saved version unavailable" }; }
}
export type RetainedInspection = { readonly kind: "available"; readonly path: string; readonly content: string; readonly mode: number; readonly target: "source" | "candidate"; readonly relativePath: string; readonly operationId: string; readonly entryKey: string; readonly status: string }
  | { readonly kind: "unavailable"; readonly path: string; readonly status: string };
export function inspectRetainedInodes(run: ExecutionRun): readonly RetainedInspection[] {
  const operations = [
    { operationId: `patch:${run.runId}`, target: "candidate" as const, filename: `journal-${digest(`patch:${run.runId}`)}.json` },
    ...run.savedVersions.filter(version => version.purpose !== "baseline" && version.purpose !== "preserved-before-recovery" && version.purpose !== "retained-entry").map(version => ({ operationId: version.operationId, target: version.target, filename: `${version.target === "source" ? "integration-" : ""}journal-${digest(version.operationId)}.json` })),
    ...run.recoveries.map(record => ({ operationId: record.operationId, target: record.selection.target, filename: `recovery-journal-${digest(record.operationId)}.json` })),
  ];
  return retainedEscrowDirectories(run.grant.plan.controlDirectory).flatMap((directory): readonly RetainedInspection[] => {
    try {
      const intent = readRecord(directory, "intent.json");
      if (typeof intent !== "object" || intent === null || !("root" in intent) || !("control" in intent) || intent.control !== run.grant.plan.controlDirectory || !("change" in intent) || !("key" in intent) || typeof intent.key !== "string") return [];
      const step = parseJournal({ commandId: "inspection", completed: false, changes: [intent.change] }).changes[0];
      if (!step || !run.grant.plan.files.some(file => file.relativePath === step.relativePath)) return [];
      const operation = operations.find(operation => {
        if (intent.root !== recoveryRoot(run, operation.target)) return false;
        try {
          const journal = parseJournal(readRecord(run.grant.plan.controlDirectory, operation.filename));
          return journal.commandId === operation.operationId && journal.changes.some((change, index) => digest(`${operation.filename}:${String(index)}`) === intent.key && JSON.stringify(change) === JSON.stringify(step));
        } catch { return false; }
      });
      if (!operation || path.basename(directory) !== `escrow-${intent.key}`) return [];
      const image = readImage(directory, "displaced");
      return image.content === null || image.mode === null ? [] : [{ kind: "available", path: path.join(directory, "displaced"), content: image.content, mode: image.mode, target: operation.target, relativePath: step.relativePath, operationId: operation.operationId, entryKey: intent.key, status: "Retained original inode; an earlier open file descriptor may still change these bytes. No automatic deletion. A restore review captures the currently inspected bytes as a separate saved version." }];
    } catch { return [{ kind: "unavailable", path: directory, status: "Retained entry unavailable or changed during inspection; inspect again. No automatic deletion." }]; }
  });
}
export function captureRetainedVersion(run: ExecutionRun, entryKey: string, commandId: string) {
  const entry = inspectRetainedInodes(run).find(entry => entry.kind === "available" && entry.entryKey === entryKey);
  if (!entry || entry.kind !== "available") throw new Error("Retained entry is unavailable or not bound to a recorded operation.");
  const images = currentImages(run, entry.target).map(image => image.relativePath === entry.relativePath ? { relativePath: image.relativePath, content: entry.content, mode: entry.mode } : image);
  const filename = `recovery-retained-${digest(commandId)}.json`;
  if (existsSync(path.join(run.grant.plan.controlDirectory, filename))) throw new Error("Retained capture identity already exists.");
  writeRecord(run.grant.plan.controlDirectory, filename, images);
  if (imageHash(parseImages(readRecord(run.grant.plan.controlDirectory, filename))) !== imageHash(images)) throw new Error("Retained snapshot verification failed.");
  return { entry, manifestHash: imageHash(images) };
}

function parentIdentities(run: ExecutionRun, target: "source" | "candidate"): readonly unknown[] {
  const root = recoveryRoot(run, target);
  return run.grant.plan.files.map(file => {
    const parents = [root]; let cursor = root;
    for (const part of file.relativePath.split("/").slice(0, -1)) { cursor = path.join(cursor, part); parents.push(cursor); }
    return parents.map(parent => { if (!existsSync(parent)) return [parent, "absent"]; const s = lstatSync(parent); if (!s.isDirectory() || s.isSymbolicLink()) throw new Error("Recovery parent is not an ordinary directory."); return [parent, s.dev, s.ino]; });
  });
}
export function previewRecoveryFiles(run: ExecutionRun, selection: RecoverySelection, projectRevision: number, blockers: readonly string[] = []): RecoveryPreview {
  const control = run.grant.plan.controlDirectory;
  const capture = validateCapture(run);
  const inspectedCurrent = inspectImages(run, selection.target);
  const current = inspectedCurrent.images;
  let intended: readonly FileImage[]; let selectedRecord: unknown;
  let states: RecoveryPreview["states"];
  if (selection.kind === "snapshot") {
    const version = run.savedVersions.find(version => version.versionId === selection.versionId && version.target === selection.target);
    if (!version) throw new Error("Saved version is not registered to this run and target.");
    const inspected = inspectVersion(run, version);
    if (inspected.kind !== "available") throw new Error(inspected.reason);
    intended = inspected.images; selectedRecord = version;
    states = current.map(image => ({ relativePath: image.relativePath, kind: "snapshot" }));
  } else {
    const journal = parseJournal(readRecord(control, journalFilename(run, selection)));
    if (journal.commandId !== selection.operationId || journal.changes.some(change => !current.some(image => image.relativePath === change.relativePath))) throw new Error("Journal identity or scope differs.");
    selectedRecord = journal;
    intended = current.map(image => { const change = journal.changes.find(change => change.relativePath === image.relativePath); return change ? { relativePath: image.relativePath, content: change.after, mode: change.afterMode } : image; });
    states = current.map(image => { const change = journal.changes.find(change => change.relativePath === image.relativePath); return { relativePath: image.relativePath, kind: !change || (image.content === change.before && image.mode === change.beforeMode) ? "before" : image.content === change.after && image.mode === change.afterMode ? "after" : "diverged" }; });
  }
  states = states.map(state => inspectedCurrent.unavailable.includes(state.relativePath) ? { ...state, kind: "unavailable" } : state);
  const problems = [...blockers, ...inspectedCurrent.reasons];
  try { checkEscrowLayout(recoveryRoot(run, selection.target), control, run.grant.plan.files.map(file => file.relativePath)); } catch (error) { problems.push(error instanceof Error ? error.message : "Publication unavailable"); }
  let parents: readonly unknown[] = []; let capturedParents: RecoveryPreview["parentIdentities"] = [];
  try { parents = parentIdentities(run, selection.target); capturedParents = run.grant.plan.files.map(file => publicationParents(recoveryRoot(run, selection.target), file.relativePath)); }
  catch (error) { problems.push(error instanceof Error ? error.message : "Reviewed parent unavailable"); }
  const source = inspectImages(run, "source"); const candidate = inspectImages(run, "candidate");
  problems.push(...source.reasons, ...candidate.reasons);
  const bindingHash = digest(JSON.stringify({ capture, selectedRecord, parents, source, candidate }));
  return { supersedes: unresolvedRecoveryOperation(run)?.operationId ?? null, parentIdentities: capturedParents, previewId: randomUUID(), runId: run.runId, projectRevision, selection, bindingHash, currentManifestHash: imageHash(current), intendedManifestHash: imageHash(intended), current, intended, states, blockers: problems };
}
export function prepareRecoveryFiles(run: ExecutionRun, preview: RecoveryPreview, intendedPaths: readonly string[], operationId: string): readonly FileImage[] {
  const target = preview.current.map(image => intendedPaths.includes(image.relativePath) ? preview.intended.find(intended => intended.relativePath === image.relativePath) ?? image : image);
  const control = run.grant.plan.controlDirectory;
  const beforeName = `recovery-before-${digest(operationId)}.json`;
  const journalName = `recovery-journal-${digest(operationId)}.json`;
  if (existsSync(path.join(control, beforeName)) || existsSync(path.join(control, journalName))) throw new Error("Recovery identity is already prepared; use its existing receipt.");
  writeRecord(control, beforeName, preview.current);
  if (imageHash(scope(run, parseImages(readRecord(control, beforeName)))) !== preview.currentManifestHash) throw new Error("Preserved version failed verification; no target writes.");
  writeRecord(control, `recovery-target-${digest(operationId)}.json`, target);
  writeRecord(control, `recovery-scope-${digest(operationId)}.json`, { bindingHash: preview.bindingHash, parents: preview.parentIdentities });
  const changes = imageChanges(preview.current, target);
  writeRecord(control, journalName, { commandId: operationId, changes, completed: false, parents: changes.map(change => preview.parentIdentities[preview.current.findIndex(image => image.relativePath === change.relativePath)]) });
  return target;
}
export function replayRecoveryFiles(run: ExecutionRun, operationId: string): JournalResult {
  const record = run.recoveries.find(record => record.operationId === operationId);
  if (!record) throw new Error("Recovery authority unavailable.");
  const control = run.grant.plan.controlDirectory;
  const version = run.savedVersions.find(version => version.operationId === operationId && version.purpose === "preserved-before-recovery");
  if (!version || inspectVersion(run, version).kind !== "available") throw new Error("Registered preserved version unavailable; no target writes.");
  const target = scope(run, parseImages(readRecord(control, `recovery-target-${digest(operationId)}.json`)));
  if (imageHash(target) !== record.targetManifestHash) throw new Error("Reviewed recovery target changed.");
  const filename = `recovery-journal-${digest(operationId)}.json`;
  const journal = parseJournal(readRecord(control, filename));
  const before = scope(run, parseImages(readRecord(control, `recovery-before-${digest(operationId)}.json`)));
  if (journal.commandId !== operationId || JSON.stringify(journal.changes) !== JSON.stringify(imageChanges(before, target))) throw new Error("Reviewed recovery journal changed.");
  const identityRecord = readRecord(control, `recovery-scope-${digest(operationId)}.json`);
  if (typeof identityRecord !== "object" || identityRecord === null || !("bindingHash" in identityRecord) || identityRecord.bindingHash !== record.bindingHash || !("parents" in identityRecord) || !Array.isArray(identityRecord.parents) || identityRecord.parents.length !== before.length) throw new Error("Reviewed recovery directory identities unavailable.");
  const identityRows: readonly unknown[] = identityRecord.parents;
  if (digest(JSON.stringify(identityRows)) !== record.parentIdentityHash) throw new Error("Reviewed directory identity checksum differs.");
  const assertParents = () => {
    for (const [index, image] of before.entries()) {
      const actual = publicationParents(recoveryRoot(run, record.selection.target), image.relativePath);
      if (JSON.stringify(actual) === JSON.stringify(identityRows[index])) continue;
      // A previously absent parent may have been exclusively created by this journal's helper.
      const changeIndex = journal.changes.findIndex(change => change.relativePath === image.relativePath);
      if (changeIndex >= 0) {
        const key = digest(`${filename}:${String(changeIndex)}`);
        try {
          const intent = readRecord(path.join(control, `escrow-${key}`), "intent.json");
          if (typeof intent === "object" && intent !== null && "parents" in intent && JSON.stringify(actual) === JSON.stringify(intent.parents)) continue;
        } catch { /* No durable helper identity can establish ownership of the new directory. */ }
      }
      throw new Error("Reviewed recovery parent relocated or changed; replacement parent is untouched.");
    }
  };
  assertParents();
  for (const [index, image] of before.entries()) {
    const changeIndex = journal.changes.findIndex(change => change.relativePath === image.relativePath);
    if (changeIndex >= 0 && existsSync(path.join(control, `escrow-${digest(`${filename}:${String(changeIndex)}`)}`, "intent.json"))) continue;
    const actual = readImage(recoveryRoot(run, record.selection.target), image.relativePath); const intended = target[index];
    if (JSON.stringify(actual) !== JSON.stringify(image) && JSON.stringify(actual) !== JSON.stringify(intended)) throw new Error("Scoped bytes changed after review; no further writes.");
  }
  if (record.supersedes) writeRecord(control, `superseded-${digest(record.supersedes)}.json`, { successorId: operationId, previewId: record.previewId });
  const result = replayJournal({ root: recoveryRoot(run, record.selection.target), controlDirectory: control, filename, journal, snapshot: () => currentImages(run, record.selection.target) });
  assertParents();
  return result;
}
