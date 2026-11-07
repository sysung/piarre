# Bounded arithmetic assistant: design candidate

## Problem

The experiment must distinguish faulty arithmetic from faulty interpretation while preserving ordinary discussion. The same small model must select relevant facts and answer questions; a calculator can improve numerical execution but cannot establish whether selected quantities, operators, prerequisites, or authority are appropriate. This is a standalone research module under PR97, with no production imports or changes. Grounding is intentionally skipped because no integration is proposed.

Estimated design/implementation complexity: low to medium; confidence medium. This estimate is not measured model usage. One worker suffices. Workflow status: grounding skipped; sketch complete; agreement, implementation and possible redesign belong to the parent workflow.

## Usage (caller's view)

The experiment invokes one function with the question and original evidence. It receives either a supported-format response plus inspectable computational trace, or an explicit failure. There is no public extract/evaluate/render choreography.

```ts
import { investigate } from './arithmetic-research/index.js';

// A question containing quantities still might require a clarification.
const clarification = await investigate({
  question: 'Which heater setting should batch K use?',
  sources: originalBatchRecords,
}, { signal, attemptDirectory: batchAttempt });

// An ordinary calculation uses precisely the same entry point.
const capacity = await investigate({
  question: 'Will the containers fit, and what space remains?',
  sources: originalLoadingRecords,
}, { signal, attemptDirectory: loadingAttempt });

// The module owns this exclusive directory and records every launch.
const result = await investigate(freshCase, { signal, attemptDirectory });
report(result);
// A separate, frozen adjudicator judges meaning and task completion.
```

The baseline harness independently drafts and refines an answer from the identical original evidence using the identical pinned endpoint, weights and request ceilings. It does not receive this module's trace or hidden expected answers.

## Shape

Select **source-anchored expression trees plus a second answer call**. Call one returns either an ordinary answer/clarification/unavailability response, or a proposed calculation plan. The module validates the plan, computes it, and supplies its results alongside all original evidence in call two. Call two answers the user's question. Computation results are explicitly conditional on the model's selected premises and operations; they carry no authorization status.

There are three files: public `index.ts` owns the conversation, parsing and bounded pinned transport; private `arithmetic.ts` owns the expression language, source anchoring and evaluation; `screen.test.ts` owns offline contract examples. Raw request bodies, attempt accounting and prompt construction remain internal to `index.ts`. A dependency-free package export exposes only the entry point and public domain types. The module owns its attempt directory, launch ledger and final trace; the harness only reads these artifacts. No framework or source-ranking abstraction is needed.

```ts
export type Evidence = Readonly<{
  id: string;
  text: string;
  status: 'confirmed' | 'unconfirmed' | 'disputed';
}>;
export type Inquiry = Readonly<{
  question: string;
  sources: readonly Evidence[];
}>;
export type Response = Readonly<{
  text: string;
  sourceIds: readonly string[];
  intent: 'answer' | 'clarify' | 'unavailable';
}>;
export type Failure =
  | 'invalid-input' | 'model-output' | 'invalid-plan'
  | 'arithmetic-limit' | 'transport' | 'cancelled';
export type Investigation =
  | { kind: 'responded'; response: Response; trace: ResearchTrace }
  | { kind: 'failed'; reason: Failure; trace: ResearchTrace };

export async function investigate(
  input: Inquiry, options: { signal: AbortSignal; attemptDirectory: string }
): Promise<Investigation> { throw new Error('not implemented'); }
```

`ResearchTrace` contains the exact input, request/response artifacts, observed model identity, per-call bytes and available token usage, elapsed times, proposed plan, validation result and computed values. Usage absent from the runtime remains unknown. It stores `semanticValidation: 'not-established'`, including for successful arithmetic. Transport failures may retain discarded content as explicitly unaccepted evidence, never as the response.

The following private types exist only after parsing. Brands have module-private constructors; external model JSON never becomes a trusted plan through a cast.

```ts
type QuantityId = string & { readonly quantityId: unique symbol };
type Rational = { numerator: bigint; denominator: bigint }; // reduced; denominator > 0

type Anchor = {
  sourceId: string;
  start: number; end: number; // UTF-16 offsets into unchanged original text
  quote: string;             // must equal text.slice(start, end)
};
type Quantity = {
  id: QuantityId;
  anchor: Anchor;
  tokenStart: number; tokenEnd: number; // numeric token within quote
  value: Rational; // derived by code, never trusted model-provided value
  meaning: string; // model assertion, not verified semantics
};
type Expr =
  | { kind: 'quantity'; id: QuantityId }
  | { kind: 'binary'; op: 'add' | 'subtract' | 'multiply' | 'divide';
      left: Expr; right: Expr };
type RequestedCalculation =
  | { kind: 'value'; label: string; expression: Expr }
  | { kind: 'comparison'; label: string;
      relation: 'lt' | 'le' | 'eq' | 'ge' | 'gt'; left: Expr; right: Expr };
type CalculationPlan = {
  quantities: readonly Quantity[];
  outputs: readonly RequestedCalculation[];
};
type FirstTurn =
  | { kind: 'response'; response: Response }
  | { kind: 'calculation'; plan: CalculationPlan };

function parseFirstTurn(raw: unknown, input: Inquiry): FirstTurn {
  throw new Error('not implemented');
}
function evaluate(plan: CalculationPlan): readonly ComputedOutput[] {
  throw new Error('not implemented');
}
```

