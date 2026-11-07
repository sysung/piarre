# Bounded arithmetic research prototype

## Problem

Move arithmetic out of generation without mistaking a correct calculation for correct source interpretation or authorization. This is a standalone PR97 research folder, with no extension or SQLite integration. Inputs contain only a question and original indexed, status-bearing sources. Expected answers, private labels, and case-specific formulas never enter inference.

Workflow: grounding skipped for greenfield work; two sketches compared below; implementation and inference remain unstarted. One author, no delegated judge, as instructed. Estimated design usage: medium, high confidence; this is an estimate, not measured consumption.

## Usage: caller's view

The harness makes one comparison call. It does not orchestrate extraction, arithmetic, auditing, or transport stages.

```ts
import { compare } from "./experiment.js";

// Arithmetic: the same input goes to both arms.
const arithmetic = await compare(capacityQuestionWithOriginalSources, runDirectory);
// Ordinary dialogue: arithmetic is optional, not a required response shape.
const clarification = await compare(underspecifiedQuestionWithOriginalSources, anotherDirectory);
// Resume/readback uses the same directory; interrupted slots are never relaunched.
const recorded = await compare(capacityQuestionWithOriginalSources, runDirectory);
```

Each comparison exposes accepted answers, explicit rejections/unknowns, and actual request/usage evidence. A malformed or rejected plan is an experimental failure, not silently converted into a successful abstention. Callers cannot supply a formula or bypass the internal source parser.

## Two whole-shape alternatives

**A. Source-anchored expression tree plus answer generation.** Call one returns either ordinary dialogue or quoted quantities and a bounded expression tree. Code checks anchors and evaluates the tree. Call two receives original sources, the extracted premise, and exact arithmetic, then writes the final answer. Public surface: `answer(input): Outcome`; expression nodes and transport stay internal. This hides flexible computation and prose generation well, but the final generator still owns the actionable conclusion and can contradict correct arithmetic. Checking every number in free prose does not resolve a contradictory yes/no sentence. A third repair pass is forbidden.

**B. Cited quantity/operation tables plus deterministic numeric decisions.** Call one proposes either ordinary dialogue or a small quantity table, operation rows, and a decision specification. Code parses anchored literals and computes the rows. Call two audits the proposed interpretation against the complete originals; it may accept or reject, never repair. Accepted numeric answers are rendered by code from the calculated relation and margin. Ordinary dialogue uses the proposed text only after the same audit. Public surface remains `answer(input): Outcome`; callers never manipulate tables. This hides computation, rendering consistency, and audit sequencing behind one operation, at the cost of a deliberately narrow numerical vocabulary.

| Selection criterion | A | B |
| --- | --- | --- |
| Arithmetic execution bounded | Yes | Yes |
| Final prose can reverse numeric relation | Yes | Numerical decision rendered by code |
| Source/premise interpretation trustworthy by construction | No | No |
| Ordinary dialogue retained | Yes | Yes |
| Generic support without case templates | Flexible expressions | Quantity rows plus three general decision forms |
| Extensible within two calls | Broad generation, weaker consistency | New decision forms require explicit contracts |

## Synthesis decision

Choose **B**. Its smaller answer vocabulary directly addresses arithmetic/conclusion inconsistency while leaving premise selection exposed as a measured risk. Graft A's exact source-span anchors and full-original-evidence second call. Reject A's generative final numerical conclusion. This is one author's comparison, not an independent cross-judge verdict.

Do not add both mechanisms as selectable modes. No integration, theorem prover, retrieval stage, general scripting language, or domain-specific formula catalog belongs in this experiment.

## Shape

Illustrative TypeScript declarations only; no implementation bodies:

```ts
// Public domain API; wire schemas and model client are private.
interface CaseInput {
  readonly question: string;
  readonly sources: readonly IndexedSource[];
}
interface IndexedSource {
  readonly index: number;
  readonly text: string;
  readonly status: "confirmed" | "unconfirmed" | "disputed" | "historical" | "unknown";
}
type Outcome =
  | { readonly kind: "answered"; readonly answer: ResearchAnswer; readonly evidence: RunEvidence }
  | { readonly kind: "rejected"; readonly stage: "input" | "proposal" | "calculation" | "audit"; readonly reason: string; readonly evidence: RunEvidence }
  | { readonly kind: "unknown"; readonly reason: string; readonly evidence: RunEvidence };
interface MatchedResult { readonly direct: Outcome; readonly candidate: Outcome }
declare function compare(input: CaseInput, runDirectory: string): Promise<MatchedResult>;
```

`ResearchAnswer` carries text, supporting source indexes, and provenance distinguishing direct generation, audited ordinary dialogue, and audited numerically evaluated answers. `RunEvidence` contains exact request/response artifacts, input hashes, observed model identity, call-slot states, byte limits, latency, and reported usage or explicit unknown. It never marks source meaning independently verified.

Internal types, reachable only inside the experiment module:

