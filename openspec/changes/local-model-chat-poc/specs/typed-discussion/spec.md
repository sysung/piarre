## Purpose
Let a user chat with a local model and then try scoped file operations in a disposable session workspace.

## ADDED Requirements

### Requirement: Preserve session conversation
Chat SHALL keep user and assistant messages in session memory, support editable input and streamed replies, and avoid persisted conversation history by default.

#### Scenario: Continue a conversation
- **WHEN** the user sends a related second message
- **THEN** the model receives the session context; restarting begins a new session

### Requirement: Show errors and interrupted outcomes
Chat SHALL expose errors, cancellation and partial responses honestly without automatic retries. Cancellation SHALL stop further local tool dispatch and report completed changes rather than imply rollback.

#### Scenario: Cancel after a file operation
- **WHEN** the user cancels after one tool operation completed
- **THEN** the application reports that operation and does not claim it was undone

### Requirement: Bound requests and render safe text
The application SHALL use configurable output and request limits, show context errors without silently discarding history, and filter terminal control sequences from model and tool output. Exact tokenizer preflight SHALL NOT be an admission requirement.

#### Scenario: Request fails or contains terminal controls
- **WHEN** a runtime rejects context or returns terminal-control bytes
- **THEN** the error is visible and displayed text cannot perform terminal actions

### Requirement: Enable file tools after the chat trial
File tools SHALL remain disabled until the user has tried chat and explicitly chooses workspace-tool mode. That mode SHALL offer list/read/create/edit/delete for regular files inside the disposable workspace, with bounded file sizes, output and tool-loop steps.

#### Scenario: Request a sample file
- **WHEN** the user enables workspace mode after the chat trial and asks the real model to create a Python file
- **THEN** a registered tool writes the file and returns its actual result for independent inspection

### Requirement: Confine file operations
Tools SHALL reject paths outside the workspace, traversal and symlink escapes, non-regular targets, deletion of the workspace root and recursive directory deletion. They SHALL NOT provide shell, arbitrary HTTP or generated-code execution. Model prose SHALL NOT grant additional authority.

#### Scenario: Request an outside path
- **WHEN** a tool request targets a path outside the workspace or follows a symlink outside it
- **THEN** the operation fails without changing the target

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
