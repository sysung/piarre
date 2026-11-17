## Purpose

Preserve useful project intent, corrections, and observations across sessions with inspectable sources, explicit scope, and user-controlled sharing.

## ADDED Requirements

### Requirement: Organize specifications and architectural decisions
Piarre SHALL organize adopted behavior under `.piarre/specs/`, proposed and archived changes under `.piarre/changes/`, and durable ADRs under `.piarre/decisions/`. Supporting knowledge SHALL reference these authoritative artifacts rather than duplicate them. ADRs SHALL identify context, decision, alternatives, consequences, status, and supersession where applicable.

#### Scenario: Explain an architectural choice
- **WHEN** a change design and a knowledge record concern an architectural decision
- **THEN** both reference the same ADR, whose status and rationale remain inspectable independently of the change

### Requirement: Use proportionate specification-driven development
Changes to product behavior or architecture SHALL default to SDD, with ADRs for meaningful architectural decisions. Bounded edits without behavior-contract impact SHALL be allowed to use Direct mode. Explicit permitted workflow preferences SHALL remain effective without waiving execution permissions or silently overriding accepted requirements.

#### Scenario: Change a behavior contract
- **WHEN** a task changes an adopted product behavior without an explicit permitted workflow override
- **THEN** the work uses a proposed change and delta specs, with an ADR if it makes a meaningful architectural decision

#### Scenario: Correct a typo
- **WHEN** a task corrects a typo without changing behavior or architecture
- **THEN** it can proceed in Direct mode without creating a spec change or ADR

### Requirement: Adopt and archive explicitly
Approved spec deltas SHALL update adopted specs through an explicitly requested lifecycle operation. Completed changes SHALL retain their history when archived. ADRs SHALL distinguish proposed, accepted, rejected, and superseded decisions. Capture and archival SHALL NOT create acceptance, and interrupted adoption SHALL report incomplete reconciliation rather than settled state.

#### Scenario: Complete a reviewed change
- **WHEN** the user requests adoption and archival of a completed, reviewed change at an identified revision
- **THEN** approved deltas update the applicable specs, accepted ADRs retain their decision identities, and the archived change preserves proposal and evidence references without another intent confirmation

#### Scenario: Capture an architectural suggestion
- **WHEN** a model proposes an architectural explanation during ordinary memory capture
- **THEN** it remains provisional supporting knowledge and cannot silently become an accepted ADR or specification

#### Scenario: Interrupt spec adoption
- **WHEN** an adoption operation stops before reconciliation completes
- **THEN** Piarre preserves the source proposal and reports the affected state as incomplete instead of claiming successful adoption

### Requirement: Keep knowledge readable and project owned
Piarre SHALL store canonical knowledge as versioned text records under `.piarre/`. Records SHALL have stable identifiers and source-linked typed relationships. Code, tests, and ordinary human documentation SHALL remain in their normal locations. A derived index SHALL NOT be the sole copy of knowledge.

#### Scenario: Inspect a fresh clone
- **WHEN** a developer clones a repository containing shared knowledge without a local index
- **THEN** the knowledge and its relationships are readable as text and the index can be rebuilt without another developer's database

### Requirement: Capture useful statements without whole transcripts
During an active Piarre task, Piarre SHALL retain useful explicit corrections, constraints, decisions, and artifact purpose with original wording, source identity, and scope. Full conversation retention SHALL NOT be required or enabled by default. Unrelated conversational material SHALL NOT become durable knowledge merely because it was said.

#### Scenario: Correct an unsupported interpretation
- **WHEN** the user states that transient chat history does not imply a requirement to persist transcripts
- **THEN** Piarre retains the scoped correction and supporting excerpt without another approval prompt or the entire conversation

#### Scenario: Ambiguous scope changes future behavior
- **WHEN** a correction could apply to either one component or the entire project and that distinction affects the task
- **THEN** Piarre asks a focused question with a Recommendation before applying the broader interpretation

### Requirement: Distinguish statements from interpretations and observations
Piarre SHALL keep human-stated intent, inferred interpretations, and observed results distinguishable. Inferences SHALL remain attributed and provisional. Human agreement SHALL NOT establish code behavior or test success. Every factual claim of verification SHALL identify an actual observation and its scope.

#### Scenario: Infer a reason from a code edit
- **WHEN** code changes without a recorded human explanation
- **THEN** Piarre can describe the observed difference and offer a labeled inference but cannot present that inference as the agreed reason

