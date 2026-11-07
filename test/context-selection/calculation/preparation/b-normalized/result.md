# Prototype B: normalized source literals and shared numeric index

Only isolated B files changed: `arithmetic.mjs`, `arithmetic.test.mjs`, and this note. No repository edits, inference, GitHub, delegation, or promotion claim.

## Current boundary

The model-authored B protocol is unchanged: a quantity names an original source, an exact quotation, and a numeric token. The normalized model token may match a source cardinal/decimal only at exactly the same reduced rational value. Evaluation derives its value from the actual original token, with source ID, quote, original offsets, actual token and model token retained in `operands`.

The hyphen refinement accepts a scalar followed immediately by a hyphen and a whole nonnumeric alphabetic word, such as `50-minute`, `four-point`, `18-tray`, or an unfamiliar word modifier. ASCII, Unicode hyphen and nonbreaking hyphen are supported. No unit-name allowlist is used. A supported cardinal, scale word, fraction word, digit range, alphanumeric suffix or underscore fragment does not receive that exception. Prefix/sign protections remain strict. An alphabetic suffix alone cannot establish whether the prose denotes a valid unit or an identifier: accepting its scalar is lexical support only. Every positive case still returns `unitValidation: 'not-established'` and `semanticValidation: 'not-established'`.

Negative cases continue to reject 8 from 18/eighteen, dropped/trimmed signs, numeric ranges, unsupported compounds/fractions, ID fragments embedded beside digits/signs/underscores, wrong-source quotes, unknown references and unconfirmed operands. An absent permission record cannot manufacture numeric zero. A genuine written source zero remains a lexical number, not a permission judgment.

A missing own `qualifiers` field normalizes to `[]`; present malformed/null/undefined values reject. Supplied qualification quotes remain checked against their named originals. Missing qualifiers provide no semantic or authorization assurance. Existing input/literal/quantity/row/output/qualifier bounds, rational limits, division-by-zero rejection, arithmetic/operator/reference checks, deterministic rendering and no-authorization wording remain.

## Shared index graft

`numericIndex(input)` and B's normalized validation now call one private `sourceLiterals(source)` scanner. Shared `sourceMap(input)` applies the existing input byte/source/identity validation to both APIs. There is no duplicate boundary implementation.

The index returns JSON-safe entries:

```text
{id: 'q1'..., sourceId, token, quote, value, status, start, end}
```

IDs follow original source order and token order. `token` and offsets identify the full actual source literal; `value` is the exact integer/fraction string. `quote` is the original token plus up to 40 original JavaScript string characters on each side. More than 24 supported occurrences throws rather than truncating. Duplicate source IDs and malformed/oversized inquiries throw through the shared validator.

Only `confirmed` and `user-input` sources supply index operands. `unconfirmed`, `disputed`, `historical`, `unknown`, and all other statuses are excluded from usable IDs, matching `assess`. No source record is removed or rewritten: the index is a derived list, not a replacement evidence corpus. The parent must keep all original source texts/statuses in model and audit prompts. B retains its quantity/quote normalization protocol; the parent may consume this same index for A. No A planner, operation-ID assignment, or inference was implemented here.

## Test evidence

Before the original normalization change, the normalized-cardinal regression failed with `Six`: expected `numeric`, actual `rejected`.

Before the hyphen refinement:

```text
node --test --test-name-pattern='accepts a literal before an unverified word modifier' arithmetic.test.mjs
# tests 5; pass 0; fail 5
```

The failing cases were the ordinary word-modifier examples, including an unfamiliar modifier and a nonbreaking hyphen. After the refinement and shared-index graft:

```text
node --test --test-reporter=spec arithmetic.test.mjs
# tests 89; pass 89; fail 0; cancelled 0; skipped 0; todo 0
node --check arithmetic.mjs             # exit 0
node --check arithmetic.test.mjs        # exit 0
```

All 19 original arithmetic tests remain intact, alongside 70 added regression tests. Index checks cover complete `Eighteen`, exact decimal `0.125 = 1/8`, source identity/status, JSON serialization, original context/offsets, index-to-assess consistency, the 24/25 boundary, duplicate source IDs, absent-permission non-numeracy, and shared lexical acceptance/rejection.

## Rationale and limits

B needs a normalization boundary because equivalent representations are not new facts. A hyphen followed by an ordinary word does not change the scalar; treating every such hyphen as a range/sign incorrectly discarded useful literals. This correction recognizes lexical structure without asserting unit meaning. Sharing the scanner lets A and B differ in preparation protocol rather than in hidden lexer rules.

Semantic quantity selection, unit assignment, formula correctness, relevance and qualification completeness remain unestablished. Finite guards deliberately reject unsupported numeric constructions and are not a complete natural-language number parser. The parent bakeoff remains necessary, and exposed development cases provide no fresh-validation claim.

SHA-256 arithmetic.mjs: `0bdbdb152f627d9378df160d388630bceb4cea0453e5dccca002ca7086775dd0`
SHA-256 arithmetic.test.mjs: `7ce9b851df74db4bcc528c389bf1743e4f39dc5f9fdbfb8a69340782b1745306`
