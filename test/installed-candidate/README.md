Run the exact candidate package in the existing Linux desktop container without opening host VS Code or copying authentication.

```sh
npm run package:candidate
node scripts/test-installed-candidate.mjs piarre-sandbox-piarre-1 apps/vscode/dist-package/candidate /tmp/piarre-c07-evidence
```

Choose a new or empty evidence output directory for each run. The runner rejects old output to prevent stale passing reports.

The runner requires Docker CLI access, Git, unzip, and the container's `/usr/share/code/code` executable with its X display at `:99`. It installs the VSIX into a new `/tmp/piarre-c07-<uuid>/extensions` directory. The native test host uses that installed directory as its extension development path because VS Code requires a development path to execute native tests. It checks the installed identity, extension path, and packaged/runtime SHA-256 equality before invoking public Piarre commands. No compiled source fixture replaces the installed extension.

Each repository creates a real proposal, opens its source in the native editor and Piarre sidebar, then restarts the native host and inspects canonical SQLite records. The second repository is a committed `git archive` of the package's source commit plus a manual-file sentinel. The first is a committed independent counter app. Distinct projects share only the disposable candidate profile.

Actual installed diagnostics commands collect, preview, export, expire and delete owned bundles. Only native choice dialogs are automated through the installed extension's scoped VS Code API. The document editor, sidebar, SQLite, filesystem, bundle redaction and command handlers run normally. Expiry changes an owned bundle's capture time to an elapsed fixture date, then invokes the installed command's expiry path. No provider request or execution approval is made.

`installed-candidate-evidence.json` contains the four named check results, source commit/dirty flag, VSIX/runtime hashes, project identities, inspected source hashes, native screenshots and diagnostic export hashes. A dirty package can exercise this harness but cannot establish clean revision-bound acceptance. Package again from the final clean committed checkout for acceptance.

The runner requires the real installed Continue offline button on each fresh repository. It uses CDP target attachment and webview execution contexts inside the Docker-launched native host, verifies the closed overlay and editable Chat composer with native text input, and then opens Sessions / Saved goals to inspect the visible unapproved card before its screenshot. These assertions must pass before `offlineChat` and `visibleProposal` observations are written into a result.

The runner preserves owned container fixtures and output exports for inspection. Its stable sentinel is a disposable sibling directory, not a user's daily profile. Existing stable-profile lifecycle tests remain the evidence for real profile guard behavior. No host stable profile, user workspace, named Docker volume or account credentials are modified.
