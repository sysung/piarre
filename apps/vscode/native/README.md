# Scoped publication boundary

`scoped-publication.py` is the packaged filesystem boundary for candidate patches, repository integration, and reviewed recovery. The extension supplies bounded text images and reviewed directory identities. It invokes an installed absolute Python 3 runtime in isolated mode. The current macOS implementation was exercised with `/usr/bin/python3` 3.9.6. Linux has a `renameat2` implementation but has not been exercised by this macOS evidence.

Before review, the host checks runtime support, scoped file metadata, and a private owned control directory on the target filesystem. Control storage must be outside the movable source or candidate subtree. Cross-device layouts, symbolic links, hard links, special permission bits, flags, extended ACLs and extended attributes are refused. macOS `com.apple.provenance` is explicitly copied to replacement files; other attributes are not silently dropped.

For each changed file, the helper persists intent (root, parent and escrow directory identities, operation key, reviewed images), stages and fsyncs a replacement, and exclusively renames the actual existing entry into its unique private escrow. macOS uses descriptor-relative `renameatx_np(RENAME_EXCL)`; publication uses exclusive hard-link creation. Both participating directories are fsynced. The actual displaced entry is checked before publication. An unexpected entry or occupied destination is retained, never overwritten. Parent relocation stops completion; a replacement parent is not a publication target.

This is reversible displacement and exclusive publication, not an atomic compare-and-swap or an atomic multi-file transaction. An older open descriptor can continue writing to the displaced inode. Those entries remain discoverable through the stable control anchor and the recorded operation, are labeled potentially changing in Saved versions, and are never automatically garbage-collected. A user can capture their currently inspected bytes into a registered snapshot and review a restore. Current work is preserved again before that restore.

Recovery authority remains in the existing SQLite event log. It registers the full preserved scope and atomically transfers the old reservation to a reviewed successor. Superseded journals cannot replay. Missing or corrupt preservation, changed parent identity, dirty buffers, a live foreign owner, or uncertain local process ownership blocks writes and retains the reservation. Recovery never signals a PID or calls a provider. Every resolution makes old verification and acceptance historical.

Run the real filesystem crash/race tests with:

```
/usr/bin/python3 apps/vscode/native/test-scoped-publication.py
```

The three `recovery-host.test.ts` journeys exercise the production ExecutionUi and actual Webview with native-dialog decisions supplied by fixtures. Their source is compiled, but GUI execution is separately gated. No account or model call is needed for these tests.
