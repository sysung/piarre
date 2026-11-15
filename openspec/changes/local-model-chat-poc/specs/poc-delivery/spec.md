## Purpose
Deliver a recoverable local-model experiment in small reviewable slices without research prerequisites blocking first use.

## ADDED Requirements

### Requirement: Preserve recovery and completed work
Completed reset approval, recovery references and delivery evidence SHALL remain available. New destructive cleanup SHALL NOT be inferred from this scope revision.

#### Scenario: Revise the PoC
- **WHEN** the delivery sequence changes
- **THEN** completed recovery and cleanup evidence remain intact

### Requirement: Keep a readable work map
Each active task SHALL have a concise description, value, observable verification, parent and actual dependencies. Issues under implementation SHALL link to their PR and PRs SHALL link back. Deferred research SHALL NOT block active chat work.

#### Scenario: Defer benchmarks
- **WHEN** comparison work moves outside the PoC
- **THEN** chat dependencies no longer require that research to finish

### Requirement: Stage real use before file changes
Delivery SHALL establish real local inference, working containerized chat, a human chat trial and then scoped file tools. PoC acceptance SHALL remain a human decision.

#### Scenario: Chat implementation is ready
- **WHEN** the real model can converse through the container
- **THEN** the user can try chat before any model-driven workspace file changes

### Requirement: Distinguish outcome from issue closure
Closing a task SHALL NOT imply that an unsuccessful model attempt worked or that the user accepted the PoC.

#### Scenario: An attempted configuration fails
- **WHEN** its investigation is closed
- **THEN** its recorded outcome remains failure and another configuration may be tried
