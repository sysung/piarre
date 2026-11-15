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
