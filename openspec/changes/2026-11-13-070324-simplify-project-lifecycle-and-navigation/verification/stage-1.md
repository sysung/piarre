# Stage 1 contributor navigation

- Issue [#124](https://github.com/sysung/piarre/issues/124) is open. Branch `codex/124-01-navigation` is the first link and targets `master`. The Project 8 attachment was unavailable because the CLI lacked `read:project` scope.
- Baseline `c6640f9cd9c6ed6144e6855b7e682327e8aef3d9` contains both documentation changes and the legacy archive. The only pre-edit untracked paths were the transferred change. The tracked tree matches the audited `0119a55cccc2b4cc199222351e4cfb5e7bf5daf2` exactly at tree `dbfa852443ac2fdf39e616d6a104717a9df92272`.
- Environment macOS 26.6.2 arm64, Node v22.23.4, VS Code 1.145.3 for the editor verification. Generated evidence is under `.artifacts/stage-1/`.

## Baseline verification

- **V01 passed.** `git diff --exit-code 0119a55cccc2b4cc199222351e4cfb5e7bf5daf2 HEAD` returned zero. Rechecked project opening and reconciliation in `extension.ts`, the production `applyAndAccept` caller in `execution-ui.ts`, coordinator and adapter restore callers, and Work and detail listeners in `work-view.ts`. The caller inventory includes direct tests in `execution-coordinator.test.ts`, `agent-workspace.test.ts` and `recovery.test.ts`. See `callers-before.log`, `audit-diff.log` and `status-before.log`.
- **V02 baseline passed.** Captured SHA-256 for the original README, principles, research, archives, acceptance fixtures, and editor/package inputs. The original content is retrievable from the baseline commit. `python3 openspec/changes/archive/2026-11-13-legacy-documentation/capture-baseline.py --code . --documentation-root .` verified 26 snapshot hashes, 12 historical Git source objects, byte-identical inventories and all 21 catalog rows. See `docs-before.sha256`, `package-inputs.sha256` and `archive-before.log`.

## Editor verification

- **V03 passed.** In an isolated VS Code 1.145.3 workspace, Explorer hid all eight generated-name probes visible on the baseline. Expanded trees still displayed `.agents/skills`, `apps/vscode/src` and `apps/vscode/test`. Searching for the product description returned two current files, down from eight baseline results. Turning off **Use Exclude Settings and Ignore Files** and entering the archive's `sources` path returned all six historical matches. Re-enabling the toggle and clearing the include field restored the two current matches.
- The Git-tracked archive, skills, active specs and audit paths and the package and ignore inputs matched the baseline before placeholder removal. See `navigation-before.log`, `navigation-after.log`, `search-current.png`, `search-history.png` and `tracked-before.log`.

## Documentation preservation

- **V02 passed.** Byte comparisons restored the exact original README and principles body after stripping the three wrappers and the new index. SHA-256 comparisons against the baseline matched the research, overview, workflow, snapshots, manifests and acceptance provenance fixtures. The archive verifier independently checked the 26 snapshots, 12 historical Git objects and all 21 requirement, owner and verification mappings.
- The built-in VS Code Markdown preview showed three collapsed sections that opened on click. Install, F5, initial diagnostics and both command blocks stayed visible. The two rendered command blocks matched the source exactly. All five README local links and all 15 new principles anchors resolved. See `preservation.log`, `readme-render.json` and `principles-render.json`.

## Stage checks

- Verified both placeholders were zero-byte tracked blobs and their parent directories contained active specs and archived changes. Removed only those placeholders. The active OpenSpec YAML setting remains `schema: spec-driven`. The final Explorer and Search check repeated V03 and found the active project-state spec, the archive disposition index and the OpenSpec apply skill in Search.
- `npm run test:contract` passed 31 tests. `npm run check` passed lint, typecheck, build and VSIX package inventory. Strict OpenSpec validation and `git diff --check` passed. See `placeholders.log`, `contracts.log`, `check.log` and `strict.log`.
