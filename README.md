# Piarre

Piarre is a centralized AI orchestrator for seeing, directing, and verifying agent work. Agent visibility is the primary product direction; typed discussion is a supporting tool and voice is deferred.

The implementation backlog lives in [GitHub Project 8](https://github.com/users/sysung/projects/8/views/1).

Start with the [project overview](docs/overview.md), [user design principles](docs/USER_DESIGN_PRINCIPLE.md), and [documentation workflow](docs/workflow.md). [OpenSpec contracts](openspec/specs/) describe intended behavior; [changes](openspec/changes/) record scoped plans, decisions, verification and history. GitHub issues track feasibility and delivery. Requirements do not establish implemented capabilities.

Code and documentation share this repository and Git revision. No separate documentation checkout or Store registration is required.

## Install a package

Open [GitHub Releases](https://github.com/sysung/piarre/releases), choose the build for the source commit you want, and download its `.vsix` asset. In VS Code, run **Extensions: Install from VSIX...** and select the file. Reload VS Code, open a trusted Git repository, and run **Piarre: Open**. The package requires VS Code 1.144.0 or later.

<details>
<summary>Release policy and build artifacts</summary>

Every successful master push publishes the exact tested VSIX, `build-info.json`, and `SHA256SUMS` as a regular GitHub Release. Tags use `build-<full-source-sha>`; no separate release branch or daily schedule is maintained. The VSIX keeps the extension manifest version, so compare source commits and checksums when choosing between builds with the same version. Concurrent builds do not automatically replace GitHub's Latest designation.

PR and master builds also retain the existing **piarre-vsix** Actions artifacts for 30 days. Downloading those artifacts requires signing in and unzipping them. Maintainers can run CI manually on master with **create_release** enabled, which is the default. Disable it for a checks-only manual run. Failed quality or installed-package tests block release. A retry can recover an incomplete upload; an already published build is left unchanged. Releases are staged as drafts only while assets upload, then published automatically. This workflow never publishes to the VS Code Marketplace or installs into daily use, and a package does not establish integrated-product readiness.

</details>

## Develop the extension

Use Node.js 22, as recorded in `.nvmrc`. A fresh checkout needs no global build tools:

```sh
nvm use
npm ci
npm run check
npm test
```

On headless Linux, run the smoke test with `xvfb-run -a npm test`.

To launch the extension manually, open this repository in VS Code, select **Run Piarre Extension**, and press F5. In the Extension Development Host, open the Command Palette and run **Piarre: Open**.

Open and trust a local Git repository in the development host. Piarre shows its Work tab with the project name, ID, and revision. **Piarre: Rename Project** changes the name. Reloading the window restores the project from its event log. Project data is stored in VS Code extension storage, outside the repository.

The Work panel also accepts a typed goal. **Review goal** prepares a deterministic draft without saving it. **Save proposal** records it; no coding work starts. Editing or discarding a preview invalidates it. Unsent text stays in the panel and is lost when the panel closes.

Saved goals appear newest first as compact cards. Choose **Open proposal** to inspect one in a reusable VS Code pane beside Work. Opening a saved proposal does not save, approve, or run anything.

Use **Delete goal** on a saved card or **Delete goal and proposal** in its detail pane to remove that goal and its proposed tasks after confirmation. Repository files and prior project history are retained.

## Try an isolated candidate

Candidate packages have extension ID `sysung.piarre-candidate`. The daily package keeps `sysung.piarre`. CI produces a separate **piarre-candidate** Actions artifact with its own build information and checksums. It expires after seven days. This does not add a release schedule or change automatic master releases. A package and automated tests do not establish live-account user acceptance.

Build and test locally with `npm run check`, `npm run package:candidate`, and `npm run test:candidate`. Set `PIARRE_PACKAGE_CHANNEL=candidate` when running `npm run test:package --workspace apps/vscode` to test installation and activation of the candidate VSIX. The process lifecycle tests require OS process inspection permission. On headless Linux, use `xvfb-run -a` for package tests.

Use a dedicated short directory outside your repositories. The launcher creates fresh VS Code settings and extension storage, without copying a daily profile or credentials. Candidate settings disable application/extension updates, telemetry and built-in AI features. On macOS, `PIARRE_CODE` must point to the app's `Contents/MacOS/Code` executable. On Linux, use the VS Code executable. Launch/stop automation currently supports macOS and Linux.

```sh
PIARRE_CODE='/path/to/Visual Studio Code.app/Contents/MacOS/Code'
PIARRE_TEST_DIR='/tmp/piarre-my-candidate'
npm run candidate -- prepare --directory "$PIARRE_TEST_DIR" --code "$PIARRE_CODE" --vsix apps/vscode/dist-package/candidate/piarre-candidate-0.0.1.vsix
npm run candidate -- fixture --directory "$PIARRE_TEST_DIR"
npm run candidate -- launch --directory "$PIARRE_TEST_DIR" --code "$PIARRE_CODE"
npm run candidate -- status --directory "$PIARRE_TEST_DIR"
npm run candidate -- stop --directory "$PIARRE_TEST_DIR"
```

The default launch opens a separate, committed counter repository with an executable `node --test` check. Trust that fixture in the candidate window and run **Piarre: Open**. Create a proposal and inspect its owner, state and evidence there. The window title says **Piarre Candidate**. Then stop the candidate and launch again with `--repository /path/to/piarre` to exercise Piarre's own improvement workflow. Provider connection, model spending and code execution still require their normal explicit actions and approvals. The launcher does not test a real account or start a model call.

<details>
<summary>Candidate recovery and platform details</summary>

To recover from a bad candidate, stop it first, then run `npm run candidate -- reset --directory "$PIARRE_TEST_DIR"`. Reset verifies removal of only the owned candidate's user-data, extensions and process record. It preserves the fixture, independent exports, daily profile and source repository. It refuses an unowned directory, symlinked profile, changed process identity or active host. Stop requests graceful exit from only the recorded main process, then checks that its process group has exited. It never signals renderer groups or force-kills an unknown process. If the host cannot be inspected or fails to stop, close that candidate window and reconcile its state before retrying. Re-run prepare to install another candidate. Reset deletes candidate task and memory context, so export wanted diagnostics first. It does not undo source changes, stop independently launched external workers, or reverse external effects. Stop work and reconcile active execution in Piarre before closing the host.

F5 contributor hosts use separate temporary user-data and extensions directories. They are a development convenience; use the candidate package workflow for separate install identity and the tested reset boundary. Windows users can install a candidate manually into a dedicated VS Code profile; the automated lifecycle tool deliberately refuses unsupported process controls.

</details>

## Collect and review diagnostics

In a trusted project, run **Piarre: Create Diagnostic Bundle**. The default **Metadata only** collects event kinds and ordering, project/plan revisions, approval and check observation times, run/check outcomes, manifest hashes, and pseudonymous provider/model and record references. It omits statements, prompts, command arguments, output, memory text, local paths and raw configuration strings. This projection is for investigating state and ownership; hashed model references are not model-name disclosure. Repository commit/dirty state is a separate bounded Git observation, and unavailable observations remain unknown.

<details>
<summary>Diagnostic content, retention, and export</summary>

**Reviewable content** separately opts into the synchronized snapshot, ordered events and configuration text. Credential-key and common token patterns are redacted before any file is written. Arbitrary secrets can still appear in prose, prompts, file diffs, output, identifiers or unusual credential formats. Review the full file before sharing. Metadata and content bundles are bounded to 2 MiB, 5,000 recent event entries, 500 runs and 20 retained files. The manifest states collection coverage and omissions and hashes the exported payload. Oversized content fails without saving a partial bundle. Snapshot and events come from one SQLite SELECT; they retain one project revision. Event ordering is not an invented wall-clock log.

Choose **Preview only**, one day or seven days separately from content collection. Preview opens an unsaved editor buffer and creates no retained bundle. Retained bundles use private local files outside the project repository. Expiration runs each minute while Piarre is active and on the next activation or diagnostic command. It does not run while VS Code is closed. Malformed bundles remain available for explicit deletion. Open editor buffers, exports, backups and provider data have separate lifetimes.

The **Metadata with recording link** choice links an existing HTTPS recording without capturing media. Links cannot contain credentials, query parameters or fragments, and the entered link is explicitly disclosed in the bundle. Piarre does not record the screen or microphone, upload a bundle, or request remote analysis.

Review the local JSON, then use **Piarre: Export Diagnostic Bundle**. Export asks separately, writes a new file without overwriting an existing file and verifies the exact saved bytes. Use **Piarre: Delete Diagnostic Bundle** to remove a retained local bundle and verify that its path no longer exists. Exported copies and open editor buffers remain. Deletion does not promise secure erasure of storage blocks, backups or provider retention. Remote analysis, if desired, is a separate user-controlled sharing action outside this workflow.

</details>

Local macOS Host tests open VS Code windows. Enable them deliberately with `PIARRE_GUI_TESTS=1 npm test` or `PIARRE_GUI_TESTS=1 npm run test:package --workspace apps/vscode`. Without that flag, the launcher stops before creating a profile or opening a window. CI Host runs remain enabled. `npm run check`, packaging, compilation and filtered Node tests do not need the flag.
