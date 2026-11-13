# Design

## Context

See [proposal](proposal.md) for scope. Planning root is the original Piarre checkout; audited implementation is `0119a55cccc2b4cc199222351e4cfb5e7bf5daf2`. The planning checkout is older and contains unrelated untracked material. Apply must transfer only this change to a clean consolidated checkout, record its SHA and recheck changed source before editing. Do not restore old documentation from the planning checkout.

The source review traced three hypotheses, not runtime reproductions:

- `apps/vscode/src/extension.ts:150-190` publishes a repository before reconciliation; failure closes it while shared references remain, and a superseded continuation can install obsolete controllers.
- `execution-ui.ts:134-146` supplies a new operation ID even when `execution-coordinator.ts:352-365` expects the recorded integration ID for acceptance without publication.
- `work-view.ts:279-341` reuses panels while cache identity and action routing do not consistently identify the selected record and rendered document.

### Grounding and rationale

The extension selects a trusted local Git repository and composes its controllers. SQLite commits events and receipts atomically; core replay enforces authority and freshness. The coordinator reserves filesystem operations, uses existing source/candidate journal adapters, and records outcomes. Work and native dialogs request actions, but never grant durable authority themselves.

Keep these owners. Existing source history and tests justify separate provider, filesystem, recovery and acceptance states: a completed journal is not user acceptance, and interrupting a process is not proof of termination. Host instance identity is transient and distinct from durable project ID, event revision, result identity and operation ID. No glossary or ADR was found. External PR discussions, analytics and runtime failure frequency were not established; historical intent beyond the code and local history remains uncertain.

## Goals / Non-Goals

**Goals:** Concentrate resource ownership, reject stale work, restore the explicit acceptance path, and reduce duplicated pane mechanics and navigation noise. Preserve every archived original and all 21 acceptance mappings.

**Non-Goals:** No provider calls, new degraded-open product mode, schema or journal migration, automatic acceptance, general pane framework, generic lifecycle framework, broad controller rewrite, blanket Git-ignore changes, research rewrite, or claim of integrated product readiness. No tests merely checking shorter line counts.

## Decisions

### D1. Use four independently verifiable stages

1. Contributor navigation and document presentation, independently shippable.
2. Project lifetime correctness and private ownership consolidation.
3. Explicit review of recovered integration, then narrow duplication cleanup.
4. Detail record/document identity, then shared document mechanics.

Keep a verified commit boundary after each stage. Stage 4 uses Stage 2's instance identity and Stage 3's review binding. Stage 3 can be developed independently but must receive the current-instance guard before release. Do not mix correctness fixes with optional deletion before their behavioral tests are green.

### D2. Keep project ownership private in the composition root

Retain `extension.ts` as the composition root. Replace independent nullable controller globals with one current project scope and a separate opening attempt. Do not add a public owner dispatcher or move command handlers wholesale. Current scope owns resources; the attempt owns cancellation/currentness of selection and preparation. A pending picker does not erase a valid current project until a replacement root is selected.

Caller-first sketch, descriptive rather than executable code:

```ts
// Existing VS Code registrations remain recognizable.
registerOpen(() => requestOpen(true));
onWorkspaceChange(() => {
  invalidateAttempt();
  retireCurrent();
  void requestOpen(false);
});
onDeactivate(() => { disposed = true; invalidateAttempt(); retireCurrent(); });

// Native asynchronous handlers capture exactly one instance.
const scope = currentProject;
if (!scope) return;
const answer = await promptForRename(scope.repository.read());
if (!isCurrent(scope)) return;
// Existing domain validation and dispatch still apply.
```

Derived private shapes:

```ts
type ProjectPhase =
  | { kind: 'preparing' }
  | { kind: 'reconciling'; execution: ExecutionUi; coordinator: ExecutionCoordinator }
  | { kind: 'ready'; execution: ExecutionUi; coordinator: ExecutionCoordinator;
      controllers: ProjectControllers }
  | { kind: 'retired' };
type ProjectControllers = {
  coordination: CoordinationController; coordinationUi: CoordinationUi;
  conversation: ConversationController; reflection: ReflectionController;
  knowledge: KnowledgeController;
};
type ProjectScope = {
  readonly instance: symbol; readonly repositoryUri: string;
  readonly repository: SqliteProjectRepository;
  readonly cleanup: Array<() => void>; phase: ProjectPhase;
};
type OpenAttempt = { readonly identity: object; readonly interactive: boolean;
  readonly promise: Promise<void> };
function requestOpen(interactive: boolean): Promise<void> { throw new Error('not implemented'); }
function isCurrent(scope: ProjectScope): boolean { throw new Error('not implemented'); }
function retireCurrent(): void { throw new Error('not implemented'); }
function disposeScope(scope: ProjectScope): void { throw new Error('not implemented'); }
```

