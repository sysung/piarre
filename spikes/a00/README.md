# Run the A00 capability probes

Use these development probes to test one VS Code audio route and one local Codex backend. Both probes retain incremental evidence in temporary directories. The report validates that evidence before it renders a capability matrix.

## Prepare the package

Use Node 22.16 or newer, npm, Git, local VS Code, and the supported Codex CLI. The process ownership check supports macOS and Linux.

1. Open this directory as the VS Code workspace.
2. Run the following commands.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

The automated tests exercise cleanup races, the evidence contract, and disposable fixture protection. They do not establish microphone support, audible provider responses, or real coding control behavior.

3. Run `codex --version` and `npm run protocol:inspect`.
4. Compare the generated interface with `src/codex.ts` if the CLI version differs from 0.164.0.

The narrow JSON-RPC client uses `initialize`, `initialized`, `thread/start`, `thread/read`, `turn/start`, `turn/steer`, and `turn/interrupt`. It consumes thread status and turn completion notifications. Its wire types stay inside that client.

## Run the voice probe

Realtime requires an OpenAI API credential and API billing access. A Codex subscription does not establish Realtime API entitlement. Live Start can incur audio charges. The package neither records raw audio nor applies an account spending limit.

1. Set an account usage limit suitable for the trial before opening a live session.
2. Press F5 and select **Piarre A00 development host**.
3. In the development host, run **Piarre A00: Set voice credential**.
4. Enter your OpenAI API key. The extension stores it in SecretStorage.
5. Run **Piarre A00: Open voice probe**.
6. Describe the microphone and headset or speakers when prompted.
7. Find the evidence directory in the **Piarre A00** output channel.

Opening the panel does not acquire the microphone. The extension host creates a short-lived client secret through the GA `/v1/realtime/client_secrets` endpoint. The Webview keeps that secret in memory and uses `/v1/realtime/calls` for its WebRTC connection. The durable key does not enter the Webview. The host also accepts `OPENAI_API_KEY` from its process environment if no SecretStorage key exists.

The default model is `gpt-realtime`. Change `piarre.a00.realtimeModel` before opening the first probe if your account uses a different documented model. The manifest records the model returned by the session authorization response, the configured VAD behavior, VS Code and OS versions, audio setup, and a hash of the probe sources. End the VS Code development host to start a separate evidence run with a different configuration.

For each procedure, select its scenario before Start. Click **End** before you change scenarios. Enter the actual observations and select the outcome. Click **Save finding**. The reporter requires relevant automatic evidence as well as the operator's audible or OS observation before accepting a verified result.

| Scenario | Procedure and observation |
|---|---|
| Two turns without another Start | Click Start once. Say "Reply with a short greeting." After the reply, say "Name one primary color." Hear two replies without another Start. Record both audible replies. End. |
| Recognition during playback | Start. Ask for a long explanation. While audio plays, say "Please stop and say violet." Record the phrase, whether it was recognized, whether playback stopped, and speaker echo. End. The unique phrase belongs in the manual note; raw transcripts are not retained automatically. |
| Normal End | Start and establish audio. End. Check the displayed zero live tracks, capture and transport closure events, silence, and the OS microphone indicator. |
| End during startup | Start and immediately End while connecting or awaiting permission. Resolve any permission dialog afterward. Check that capture does not return. Repeat if the connection completed too soon to exercise the race. Deterministic delayed-acquisition tests cover the late-completion invariant separately. |
| Microphone permission denied | Deny the editor's microphone permission through the OS or permission prompt. Start. Check the visible failed state and zero live tracks. Restore permission for later trials. |
| Provider connection failure | Start with an unavailable model or invalid credential in an isolated trial. Check that capture closes after authorization or transport failure. Restore the correct configuration or credential. Record whether the failure was authentication, access, quota, or connection related. |
| Panel disposal | Start. Close the probe panel. Observe that audio stops and the OS microphone indicator clears. Reopen the command in the same development host. Select this scenario and record the external observation. The host records disposal; the destroyed Webview cannot report its own cleanup. |
| Repeated Start and End | Run Start, End, Start, End in this scenario. Confirm each capture follows its explicit Start and each End stops it. |

If a permission, account, or environment limitation prevents a trial, record **blocked**. A failed connection is not proof that a provider capability is unsupported. Use **unsupported** only with an identified interface limitation or documented rejection. A speaker limitation is valid evidence about that configuration.

**End** is idempotent. Pending startup work uses an attempt-specific abort signal. Late media acquisition is closed. If resource cleanup fails, the probe keeps ownership, blocks another Start, and lets End retry the unresolved cleanup. The probe does not reconnect automatically after End.

## Run the coding probe

Use the Codex CLI's supported login flow or documented API credential configuration. The probe inherits that local backend configuration. It never reads another application's token files. Each turn may consume plan usage or API charges.

After initialization, the probe calls `account/read` and records only the safe account category returned by App Server, such as a ChatGPT plan type or Codex API key. It never records credentials or account identifiers.

