# Workspace list/read verification

Issue [#174](https://github.com/sysung/piarre/issues/174), task 2.8. Verified on 2026-11-18 using MiniCPM5-2B through Docker Model Runner and the containerized Rig harness.

## Behavior

`--workspace DIRECTORY` selects an existing directory at or beneath `/workspace` and enables `list_files` and `read_file`. Ordinary chat registers no tools. Rig sends structured tool requests to Rust handlers, displays their results, and returns those results to the model. Successful turns retain the tool messages in session history. Failed or cancelled turns do not enter history; already displayed results remain visible.

The root is the selected container directory. Directory selection is itself confined beneath `/workspace`. Linux `openat2` resolves paths beneath an open root directory with symlinks and mount crossings rejected. Reads accept regular UTF-8 files only. Nonblocking opens prevent FIFO reads from waiting for a writer. Each turn permits four tool calls, each file up to 4 KiB, each listing up to 64 entries, and each encoded result below 8 KiB. Oversized requests/results return errors, not truncated file data. These limits do not impose a model output-token cap or generation deadline.

## Initial real-model observations

Application changes were committed as `7583aeb`; this initial run used the superseded `--workspace-tools` flag.

The session ran with `docker compose run --rm --name piarre174-live harness --workspace-tools`. Operator commands seeded `notes.txt`, `samples/hello.py`, and an `escape` symlink to `/etc/hostname` inside the container. Inspection showed user `10001:10001`, no mounts, and only the configured `/tmp` and `/workspace` tmpfs storage.

| Prompt or check | Observed result |
| --- | --- |
| `List the workspace files using your tool.` | Actual `list_files` result contained `escape`, `notes.txt`, and `samples`. |
| `Read notes.txt using your tool. What is the reference?` | Actual `read_file` returned `The sample color is violet.\nReference: maple-936.\n`; the answer identified `maple-936`. A direct container `cat` matched. |
| `Read escape using read_file.` | Actual handler rejected the symlink. No target contents returned. |
| `Use read_file to read ../etc/passwd.` | Actual handler rejected traversal. |
| `Read notes.txt five times using five separate read_file calls, then tell me the reference. Do not skip any of the five calls.` | Rejected the oversized tool-call batch with the four-call-limit error. No calls from that batch ran. |
| `Read notes.txt and samples/hello.py and list samples, then explain each line.` | Two actual reads and one listing succeeded; the answer matched the files. |
| Count from 1 to 1000, then Ctrl-C | Streaming stopped at 83 and returned to the prompt. The cancelled turn was excluded from history. A subsequent recall prompt returned `maple-936`. Backend generation termination was not measured. |
| Plain one-shot chat with tools disabled | `What is 2 + 2? Reply with only the number.` returned `4`. |
| Exit and run a fresh one-shot tool session | Actual `list_files` returned an empty array. The prior sample workspace was discarded. |

MiniCPM once refused to explain Python after successfully reading `samples/hello.py`, claiming it could only access files. Tools working does not establish reliable model answers. Existing [model limitations](model-observations.md) still apply.

## Automated and static checks

The user approved focused boundary tests. Seven new tests exercise actual handlers with temporary filesystem fixtures: valid nested reads/listings, traversal/absolute paths, symlinks, FIFO/socket/directory rejection, UTF-8, exact file/entry bounds, encoded output limits and malformed arguments. All 10 tests passed, including the three existing terminal-filter tests, in the Linux Rust compiler container with `cargo test --locked`.

`cargo check`, `docker compose build harness`, strict OpenSpec validation and `git diff --check` passed. An initial test run encountered stale dependency artifacts; rerunning with a separate target directory passed. No mock inference endpoint or host Rust installation was used.

File creation, edits, deletion and shell execution remain outside this issue. Final human acceptance is separate from these implementation checks. Follow the README's sample-file steps to try the feature.

## Directory-selection follow-up

On 2026-11-18 the user selected container-only directory opt-in. Application changes are committed as `b5b9f0c`. The tested image was `sha256:9f7440cb32ad345740c60af42fe352c184a1aef4549e51abe1547d2a4185e37f`; final formatting after the image build changed no behavior. The runtime/model route was unchanged from the initial run.

- Seeded `/workspace/samples/notes.txt` with `The selected reference is cedar-184.` and a sibling `/workspace/outside.txt` using the operator's container shell. Ran `--workspace /workspace/samples` with the real model. `list_files` returned only `notes.txt`; `read_file` returned the seeded text, and MiniCPM answered with the reference.
- `/etc`, `/workspace/missing`, `/workspace/../etc`, an intermediate symlink `/workspace/link/ssl`, and a missing directory argument all exited with failure before inference.
- `--workspace /workspace` listed an empty fresh workspace. Plain chat without a directory still returned `4`.
- All 11 Linux tests passed, including the added selected-root test. It verifies sibling-file exclusion, traversal rejection and intermediate symlink rejection. Docker build and diff checks passed.

The old flag is rejected with usage guidance. Directory selection does not mount a Mac folder or create a missing directory. Previous cancellation checks were not repeated because the cancellation path is unchanged.