`currentProject`, the attempt, disposed flag and private phase are the only host ownership state. Derived currentness compares object identity and phase, not copied generation counters in multiple modules. No consumer imports the scope type. The sketches name existing domain classes; exact declarations remain internal to this file.

Register cleanup immediately upon each allocation, repository first so it closes last. Complete critical synchronous Work/execution/watcher setup, select that scope, show current Work and Stop/recovery controls, then await reconciliation. Guard freshness refresh and later controller construction by the same current scope. Do not wait for full reconciliation before exposing Stop. Unavailable ordinary controllers during reconciliation remain unavailable through existing guards, without inventing a degraded-open mode.

Failure before selection disposes only that attempt's resources. Failure after selection first withdraws that exact scope and its controls, then releases resources. An obsolete failure cannot clear or report over a newer scope. Every await that can publish, access a repository or display an error must recheck its captured owner. An old attempt's `finally` clears only itself, never a newer attempt.

Retirement marks the scope retired and detaches its Work/visit/status callbacks before cleanup. Cancel watcher/timer callbacks; dispose controllers while the DB is readable; close the DB last. Attempt every cleanup even if one throws. Keep the primary failure and report cleanup failures only for the relevant current operation. Make disposal idempotent. Coordinator disposal must become terminal even when a client, interrupt or snapshot read fails; preserve a last valid snapshot where late reads need it, reject retired writes, and let existing in-flight publication bookkeeping settle in its own `finally`. Do not erase durable uncertainty or claim remote termination.

Inventory continuation sites in rename, proposal, diagnostics, reflection, knowledge, coordination, conversation and execution. Preserve existing valid guards; add instance checks only where a continuation can cross retirement. Include callbacks that close Work, record visits, publish lookup results or update Stop. This is a bounded ownership repair, not a redesign of those controllers.

### D3. Bind native result review to explicit host data

Replace `applyAndAccept` with one host review/confirmation path and remove the old entry point after migrating every caller. The webview sends a request to review; it cannot provide the review binding or choose operation identity.

```ts
const review = coordinator.reviewResult(runId);
if (await confirmResult(review) && instanceCurrent() && originCurrent()) {
  await coordinator.confirmResult(review.binding);
}

type ReviewEvidence = Readonly<{
  planId: string; planRevision: number; resultManifestHash: string;
  sourceManifestHash: string; candidateManifestHash: string;
  checksFingerprint: string;
}>;
type ResultBinding = Readonly<{
  runId: string; resultId: string; resultRevision: number;
  evidence: ReviewEvidence;
} & (
  | { kind: 'publish' }
  | { kind: 'accept-existing'; operationId: string }
)>;
// Host-only projection, never serialized into webview IPC.
type ResultReview = { readonly binding: ResultBinding;
  readonly inspection: ResultInspection };
class ExecutionCoordinator {
  reviewResult(runId: string): ResultReview { throw new Error('not implemented'); }
  confirmResult(binding: ResultBinding): Promise<ExecutionRun> { throw new Error('not implemented'); }
}
```

Use existing plan/result/check domain identities in implementation; the sketch summarizes their required content. `checksFingerprint` derives deterministically from applicable criterion-bound check records and coverage, including their IDs, outcome and candidate binding. Exclude unrelated project revisions. Test relevant check replacement with unchanged file hashes. It is reviewed evidence, not a replacement authority store.

Fresh mode uses an internally allocated operation ID and existing reservation, publication, checkpoint and completion transitions. The modal explicitly authorizes apply and acceptance. Existing mode binds the stored integration operation and asks only for acceptance. It must not call source publication, create a new checkpoint or append another integration event. A publish review cannot silently become acceptance-only if another actor integrates while its modal is open; require fresh review.

After confirmation compare exact result, operation and mode, current plan/dependency freshness, passing applicable checks, scoped dirty editors, and current source/candidate manifests. Use existing synchronous read/dispatch and SQLite expected revision checks after the last validation. Both paths use the same final acceptance validation. Reconciliation itself only records integration.

An exact already-accepted result/operation returns its recorded outcome without effects before checking newer file contents. This is an idempotent replay, not re-verification of those contents. Any first acceptance receives full checks. Concurrent confirmations must resolve through existing durable operation/receipt rules without duplicate publication or acceptance events.