`ComputedOutput` contains either an exact rational result or a boolean numeric comparison, its original expression, and a code-derived union of contributing source IDs. Labels remain quoted model descriptions. Comparison truth means only that those numerical operands have that relationship; it never becomes an `authorized`, `safe`, or `accepted` state.

Boundary validation owns all invariants, per boundary-discipline. Require unique evidence and quantity IDs, existing references, exact anchored quotations and numeric tokens, supported object keys and variants. Initially accept ordinary signed decimal numerals, including one through twelve as an explicit lexical normalization table; reject ambiguous number formats or unsupported spelled numbers rather than guessing. No uncited constants, free identifiers, function calls, conversions or model-supplied computed values. Quantity references resolve through one immutable map built during parsing. Unit strings and quantity meanings are displayed as unverified source interpretation; no dimensional-validity claim is made.

Limits are fixed module constants: at most 20 sources, 6,000 UTF-8 bytes of original inquiry, 16 quantities, 8 outputs, 64 total expression nodes, depth 8, 128-bit rational components, and absolute intermediate magnitude at most 10^12. Reject division by zero and every limit violation before producing results; bound operands before multiplication. Exact decimal-to-rational conversion avoids binary floating-point surprises. Return a fraction when a result has no terminating decimal. Scientific notation and implicit rounding are unsupported initially.

Transport fixes endpoint/model/digest configuration for the experiment, bounds each response and generation, disables tools and thinking, rejects redirects and unexpected model identities, and observes cancellation without claiming backend termination. Persist a launch reservation before each outbound attempt. Each attempt directory is exclusive and never resumed or retried automatically. A crash leaves that reservation consumed; a new explicitly launched experiment uses a new directory. Exactly two calls maximum; an early ordinary response or a rejected plan uses one. No third repair call. Second-call envelope overhead gets an explicit fixed cap identical to the direct control, with both actual input sizes reported; never silently truncate original sources to fit computed data.

Call-two output parsing checks nonblank text and citation membership. It cannot prove every prose conclusion agrees with computed results. Independent assessment must therefore examine both response and trace. No regex-based promise of semantic safety is added.

## Alternatives considered

**B: Cited quantity/operation table with deterministic decision rendering.** Call one emits a bounded acyclic table: anchored quantity rows, arithmetic rows referring only backward, and a requested comparison/remainder row. Code evaluates each row and renders a fixed sentence for templates such as capacity-fit, threshold-margin, or elapsed-time. Ordinary nonnumeric cases use a separate ordinary response branch. This avoids second-generation arithmetic contradictions and can finish in one call. Its single public function is deep, but internally its template taxonomy owns task semantics as well as calculations; extending domains requires new decision families and rules about what a true comparison permits. A row labeled “eligible” can accidentally turn a numerical threshold into permission. It is credible for a deliberately narrow calculator, not this mixed discussion comparison.

**A: Anchored tree plus answer call**, selected above, has a similarly small interface and a smaller semantic commitment: bounded arithmetic and numeric comparisons only. It preserves arbitrary questions and exposes remaining model reasoning to adjudication. It costs a second generation for calculations and does not eliminate prose contradictions.

## Synthesis decision

Use A as the base. Borrow B's code-derived provenance and exact result rendering in the evidence supplied to call two. Reject deterministic task-decision templates: they would make the smallest experiment depend on an expanding library of manually encoded task meanings. Do not merge both expression representations or offer a renderer selection flag.

## Tradeoffs accepted

- Accept conservative unsupported-plan failures in exchange for no generated-code execution or invented constants.
- Accept one-call early answers and report their lower cost; compare against the stronger two-call direct control without claiming identical realized spend.
- Accept semantic and prose errors as measurable outcomes rather than relabeling a valid calculation as a validated answer.

## Open questions and risks

Could the model choose the wrong source occurrence or operator while all anchors pass? Yes; exact anchoring proves quotation identity only. Could it omit an approval prerequisite, misstate units, or ignore computed output? Yes; all remain full-response failures in blinded adjudication. Would a sufficiently broad template library outperform A? That is a separate experiment, not a fallback inside this one.

## Cheapest development screen

First run credential-free boundary tests: valid anchored calculations with changed numeric values, shuffled source order, zero division, excessive depth/size, unknown IDs, altered quotes, duplicate IDs, arbitrary-code-shaped payloads, rational overflow, cancellation and consumed launch reservations. Expected arithmetic in these unit tests verifies the evaluator only and is inaccessible to model prompts.

Then freeze the first draft of both prompts and run six newly authored public development questions: one lookup, one missing-condition question, one unavailable fact, one authority-gated numerical question, and two different arithmetic compositions. Randomize arm order; use identical original evidence. Maximum 24 calls across both arms, fewer for early candidate responses. Stop before fresh validation if plan extraction usually fails, candidate authority handling degrades, or no arithmetic benefit appears. Revise only on development evidence; freeze code, prompts and limits before independently authored fresh evaluation. Score task completion, every material claim, citations, mandatory conditions, plan validity and arithmetic separately; report actual costs and failures without excluding hard cases.

## Next implementation step

Build the private anchored arithmetic parser/evaluator and its offline adversarial screen before connecting the single public entry point to the pinned runtime.