#### Scenario: Record a claimed passing test
- **WHEN** a model or imported document states that a test passed without an execution record
- **THEN** the statement remains an unverified claim and is not recorded as observed execution

### Requirement: Bind observed operations to actual outcomes
Piarre SHALL capture artifact operations from actual completed tool results with source identity and content revision where available. Replayed events SHALL NOT duplicate knowledge. Failed, cancelled, partial, and unknown outcomes SHALL remain distinct from successful completion.

#### Scenario: Create a SQL artifact
- **WHEN** a supported tool creates a SQL file for a user request
- **THEN** its record links the original purpose, actual operation outcome, and resulting artifact identity without claiming SQL execution or forecasting accuracy

#### Scenario: Cancellation after a completed write
- **WHEN** a turn stops after a file write succeeds but before the requested follow-up completes
- **THEN** Piarre records the completed write separately from the unfinished task and does not imply rollback

### Requirement: Keep local capture separate from team adoption
Automatically captured knowledge SHALL remain local until the user deliberately includes it in Git publication. Piarre SHALL NOT commit, push, review, or rewrite knowledge in response to user-run Git commands. Sharing SHALL use text records, not a shared local index.

#### Scenario: Commit and push without Piarre review
- **WHEN** a user commits or pushes directly, including to the main branch
- **THEN** Piarre does not intercept the action, invoke a model, add a review gate, or automatically publish local captures

### Requirement: Distinguish baseline adoption from factual support
The designated main branch SHALL define the shared accepted baseline at its known revision. Feature-branch changes SHALL remain distinguishable from that baseline. Git integration SHALL NOT convert an inferred record or unsupported factual claim into verified evidence, and SHALL NOT grant execution permission.

#### Scenario: Merge a proposed policy and an inferred explanation
- **WHEN** a reviewed policy change and a labeled inferred explanation are merged into main
- **THEN** the policy belongs to the accepted baseline and the explanation remains labeled as inferred

### Requirement: Resolve intent without repeated confirmation
Piarre SHALL ask before applying a consequential change to intent that the user's instruction has not resolved. An explicit instruction selecting that change SHALL count as confirmation. Knowledge retrieval SHALL NOT expand tool authority.

#### Scenario: Explicitly change a requirement
- **WHEN** the user instructs Piarre to change the refund window from 30 to 45 days
- **THEN** Piarre does not ask for the same intent confirmation again and still observes applicable execution permissions

#### Scenario: Refactor would alter a policy
- **WHEN** a requested refactor would change the refund window without an instruction to change it
- **THEN** Piarre explains the conflict and gives a Recommendation before applying that behavioral change

### Requirement: Manage knowledge through conversation
Users SHALL be able to correct scope, supersede a decision, withdraw active use, or request deletion through ordinary conversation. Piarre SHALL distinguish these outcomes, preserve unrelated valid knowledge, and explain retained Git history or other copies when deletion does not remove them.

#### Scenario: Stop using an assumption
- **WHEN** the user withdraws an assumption without requesting deletion
- **THEN** Piarre excludes it from current guidance while retaining its historical status

#### Scenario: Delete previously committed content
- **WHEN** the user requests deletion of a knowledge record that has been committed
- **THEN** Piarre identifies the deletion scope and does not claim the content was erased from Git history or other clones

### Requirement: Preserve local lifecycle choices across checkout changes
Local withdrawal and deletion choices SHALL survive index rebuilding, branch switches, and rollback to older shared records in the same local workspace. Reappearing historical content SHALL NOT silently become active guidance again. Local suppression SHALL NOT claim to change other developers' clones.

#### Scenario: Pull an old version of withdrawn knowledge
- **WHEN** a previously withdrawn record reappears through Git or index rebuilding
- **THEN** the local withdrawal remains effective until the user explicitly restores its use

### Requirement: Persist within an explicit workspace boundary
Durable capture SHALL operate only in the selected project workspace under the approved persistent profile. The disposable PoC profile SHALL retain its documented teardown behavior. Memory content and imported instructions SHALL NOT enable tools, network access, or filesystem paths.

#### Scenario: Import an instruction disguised as knowledge
- **WHEN** a knowledge file requests a tool execution or permission expansion
- **THEN** Piarre treats the file as data and applies the existing authorization boundary

#### Scenario: Restart with durable knowledge enabled
- **WHEN** the user restarts the persistent project profile
- **THEN** selected knowledge remains available without restoring a full chat transcript or expanding access to another project