Keep source/candidate adapter authority rules and journal encoding intact. Remove coordinator `previewRestore`/`restore` only after a current caller inventory confirms no production use and meaningful direct tests have moved to the production recovery path or appropriate adapter contract. Keep historical restore events and restart support. If that proof fails, retain the methods and record why; deletion is conditional cleanup, not a correctness requirement.

After that decision, share only truly identical begin/end publication bookkeeping privately in the coordinator if duplicated sites remain. Do not introduce a generic reservation/recovery callback framework. Retain operation-specific failure and unknown handling at their current owner.

### D4. Separate record identity, document identity and action authority

Record identity includes project instance, durable project and proposal group or run. Reading state uses record identity and stable disclosure/action keys. Rendered document identity rotates when content or record changes. Cache equality includes record and content. This prevents equal-looking proposals from reusing the wrong identity while preserving same-record reading state.

```ts
type DetailRecord = Readonly<{ instanceKey: string; projectId: string } &
  ({ kind: 'proposal'; groupId: string } | { kind: 'run'; runId: string })>;
type DetailRequest =
  | { kind: 'delete-proposal'; groupId: string }
  | { kind: 'execution'; message: ExecutionMessage };
type DetailDocument = Readonly<{
  record: DetailRecord; documentId: string; html: string;
  controls: ReadonlyMap<string, DetailRequest>;
}>;
// Pane record creation remains in WorkView.
const document = renderSelectedDetail(snapshot, selection);
presentDetail(document);
const request = readDetailRequest(raw, currentDocument);
if (request) await deliver(request, originCurrent);
function readDetailRequest(raw: unknown, current: DetailDocument): DetailRequest | undefined {
  throw new Error('not implemented');
}
```

Assign a stable serializable key to each host instance, rather than serializing its private symbol. Generate control keys and their host action lookup from the same render decisions as the enabled buttons. Do not maintain a separate hand-synced permission list. Parse untrusted messages against current panel, record, document ID and rendered control key before native confirmation. Deny forged targets and unsupported global actions even with a current document ID. Do not treat the token as a substitute for domain checks.

Keep the initiating selection guard through native dialogs and into ExecutionUi/RecoveryUi continuations. A superseded document cannot originate a request. A valid request already under review can survive an unrelated progress render only if the same instance/record, control semantics and reviewed evidence remain valid; a selection or relevant evidence change invalidates it. Proposal deletion retains the captured project revision and group through confirmation.

Use `detail-document.ts` only for common CSP/nonce envelope, escaping, click-envelope and reading-state mechanics. WorkView keeps proposal/run markup, selection and disposal policy. Preserve proposal reduced motion and stable task/criterion disclosure keys; preserve run file/check disclosures and action-target focus. Where controls repeat, include region/occurrence identity in focus keys. Main Work partial rendering and private unsent text remain unchanged. Do not introduce a generic pane manager.

### D5. Reduce navigation noise without removing evidence

Proposed workspace `files.exclude` patterns are `**/node_modules`, `**/dist`, `**/dist-test`, `**/dist-package`, `**/.vscode-test`, `.artifacts`, `**/*.vsix`, and `**/*.tsbuildinfo`. Use only `openspec/changes/archive/**/sources/**` in `search.exclude`. Do not add archive sources to Git ignore or change tracked files, watcher exclusions, packaging or agent access. Leave `.agents`, active specs, archive indexes, tests, `.github/designs` and `.audit` discoverable. Users can opt into hiding historical design/audit folders separately.

Remove only `openspec/specs/.gitkeep` and `openspec/changes/archive/.gitkeep` after verifying they remain empty and their parents populated. Keep only active YAML configuration, currently `schema: spec-driven`; preserve any new real settings found at Apply.

Wrap existing README release policy, candidate recovery/platform detail and diagnostic options in named collapsible sections. Keep install/F5 entry instructions and links visible. Do not rewrite command blocks or remove safety qualifications. Compare original text after stripping only added wrapper markup. Add a concise anchor index before the existing principles body, leaving that body unchanged. Keep overview, workflow and dated research unchanged. Never modify archived source bytes, manifests or catalog meaning to make validation pass.

### D6. Arena synthesis and red-flag screen

Two independent Architect candidates used GPT-6.1 Sol and GPT-6 Astra. A kept ownership private in the extension and coordinator; B introduced an explicit project owner with a public command dispatcher. Both considered both whole shapes. An independent Astra judge scored them as follows; these are qualitative design scores, not measured outcomes.