```ts
type QuantityId = string & { readonly quantityId: unique symbol };
type RowId = string & { readonly rowId: unique symbol };
type Ref = { readonly kind: "quantity"; readonly id: QuantityId }
         | { readonly kind: "row"; readonly id: RowId };
interface Anchor { readonly sourceIndex: number; readonly start: number; readonly end: number; readonly quote: string }
interface Quantity { readonly id: QuantityId; readonly literal: Anchor; readonly context: Anchor; readonly unit: Unit }
interface Operation { readonly id: RowId; readonly operator: "add" | "subtract" | "multiply" | "divide"; readonly left: Ref; readonly right: Ref }
type Decision =
  | { readonly kind: "capacity"; readonly used: Ref; readonly limit: Ref; readonly scope: string }
  | { readonly kind: "minimum"; readonly actual: Ref; readonly minimum: Ref; readonly scope: string }
  | { readonly kind: "value"; readonly value: Ref; readonly scope: string };
type Proposal =
  | { readonly kind: "dialogue"; readonly text: string; readonly sources: readonly number[] }
  | { readonly kind: "numeric"; readonly quantities: readonly Quantity[]; readonly operations: readonly Operation[]; readonly decision: Decision };
type Audit = { readonly kind: "accept" } | { readonly kind: "reject"; readonly reason: string };
type NumericProposal = Extract<Proposal, { readonly kind: "numeric" }>;
type CalculationResult =
  | { readonly kind: "calculated"; readonly values: CalculatedValues }
  | { readonly kind: "rejected"; readonly reason: string };

declare function parseProposal(raw: unknown, input: ParsedInput): Proposal;
declare function evaluate(plan: NumericProposal): CalculationResult;
declare function render(plan: NumericProposal, values: CalculatedValues): ResearchAnswer;
```

`ParsedInput`, `Unit`, `NumericProposal`, `CalculatedValues`, and exact rational values have private validated constructors. They are domain types, not caller-supplied wire objects. Semantic acceptance remains a model judgment; there is no misleading `VerifiedMeaning` type.

### Ownership and flow

Three files suffice. `experiment.ts` owns the public comparison, private model adapter, proposal/audit schemas, provenance and allowance journal. `arithmetic.ts` owns numeric syntax, unit bookkeeping, quantity references, arithmetic bounds, and deterministic relation/margin rendering. `experiment.test.ts` owns offline fixtures. A consumer needs one import and no stage coordination, per interface-depth and boundary-discipline.

The candidate's first call proposes a tagged mode. Numeric literals must anchor to exact source spans, or explicitly to the question as user-provided inputs, never as policy authority. Code derives their values using a fixed decimal/cardinal-numeral parser; model-provided normalized numbers are not trusted. Context anchors retain surrounding qualifications and status, rather than replacing the originals with isolated digits.

Operation rows reference existing quantities or earlier rows. No inline constants, forward references, arbitrary variables, functions, imports, code execution, shell, or interpreter network access. A private allowlist has only four binary operators. Limits: 12 quantities, 20 rows, six decimal places, 96-bit rational intermediates and absolute magnitude at most 10^12. Reject unsupported numerals, duplicate IDs, invalid references, zero divisors, overflow and unit mismatches. A flat backward-only table removes recursive nesting. Unit normalization uses one fixed registry; assigning a quantity's semantic unit remains subject to audit.

The second call sees complete original sources and statuses, the question, proposed answer/plan, anchors, and computed values. It checks operand relevance, operator/order, per-item versus total interpretation, units, all mandatory qualifiers, uncertainty, authority, and scope. Acceptance cannot prove these correct: the same small model can rubber-stamp its own error. Rejection ends the arm; no revision/fallback call follows.

Numeric rendering owns the evaluated comparison and margin: capacity uses used <= limit; minimum uses actual >= minimum. It emits those limited numerical conclusions and units, never execution approval. The free scope label is plain text, not executable markup or an authority grant; audit must reject misleading scopes. Nonnumeric prerequisites cannot be bypassed because the arithmetic fits. If the plan cannot express the requested answer without doing so, reject it rather than upgrading arithmetic success into authorization.

## Comparison and operational bounds

Both arms get at most two pinned-Qwen calls: direct draft then source-grounded refinement; candidate proposal then semantic audit. Ordinary dialogue uses the same candidate two-call path. Both second calls retain every original passage; derived drafts/tables are additional context. Keep weights, endpoint, temperature, thinking setting, output allowance and source ordering fixed; record full prompts and actual usage. Never silently shorten originals to fit a table.

Each complete prompt must fit 6,000 UTF-8 bytes, each requested output is capped at 1,024 tokens, and response bytes/time are bounded. Oversize second-stage material is a rejection, not permission to drop evidence. Only the pinned endpoint is reachable. Reserve each call slot durably before sending; an ambiguous completion remains unknown and consumes that slot. Per-comparison directories isolate state, hashes prevent accidental directory reuse for different inputs, and readback never launches replacements. Report all consumed slots and failures, including unequal actual token costs.

## Cheapest development screen

First run offline contracts: valid lookup/clarification/unavailability modes; invented anchors and literals; written numerals and decimals; incompatible units; nonexistent/cyclic references; extra fields; division by zero; magnitude/size bounds; inclusive threshold equality; deterministic contradictory-text prevention; audit rejection; interrupted allowance readback. These are interpreter/transport fixtures, not private expected formulas provided to the model.

Then one fixed, predeclared eight-call screen: one new arithmetic example and one missing-fact example, each through both two-call arms. Inspect exact artifacts for valid structures, completed calculations, preserved prerequisites and complete original evidence. Do not infer quality from two examples or add opportunistic repair calls. Freeze schemas, prompts, parser, renderer and sampling before independently authored fresh paired cases; adjudicate completeness, support, citations and authority separately. Score invalid/unknown outcomes as failures and report costs alongside quality.

## Tradeoffs and residual questions

We accept unsupported numeric forms failing closed in exchange for bounded execution and interpretable failures. We accept an extra semantic audit call in exchange for a chance to catch bad extraction, not independent verification. Can the fixed model reliably choose operands and scope? Does deterministic rendering improve completion without causing excessive rejection? Can it distinguish an unavailable fact from a prerequisite already known to fail? Fresh validation must answer these; existing exposed results cannot.

Red-flag screen: one public operation, one arithmetic owner/registry, no importable wire internals, no two numerical answer paths, no stage-based file chain, and no shared run writer. No red flag is resolved by adding a compatibility wrapper.

Next implementation step: build and test the private bounded table parser/evaluator and fixed renderers before connecting the pinned runtime.
