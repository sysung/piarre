## MODIFIED Requirements

### Requirement: Preserve submitted context
The chat SHALL retain submitted messages in session memory, distinguish user input from model output, and grant no execution authority to either. It SHALL support editable terminal input and streamed textual responses without persisting conversation history by default.

#### Scenario: Receive an inference claiming approval
- **WHEN** a model claims permission to act
- **THEN** its reply is displayed as text and cannot create tasks, approvals, or side effects

### Requirement: Represent uncertain turns
The chat SHALL expose cancellation, transport failure, and truncated responses as incomplete. It SHALL NOT automatically retry or claim successful completion when the outcome is unknown. A new process SHALL start a fresh session.

#### Scenario: Disconnect during streaming
- **WHEN** the endpoint disconnects before a terminal response
- **THEN** partial output is marked incomplete and no automatic retry starts

#### Scenario: Restart with a pending turn
- **WHEN** the chat process restarts before a terminal reply
- **THEN** it starts a fresh session without retrying or claiming completion of the prior request

## ADDED Requirements

### Requirement: Bound conversation requests
Chat SHALL enforce configured context and output limits. Context overflow SHALL be explained before submission without silently discarding earlier messages. Cancellation SHALL stop local output promptly and report when server termination cannot be confirmed.

#### Scenario: Conversation exceeds context
- **WHEN** the next request exceeds the configured context allowance
- **THEN** the user is asked to start a new session rather than receiving a silently shortened conversation

### Requirement: Render model output as text
Chat SHALL filter terminal control sequences from untrusted output while preserving ordinary text and line breaks.

#### Scenario: Reply contains terminal escape sequences
- **WHEN** a response contains terminal control bytes
- **THEN** they cannot alter terminal state, clipboard content, or trigger terminal actions


### Requirement: Enforce request deadlines
Chat SHALL enforce configured connection, first-response, stream-idle and total-request deadlines. An expired or cancelled request SHALL be incomplete and excluded from future assistant context. New inference SHALL remain blocked while prior server activity is uncertain.

#### Scenario: Endpoint stalls
- **WHEN** a request exceeds a declared deadline
- **THEN** chat returns an incomplete outcome without retrying, and waits for confirmed server termination or controlled serving-process restart before another request
