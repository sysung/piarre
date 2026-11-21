## Purpose
Let a user chat with a local model and then try scoped file operations in a folder they select.

## ADDED Requirements

### Requirement: Preserve session conversation
Chat SHALL keep user and assistant messages in session memory, support editable input and streamed replies, and avoid persisted conversation history by default.

#### Scenario: Supply a positional prompt
- **WHEN** the user passes prompt text as a launch argument
- **THEN** the CLI exits with a usage message directing the user to chat input before requesting inference

#### Scenario: Continue a conversation
- **WHEN** the user sends a related second message
- **THEN** the model receives the session context; restarting begins a new session

### Requirement: Show errors and interrupted outcomes
Chat SHALL expose errors, cancellation and partial responses honestly without automatic retries. Cancellation SHALL stop further local tool dispatch and report completed changes rather than imply rollback.

#### Scenario: Cancel after a file operation
- **WHEN** the user cancels after one tool operation completed
- **THEN** the application reports that operation and does not claim it was undone

### Requirement: Use runtime generation defaults
The application SHALL use configured model/runtime generation defaults without output-token overrides or automatic generation deadlines, including transport total/read timeouts. It SHALL show context errors without silently discarding history. Exact tokenizer preflight SHALL NOT be required. Long-output management is deferred.

#### Scenario: Runtime stops generation
- **WHEN** a runtime limit ends generation
- **THEN** the harness reports the observed outcome without promising unlimited or complete output

#### Scenario: Generate beyond former harness limits
- **WHEN** the configured runtime continues producing an answer beyond 128 tokens or 120 seconds
- **THEN** the harness continues streaming without applying either former cutoff

#### Scenario: Runtime rejects context
- **WHEN** a runtime rejects context
- **THEN** the error is visible and accepted conversation history is preserved

### Requirement: Render terminal chat and diagnostics
Plain chat SHALL stream model replies through Rig's stdout helper and omit structured reasoning. The application SHALL escape terminal controls in displayed configuration, errors, and tool output.

#### Scenario: Show a streaming reply
- **WHEN** the model produces text during a plain chat turn
- **THEN** Rig displays it incrementally using its stdout format

### Requirement: Enable file tools after the chat trial
File tools SHALL remain disabled until the user has tried chat and explicitly chooses a workspace. The planned file tools SHALL support bounded list/read/create/edit/delete inside the selected workspace.

#### Scenario: Request a sample file
- **WHEN** the user enables workspace mode after the chat trial and asks the real model to create a Python file
- **THEN** a registered tool writes the file and returns its actual result for independent inspection

### Requirement: Confine file operations
Workspace selection SHALL consent to reads and writes on regular files within the selected directory without per-file approval, subject to OS permissions. The file layer SHALL reject traversal, symlinks, non-regular file targets, writes through multiply linked files, deletion of the workspace root and recursive directory deletion.

#### Scenario: Read or write within the selection
- **WHEN** a file operation targets a permitted regular file inside the selected folder
- **THEN** the file layer permits the operation without another approval prompt

#### Scenario: Request an unsafe path
- **WHEN** a file request contains traversal or attempts to follow a symlink
- **THEN** the file layer rejects the path

### Requirement: Require approval outside the workspace
An explicit outside file read or write SHALL return an approval-required result without opening or changing the target. An outside operation may proceed only after explicit user approval through a separately implemented grant flow. Model text SHALL NOT grant authority. Shell, arbitrary HTTP and generated-code execution remain outside the file permission layer.

#### Scenario: Request an outside path
- **WHEN** a file request names an absolute path outside the selected workspace
- **THEN** the file layer reports approval required without opening or modifying the target

### Requirement: Show optional model-provided reasoning
Chat SHALL offer a live Thinking section separate from the Answer when the configured local model/runtime exposes reasoning. The user SHALL be able to hide the Thinking display. Hiding text SHALL be distinguished from disabling model reasoning. The application SHALL NOT fabricate reasoning or describe emitted reasoning as a guaranteed account of internal computation. Both streams SHALL use the same safe terminal rendering and honest interrupted/limited-output reporting.

#### Scenario: Observe reasoning before an answer
- **WHEN** reasoning is enabled on a supported real configuration and the user shows thinking
- **THEN** emitted reasoning appears incrementally under Thinking before the separately labeled Answer

#### Scenario: Hide reasoning output
- **WHEN** the user hides thinking
- **THEN** the answer remains usable and the interface explains that hiding output does not itself disable model reasoning

#### Scenario: Reasoning is unavailable
- **WHEN** the configured model/runtime does not expose reasoning
- **THEN** the application reports that limitation and preserves ordinary chat without inventing a thinking stream
