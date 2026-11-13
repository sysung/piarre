# Stage 4 detail identity

Issue [#124](https://github.com/sysung/piarre/issues/124), PR [#128](https://github.com/sysung/piarre/pull/128), branch `codex/124-04-detail-identity`, stacked on [#127](https://github.com/sysung/piarre/pull/127). The parent is `b33f06473e71c077a0c8f7c4af86564d9c59151c`. Runtime implementation and initial fixtures are committed at `e78f5bd7de87d4688839c5e541a366a62915ae65`. Final test revision `7d0d9bb93af4ecbfa0230588a5240016bc536f95` corrects the test proxy and strengthens coverage. The runtime code is unchanged.

V10 action authority is verified. V11 browser reading-state mechanics pass, but physical focus verification is blocked because the Mac is locked. Tasks 5.3 and 5.4 remain pending. This stage is not fully verified or ready to land.

## Behavior and authority

The actual Webview baseline reused the prior document when switching between identical-looking proposals. A captured run click could also dispatch an unrelated run ID or a raw global pause action. Native result confirmation accepted the old run after selection moved to another run or moved away and back. These failures are recorded in `red-record.log`, `red-authority.log`, and `red-confirmation.log` under `.artifacts/stage-4/`.

The fixed documents include the current project instance and record identity. Their control maps are populated by the same renderer calls that create enabled buttons. A received message must match the current document and an existing control key. The tests click the production script's buttons, capture their envelopes, and replay them through the actual Webview bridge. Old documents, reopened projects, unknown current-document control keys, extra action or target fields, and unbound global messages cannot prompt or dispatch. Proposal details retain their existing Delete control without adding execution controls.

A pane-owned selection incarnation invalidates an outstanding review after A-to-B-to-A navigation or disposal. A valid confirmation survives a real document replacement caused by unrelated progress on the same record. The test asserts that the document nonce changes before confirming. Result evidence and recovery previews retain their existing domain validation. Native proposal deletion also captures the named goal and project revision. Advancing that revision during the modal cannot reach deletion. Successful deletion removes only the selected goal and retains its prior history.

Execution and recovery carry the initiating origin through native dialogs, saved-version selection, metadata observation, spending review, and the first durable reservation. A dedicated result test covers the asynchronous entry before reservation. Steering tests cover input, preparation metadata, approval metadata, spending, and final account metadata. Navigation after authorization does not cancel generation, source publication, or recovery. Completion cannot take focus from the new selection.

## Reading state and its limits

`detail-document.ts` contains the shared escaping, CSP and nonce envelope, click protocol, and reading-state script. WorkView still owns selection, cache equality, and disposal. Task and estimate disclosures use task identity. Run file and check disclosures retain their existing keys. Focus keys include control semantics, region, and occurrence. A real Webview fixture with repeated controls verifies that the second occurrence and another region restore separately. Existing Work tests retain private unsent text and responsive Stop behavior. The actual Work DOM also clears the proposal's `aria-current` marker when its detail closes.

The default Host fixture dispatches browser DOM focus and scroll events after setting actual DOM state. This proves the production reading-state script and Webview persistence, including same-record refresh and different-record reset. It does not prove operating-system focus. Earlier fixture attempts changed `activeElement` while the unfocused document suppressed `focusin`, leaving the previous persisted state. That was a test setup problem, not another baseline product defect.

The stricter `PIARRE_DETAIL_NATIVE_FOCUS=1` mode requires `document.hasFocus()` and uses native browser focus and scroll events. Its run is blocked. CUA reported, "The Mac is locked and automatic unlock could not unlock it." Explicit pane reveal and the workbench focus command could not establish focus. No production guard or native-focus assertion was relaxed. After unlocking the Mac, rerun:

```sh
PIARRE_GUI_TESTS=1 PIARRE_DETAIL_TEST=1 PIARRE_DETAIL_NATIVE_FOCUS=1 npm run test:smoke --workspace apps/vscode
```

The proposal stylesheet is byte-identical to the parent, including its reduced-motion rule. Its SHA-256 is `a696e160aa2832b9daf3f60cfc8141c7e0a9b22f0845b3ce88e42b421cc98bcb`. This is static preservation evidence, not live OS preference emulation.

## Verification receipts

Environment is macOS 26.6.2 arm64, launcher Node v22.23.4, and VS Code 1.144.0. Dependencies were installed with `npm ci --ignore-scripts` to preserve the esbuild JavaScript launcher required by existing watchdog fixtures. The pinned VS Code cache was temporarily symlinked, then unlinked after the independent Host run. The symlink was never committed. Logs are local in `.artifacts/stage-4/`.

- `npm run check` passed lint, types, build, and VSIX packaging at both the implementation and final test revisions. See `check-final.log` for the exact final test revision. `npm run test:contract` passed all 31 contracts. See `check.log` and `contracts.log`.
- `PIARRE_GUI_TESTS=1 PIARRE_DETAIL_TEST=1 npm run test:smoke --workspace apps/vscode` passed 67 focused trusted tests and one restricted test after the proxy correction and independent coverage additions. The focused mode includes detail, main Work, execution, provider-settings, recovery, and result-review suites. See `focused-coverage.log`. The final fixture revision, including the proposal-close check, passed the same 67-test browser-mechanics lane; see `focused-test-head.log`. Native-focus assertions remain blocked in their separate mode.
- The initial full Host run passed 363 tests and failed one migrated test proxy. Its HTML setter incorrectly used the proxy as the receiver of a VS Code private field. The corrected test forwards the setter to the real Webview; it does not change product code. See `full-host.log` and `focused-reviewed.log`. The independent final-head run at `7d0d9bb93af4ecbfa0230588a5240016bc536f95` passed all 365 trusted tests and one restricted test, and confirmed that restricted activation created no database. See `independent-full-host-7d0d9bb.log`.
- The archive checker passed all 26 snapshot hashes, 12 historical Git source objects, and all 21 catalog mappings. A Git comparison against Stage 1 found no changes to README, docs, editor exclusions, archive contents, or historical design files. See `archive.log` and `preservation-diff.log`.
- `/Users/sysung98/.nvm/versions/node/v22.16.0/bin/openspec validate --all --strict` passed all 10 items. `git diff --check` passed. See `openspec.log`.

Independent authority and architecture review passed the implementation revision. The independent comment review requested no changes. A separate verification review requested the project-revision, document-rotation, unknown-control, and proposal-close assertions described above. The independent verifier reviewed those assertions and the complete V01–V12 index, then ran the full Host suite at the final test revision. All requested coverage gaps are resolved. Hosted CI passed at the exact final test revision.

[Initial CI run](https://github.com/sysung/piarre/actions/runs/43395903675) failed only the inherited two-second `Durable projects` setup timeout. The new detail tests passed. No timeout was changed for that single observation. [Final-test CI run](https://github.com/sysung/piarre/actions/runs/43396944960) passed at `7d0d9bb93af4ecbfa0230588a5240016bc536f95`, including both package-installation checks. Root read back PR #128 as open, ready, unmerged, and based on the exact Stage 3 head. The following commit records documentation and task status only; its final remote readback is reported on the PR.

The tests intercept native prompt APIs and inspect their text, modal options, and buttons where applicable. They supply deterministic answers. They do not automate OS dialog pixels. Provider clients used for continuation tests are deterministic fixtures and make no external call. No live account spending occurs. All 17 retained pending product criteria remain pending. Nothing was merged or archived.
