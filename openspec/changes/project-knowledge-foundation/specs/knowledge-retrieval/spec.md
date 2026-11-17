## Purpose

Supply bounded, relevant project evidence to ordinary Piarre tasks while preserving source identity, applicability, uncertainty, and local control.

## ADDED Requirements

### Requirement: Retrieve specifications and decision rationale with evidence
Piarre SHALL resolve links among requests, applicable specs, ADRs, changes, artifacts, and observations without duplicating authoritative content. Retrieval SHALL distinguish adopted behavior, proposed deltas, decision status, and archived history. Missing links SHALL remain explicit; Direct work SHALL NOT require a fabricated spec or ADR.

#### Scenario: Retrieve a linked architectural rationale
- **WHEN** the user asks why an artifact follows a particular design and the relevant spec, ADR, change, and evidence are linked
- **THEN** Piarre retrieves the relevant source excerpts with their status and distinguishes intended behavior from observed implementation

#### Scenario: Retrieve a Direct task without an ADR
- **WHEN** an artifact has a recorded purpose but no architectural decision or spec change
- **THEN** Piarre answers from the available purpose and evidence without inventing the missing links

### Requirement: Retrieve during ordinary conversation
Piarre SHALL retrieve relevant project knowledge for ordinary tasks without requiring a memory command or manually populated form. Answers SHALL distinguish original statements, provisional interpretations, and observations, and provide resolvable source references for knowledge-dependent claims.

#### Scenario: Explain a SQL artifact after restart
- **WHEN** a later session asks why a captured SQL artifact was created
- **THEN** Piarre returns its recorded business purpose with the original request reference and artifact relationship, without inventing validation or forecast accuracy

#### Scenario: Avoid a previously corrected mistake
- **WHEN** a later task concerns session history and a relevant correction says transient chat does not imply transcript persistence
- **THEN** Piarre uses that scoped correction and does not repeat the unsupported inference

### Requirement: Reconcile sources before using an index
Before using indexed knowledge, Piarre SHALL detect relevant source changes and reconcile its local view without model calls, Git hooks, or a manual sync step. An unavailable or rebuilding index SHALL NOT permit stale evidence to be presented as current. Reconciliation SHALL NOT rewrite canonical source files.

#### Scenario: Pull or manually edit knowledge
- **WHEN** the user changes tracked records and later asks Piarre a relevant question
- **THEN** retrieval reflects the changed records or reports that a current view is unavailable, without invoking AI merely because the files changed

#### Scenario: Lose the local index
- **WHEN** the derived index is deleted or corrupted
- **THEN** Piarre rebuilds it from source records without losing local lifecycle choices or requiring a teammate's database

### Requirement: Isolate project and checkout context
Piarre SHALL retrieve within the selected project and current worktree, including eligible local captures. It SHALL identify the known baseline revision and relevant branch-local changes without automatically fetching or switching main. Unknown baseline freshness SHALL remain unknown.

#### Scenario: Switch branches or worktrees
- **WHEN** the user moves from a feature checkout proposing 45 days to a checkout still specifying 30 days
- **THEN** retrieval reflects the selected checkout and does not import another branch's local captures as accepted guidance

#### Scenario: Reference the main baseline offline
- **WHEN** Piarre has only a locally observed main-branch revision
- **THEN** it can cite that revision but does not describe it as the latest remote main

### Requirement: Bound context without silently losing constraints
Piarre SHALL assemble a bounded context from relevant records, exact excerpts, and typed links. It SHALL retain relevant explicit corrections and contradictions in the selected context or disclose insufficient coverage. It SHALL provide a way to retrieve original records and additional evidence. Lossy summarization SHALL NOT replace canonical sources in this change.

#### Scenario: Evidence exceeds the available budget
- **WHEN** relevant evidence cannot fit within the task's context budget
- **THEN** Piarre retrieves narrower passages or additional bounded steps, or reports insufficient coverage instead of silently omitting a required constraint and claiming a complete answer

### Requirement: Distinguish durable intent from stale observations
Accepted policies SHALL remain applicable until their scope, expiry, revocation, or supersession changes. Observations SHALL identify the source revision and configuration they establish. Changed referenced content SHALL invalidate current verification for affected observations while preserving historical evidence. Unknown coverage SHALL remain unknown.

#### Scenario: Modify a previously observed artifact
- **WHEN** the SQL contents change after an observation was recorded
- **THEN** the historical purpose remains available while the observation no longer establishes the current artifact's behavior

#### Scenario: Retain an old applicable policy
- **WHEN** a policy is old but remains in scope and has not expired, been revoked, or been superseded
- **THEN** Piarre does not require reapproval solely because of its age

### Requirement: Expose conflicts and broken sources
Piarre SHALL identify malformed records, duplicate conflicting identities, unresolved merge markers, broken links, and unsupported revisions. It SHALL exclude affected content from settled guidance while reporting the limitation. It SHALL NOT automatically resolve conflicts or choose a version as truth.

#### Scenario: Encounter a conflicted correction
- **WHEN** a relevant record contains unresolved merge markers
- **THEN** Piarre reports the conflict rather than using the old cached correction or silently selecting either side

#### Scenario: Remove the original artifact
- **WHEN** an artifact reference no longer resolves
- **THEN** historical statements remain labeled as historical and the missing current source is reported

### Requirement: Retrieve before asking and respect uncertainty
Piarre SHALL inspect available relevant sources before asking the user for facts it can obtain. Missing or contradictory evidence SHALL produce a specific uncertainty and Recommendation. Authorized low-impact assumptions SHALL remain visible and provisional; consequential unresolved changes SHALL require clarification before application.

#### Scenario: Find no reason for an ordinary code edit
- **WHEN** the available sources establish the edit but not its purpose
- **THEN** Piarre says the purpose is unknown, labels any proposed explanation as an inference, and does not create a confirmed decision from the edit

### Requirement: Avoid inappropriate use of retained knowledge
Piarre SHALL exclude unrelated project context and withdrawn guidance from active use. Relevance SHALL NOT be inferred solely from a shared keyword, source count, or the existence of a graph link. Historical and superseded records SHALL be available for historical questions with their status intact.

#### Scenario: Ask about a different component
- **WHEN** a correction is scoped to billing and the task concerns an unrelated component
- **THEN** Piarre does not silently generalize the correction to the unrelated task

#### Scenario: Ask about superseded intent
- **WHEN** the user asks why a previous policy existed
- **THEN** Piarre can retrieve that policy as history without restoring it as current guidance