| Criterion, 0–5 | A | B |
| --- | ---: | ---: |
| Ownership, authority, preservation | 5 | 5 |
| Failure behavior and complete sketches | 4 | 3 |
| Interface depth without speculative indirection | 4 | 3 |
| Behavioral verification and evidence limits | 5 | 5 |
| Staging, rollback and baseline handoff | 3 | 3 |
| Total | 21 | 19 |

Base: A. The parent initially favored B's explicit owner, then accepted the judge's objection that its undefined broad ports and new dispatcher could relocate rather than hide complexity. A provides one private composition owner without a new framework.

Grafts from B: publish critical controls before delayed reconciliation while tracking partial acquisition; bind the precise reviewed plan/check/files/operation evidence using explicit private types instead of a WeakMap registry; transfer only the new change to the clean baseline. Both candidates omitted concrete rollback boundaries; this synthesis adds them below. Keep A's origin checks through native prompts.

Rejected: B's broad host-port/command dispatcher and opaque WeakMap review registry, a publication lifecycle module, generic pane manager, and removal of historical content. No dropouts. Split ownership is removed by eliminating old globals and old review entry points in the same stage. Shared helpers must delete repeated behavior, not add pass-through methods. Rendering supplies one source for enabled controls and routing. Preparation/reconciliation/retirement stay within the same private owner rather than separate phase modules.

Final independent synthesis check: PASS. The cross-judge confirmed the required revisions landed and proposal, deltas, design and tasks align. This is planning review, not runtime verification.

## Verification plan

This is the canonical plan; tasks link here. Each correctness test must first demonstrate the intended failure on the relevant baseline, then pass after its minimal fix. Do one vertical red/green slice at a time, followed by refactoring. If the hypothesis does not reproduce, record the counterexample and revise that slice; do not manufacture a failure or call source inspection a red run.

Record for every result: V ID, baseline and tested full SHA, dirty state, OS, Node and VS Code versions, exact command or UI steps, named test/assertion, outcome and evidence path. Use passed/failed/blocked/unverified explicitly. Keep generated logs/screenshots in `.artifacts`, with committed concise result references added during Apply. No result is currently marked passed.

| ID | Behavioral proof | Method and pass oracle |
| --- | --- | --- |
| V01 | Correct baseline and plan transfer | New issue-linked clean branch contains consolidated docs/archive plus only this planning change; record actual SHA. Recheck relevant source differences from audit SHA before building. No unrelated untracked files transferred. |
| V02 | No documentation loss | Compare pre/post hashes for all 26 snapshots, research, acceptance provenance fixtures and archive manifests; run the existing archive verifier. All 21 catalog requirement/owner/verification mappings unchanged. Strip added README wrappers and principles index to recover original text exactly; check rendered folds, command blocks and all local links. |
| V03 | Reversible editor visibility | In actual VS Code Explorer/Search, generated files are hidden, ordinary sources/tests/active specs/skills/indexes visible, and snapshot duplicate matches excluded. Disable exclusions and explicitly search history to recover those results. Verify Git tracking and package allowlists unchanged. |
| V04 | Failed opening is retryable | Extend activation coverage with missing capture and injected later-setup failure. Assert current controls withdrawn, all acquired resources retired once and DB closed last. Repair cause and retry same root; then select another root. No reload required, no visit writes through retired handles, no durable history loss. |
| V05 | Obsolete completion is inert | Deterministic deferred reconciliation A; select B then release A success and failure. Repeat with same-root reopening and extension disposal. Assert B's commands, Work, lookup, visits, status and errors unaffected. Attempt cleanup that throws and prove remaining disposers and DB close still run. No timing sleeps as the oracle. |
| V06 | Stop and uncertainty survive | While reconciliation/publication is deferred, actual Work/Stop/recovery controls remain available. Preserve pending owner, late provider rejection and journal replay tests. Restricted workspace still creates no DB. No replacement execution from disposal alone. |
| V07 | Recovered result can be explicitly accepted | Complete real source-changing publication, interrupt before acceptance, reopen and reconcile. Actual review action plus native confirmation accepts exact original operation/result. Assert initially unreviewed, one source publication, one checkpoint, unchanged journal inventory and one acceptance event. Cancellation changes nothing; exact replay has no effects even after later file edits. |
| V08 | Current evidence remains mandatory | Dirty editor, source drift, candidate drift, replaced result, altered applicable checks and relevant evidence changes during modal each block first acceptance. A publish review that becomes integrated requires fresh review. Parallel confirmations cannot publish/accept twice. No unrelated files modified. |
| V09 | Recovery compatibility and bounded deletion | Run actual production recovery and adapter tests before deleting test-only methods; prove no production callers remain. Reopen historical restore events/receipts; live owner blocks replay, corrupt or mismatched journal blocks application, newer bytes remain recoverable. If removal is unjustified, retain methods with explicit evidence. |
| V10 | Detail identity and action authority | Actual rendered proposal/run controls: switch equal-looking records, reopen same project, replay old-document messages, forge current-document action/target, change selection during dialog, dispose pane. No stale request prompts or mutates; positive Delete path confirms named target and retains history. Exercise execution and recovery native prompts too. |
| V11 | Reading and draft state | Same-record refresh retains valid scroll/disclosures/focus including repeated controls; different record resets state. Main Work unsent text never reaches persisted/project/provider data and survives ordinary progress. Stop stays responsive; proposal close still clears its selection marker. |
| V12 | Integrated regression and review | Lint/typecheck/build/package, contracts, trusted and restricted Host suites, existing SQLite receipt/replay tests and strict OpenSpec validation pass. Independently review current diff and affected callers, resolve findings and rerun affected checks. Report human journey evidence separately; pending live-account criteria remain pending. |