The CLI uses `workspace-write` with `approvalPolicy=never` and a new synthetic temporary workspace. It rejects interactive server requests instead of granting approvals. It cannot choose your project as the fixture. The prompts do not request dependency installation, network access, secret reads, or delegation. A backend configuration that cannot run these bounded commands produces a failed or blocked experiment rather than an approval bypass.

Run the three cases together.

```sh
npm run probe:coding -- --confirm-live
```

To run a single trial, use one of these commands.

```sh
npm run probe:coding -- --confirm-live --case start
npm run probe:coding -- --confirm-live --case steer
npm run probe:coding -- --confirm-live --case cancel-restart
```

Running without `--confirm-live` prints usage and starts no backend. The CLI prints each preserved fixture location and the final evidence directory. It does not delete fixtures.

The start case asks the backend to write `alpha` to `result.txt`. It reads status and checks active and terminal notifications against the actual file.

The steering case runs a bounded fixture helper before the final write. The helper records its PID, unique token, and active checkpoint. Once the helper is observably active, the probe requests `beta` instead of `alpha` through `turn/steer` with the expected active turn ID. A `beta` result in that same turn verifies the bounded steering effect. A run that completes before the request is an invalid trial.

The cancellation case interrupts while the helper is active. It checks the terminal event and the helper's process identity. The fixture's natural exit cannot occur before 12 seconds, so a vanished helper with an earlier active checkpoint is recorded as external termination; a graceful signal handler is recorded separately. A request acknowledgment alone cannot verify native cancellation. The probe then stops its owned backend process group and, if necessary, the identified fixture helper. This forced teardown is separately recorded. It never treats an unchanged file interval as proof of termination.

The restart gate requires backend exit, an empty owned process group, and a stopped helper. The probe reads and saves the partial diff before replacement. Only after that gate passes does it start a replacement task that writes `beta` while preserving the pre-existing user note. An uncertain process boundary blocks replacement. This proves the fallback only for this bounded fixture.

The CLI needs permission to inspect processes with `ps`. Run it from a normal local terminal when an agent sandbox blocks process inspection. A denied process observation cannot become a verified cancellation result.

## Generate the findings report

Provide the actual result files printed by the probes and a destination for the reviewed evidence bundle.

```sh
npm run report -- /path/to/voice/result.json /path/to/coding/result.json /path/to/reviewed-evidence/report.md
```

The report command validates scenario completeness, observation sequences, evidence references, and required effects. It copies the validated results into `voice/result.json` and `coding/result.json` beside the report. Each row names its result file and observation sequence numbers.

Each run writes these artifacts.

```text
observations.jsonl
result.json
```

The coding run also writes `start.diff`, `steer.diff`, `cancel-restart.diff`, and `cancel-before-restart.diff` for cases that reach those steps. Preserve those synthetic diffs beside the reviewed result. If an experiment crashes, retain its incremental `observations.jsonl` and rerun in a fresh directory. Do not manufacture a finalized result to hide the crash.

Review notes and fixture diffs before copying a bundle into `evidence/<run-id>/` for a PR. The event vocabulary excludes raw provider objects, SDP, credential messages, environment dumps, and full tool output. The validator also rejects common credential formats and personal path prefixes in notes. Operator review is still necessary for arbitrary sensitive text. Raw audio or video requires a separate recording decision and stays outside the repository.

The matrix uses `verified`, `unsupported`, `failed`, `blocked`, and `not-tested`. The report separates investigation completion from the integration recommendation.

- **Go** requires every bounded scenario to be verified.
- **Conditional go** requires verified voice, start, status, and the stop, reconcile, and restart fallback. Native control limitations must be attempted and recorded.
- **No-go** applies when required behavior or a safe replacement path remains unverified.

A completed investigation with failed audio does not satisfy the issue's working-audio acceptance criterion. Resume is not tested. The coding CLI does not prove extension-host process launch or authentication inheritance. Later integration must test that boundary.

## Review the implementation boundary

`src/webview/lifecycle.ts` owns one attempt and its media resources. `src/extension.ts` owns panel lifetime, credentials, and voice evidence. `src/coding.ts` owns each coding experiment. `src/codex.ts` owns JSON-RPC. `src/fixture.ts` owns disposable fixture observations. `src/shared/scenarios.ts` owns required cases. `src/shared/evidence.ts` owns evidence validity and the decision rules.

The browser build has no Node or VS Code types. Its build target rejects Node built-ins. Production adapters, persistence, voice-to-coding routing, previews, Cursor compatibility, and full product UI remain later backlog work.

Provider references were checked against the [GA Realtime guide](https://developers.openai.com/api/docs/guides/realtime), [WebRTC guide](https://developers.openai.com/api/docs/guides/voice-webrtc), and [Codex App Server guide](https://developers.openai.com/codex/app-server). Recheck those sources and the installed generated protocol when upgrading either integration.
