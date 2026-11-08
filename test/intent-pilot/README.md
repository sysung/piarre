# Reviewed intent prototype trial

This prototype is an isolated engineering candidate. It has not established lower human effort or everyday readiness. The manual baseline and all human measurements remain pending until the owner performs them.

Start with [the manual baseline](BASELINE.md). Stop application work if ordinary Markdown meets the need comfortably. The five fixture documents are agent-authored proposals based on actual recorded Piarre choices; copying them does not adopt them. They make no claim to be original human-authored documents.

## Try the candidate in a separate profile

Build and package with `npm run check`. Use a disposable Piarre checkout, not your daily workspace. Install the generated VSIX into separate VS Code user-data and extensions directories. No model connection is needed. Do not reuse daily profile directories. Older Piarre builds cannot replay a history containing the new document-adoption event; keep this candidate profile separate rather than downgrading it in place.

```sh
code --user-data-dir /tmp/piarre-intent-user --extensions-dir /tmp/piarre-intent-extensions --install-extension apps/vscode/dist-package/piarre-0.0.1.vsix
code --user-data-dir /tmp/piarre-intent-user --extensions-dir /tmp/piarre-intent-extensions /path/to/disposable-piarre-checkout
```

1. Copy `test/intent-pilot/fixtures/*.md` into `docs/project-intent/` in that disposable checkout, or run **Piarre: Create Intent Document**. Open Piarre offline. Existing knowledge can instead be exported through **Piarre: Export Knowledge to Intent Document**, which creates a draft without overwriting files.
2. Read and edit a document. The prototype uses fixed metadata and named sections; generated section bodies are Markdown blockquotes so original headings and metadata-looking text remain reversible content. Unknown sources or rationale stay Unknown. The full document limit is 65,536 UTF-8 bytes.
3. Run **Piarre: Review Intent Document**. Inspect the old/new diff and exact proposed bytes. Cancel first and confirm nothing was adopted. Then explicitly adopt the reviewed version. Adoption does not approve coding work or independently verify the document's attribution claims.
4. Edit the working document again without adoption. Run **Piarre: Export Resumption Handoff**. Its preview must preserve the previous accepted version and clearly label the pending proposal. Saving creates a new snapshot file under `.piarre/handoffs`; it does not overwrite a previous handoff.
5. Adopt a material correction and inspect explicitly linked work. Prior revision-bound plans need review. Missing links never establish that other work is unaffected. A metadata-only legacy import does not fabricate correction impacts, but it changes knowledge provenance/revision, so plans explicitly bound to the older revision conservatively still need review.
6. Reopen Piarre and repeat the handoff in a fresh existing-agent session. The Markdown is a snapshot at a recorded project revision, not a live source of global truth. A fresh profile or clone must review imports rather than trust copied approval claims.

Accepted snapshots live under `.piarre/accepted` and are selected by transactional SQLite adoption history. The working file remains a proposal when its digest changes. A missing or changed accepted snapshot blocks export; the app never substitutes newer working bytes. Do not manually edit accepted snapshots. No automatic syncing, chat extraction, dependency inference, signatures or cross-device approval authentication is included.

## Engineering verification

`npm run check` and `npm run test:contract` cover build/package and repository boundaries. The new core and file-service suites also run in the native Extension Host. The dedicated native command suite is opt-in because it scripts native confirmation dialogs and creates synthetic records inside an isolated profile. It does not simulate a human usability verdict.

For the existing account-free Linux desktop container, run:

```sh
node scripts/verify-intent-prototype.mjs piarre-sandbox-piarre-1 /tmp/new-intent-proof-output
```

Use a new output directory. The runner copies built code into an owned container temporary directory, launches a separate native VS Code profile, checks cancellation/adoption/handoff commands, and inspects persisted events for exactly one adoption with zero execution, proposal or coordination events. It uses no provider credentials or model requests. Reports record source commit, dirty state, runtime hash, VS Code version and test results. A dirty result is developmental evidence; final acceptance needs the committed source version. Linux UI evidence does not establish macOS execution containment, which this slice does not change.

## Decision record

Record raw human times and errors in BASELINE.md or a private worksheet. Respect the 120-minute participation budget, including setup, updates, reading, review and correction. Compare plain Markdown plus the existing agent, OpenSpec plus that same agent, and this prototype with equivalent facts and distinct tasks. Record setup failures as incomplete comparison rather than competitor inferiority.

Continue only after observed lower total effort with no consequential lost constraints and voluntary preference in at least two genuine resumptions. Narrow to the handoff helper if that is the only benefit. Stop or use an existing workflow if it is easier. No interview, productivity result or pilot verdict has been recorded by the implementation itself.