### Commands and test locations

From the implementation checkout, use the installed OpenSpec executable if it is not on PATH:

```sh
npm ci
npm run test:contract
npm run typecheck
npm run check
PIARRE_GUI_TESTS=1 npm run test:smoke --workspace apps/vscode
python3 openspec/changes/archive/2026-11-13-legacy-documentation/capture-baseline.py --code . --documentation-root .
openspec validate 2026-11-13-070324-simplify-project-lifecycle-and-navigation --strict
git diff --check
```

On headless Linux use `xvfb-run -a npm run test:smoke --workspace apps/vscode`. Local macOS Host runs open windows; choose a GUI-capable environment explicitly during Apply. Missing GUI/platform prerequisites are blocked evidence, not passes. No live model or provider spending is required. `npm run check` includes packaging; avoid duplicating it without new changes.

Existing Host runner has no grep environment filter. The following are test ownership pointers, not invented filtered commands: `activation.test.ts`, `untrusted.test.ts`, `project.test.ts`, `execution-coordinator.test.ts`, `execution-state.test.ts`, `workspace-integration.test.ts`, `recovery.test.ts`, `recovery-host.test.ts`, `workspace.test.ts`, `agent-workspace.test.ts`, and `execution-view.test.ts`, under `apps/vscode/test/suite/`. Use deterministic internal dependency seams for controlled failures plus the real Host and SQLite paths. Do not export test-only production commands.

Optional `npm run test:acceptance -- --scope=candidate --preview` checks document resolution only; its unverified status/nonzero outcome is expected. It cannot satisfy these behavioral criteria or the 17 retained pending product criteria. Strict OpenSpec validation likewise proves artifact structure only.

## Migration Plan

Create or identify a new feature issue before implementation, use `codex/<issue>-<slug>`, and link delivery evidence. Capture the clean baseline and documentation hashes. Apply each stage with all callers migrated before deleting old code; no dual runtime switch. Record verified stage commits and review each separately. Do not merge or archive merely because artifact validation passes.

Rollback Stage 1 by reverting only settings and presentation edits, restoring placeholders if needed. Immutable snapshots never change. Roll back Stage 2 or 4 as a whole code stage to avoid mixed ownership or message protocols. Roll back Stage 3 code only after pausing/reconciling affected work; preserve all DB events, journals, checkpoints and actual source changes. Reverting code is not undoing a publication or acceptance. No schema downgrade or force-rewriting history is needed. Re-run affected tests and preservation checks after a rollback. Pending work and verification evidence remain truthful.

## Risks / Trade-offs

- Source-derived failures may differ on a newer baseline. Reproduce first, then update this plan if the premise changes.
- Partial setup makes cleanup ordering important. Immediate registration, detached ownership and throwing-disposer tests make it explicit.
- Broad lifetime extraction could turn cleanup into a redesign. Keep the scope private and repair only continuations that can cross retirement.
- Overly strict document identity could reject Stop during ordinary progress. Separate incoming-message validity from the validity of an already-reviewed semantic action.
- Shared view mechanics could alter accessibility or focus. Keep per-pane policies and verify actual webviews.
- Fewer visible files do not imply smaller packages or lower agent token usage. No such savings are claimed.
