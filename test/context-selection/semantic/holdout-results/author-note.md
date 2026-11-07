# Independent semantic-retrieval fixture authoring

Authored before seeing embeddings, vector rankings, candidate implementation or answers. No candidate code, previous corpora or experiment outputs were inspected during this task. Prior general experience designing bounded-answer evaluation is not independence from the research topic; independence here concerns these newly authored sources, questions, keys and unseen method outputs.

The development cohort has one fictional project with 12 records and eight questions. The holdout cohort has two different fictional projects, each with 12 records and eight questions. Holdout content and keys should remain unopened by the implementing team until the candidate is frozen. This note intentionally does not reveal holdout domains, facts or expected answers.

Within every project, four questions are single-source factual paraphrases, two deliberately combine two records, and two concern missing information, unavailable rationale or unresolved evidence. Mandatory prerequisites also occur among single-source and combined-record questions. The development cohort includes an explicit missing-fact request and an unavailable rationale. Across the holdout, ambiguity, observation status and conflicting confirmed instructions are represented. Not every project contains every category.

Sources include disjoint topics, nearby distractors and superseded material. Titles and every source field are public evidence available identically to direct answering and retrieval. Fixed project filtering is mandatory. Required-source keys are separate from public question files and must never enter embeddings, retrieval features or answer prompts. A selected pool should retain the original project's source indexes; citation evaluation must use the corresponding index-to-ID map.

There are no numerical computation questions. Numeric policy lookups do not require arithmetic. Natural source records state project facts, policies and evidence limits; no source embeds evaluator labels, an answer rubric or an expected formula. Cases are not selected against observed method failures and do not establish a predetermined winner.

Clarification is judged by meaning: a concise declarative request for the missing fact is sufficient. A claim-free clarification or statement that rationale is unavailable may omit citations, even when the key lists sources needed to substantiate a fuller factual explanation. Other substantive claims must be supported by their actual sources; mechanically demanding every listed ID from a claim-free reply would be incorrect. Exact quotations or answer wording are never required. Concise sufficient answers receive full credit.

Runtime declarations do not prove completion. Missing receipts do not prove failure. An unverified observation is not a confirmed cause, and an unresolved cause does not exclude the hypothesis. Conflicting current instructions have no invented precedence. Generic permission cannot replace a named mandatory prerequisite. Unknown rationale remains unknown.

Validation checked unique IDs, project-local key references, at most three required IDs, exact public question fields, source length limits, standing values, positive revisions, and each project's 12-record pool. Byte measurement serializes question plus all verbatim source metadata/text with original indexes, then reserves 1,000 additional UTF-8 bytes for instructions. A selected top-three pool is smaller than its corresponding full pool. These bounds assume a compact JSON prompt rather than decorative pretty printing. No model or retrieval calls were performed.

Maximum full-pool prompt bytes, including the reserved 1,000-byte wrapper: {"dev": 4565, "holdout": 4794}.

## SHA-256

- `dev-sources.json`: `9a3eca64a3b0f2f640a47a061fe4f35bb061e3bb39ce31833aed2ec0a4f841c5`
- `dev-questions.json`: `8331256e7687f2bc1489186dd6a6dfe808ebd8250caeb1084266c9aa0e8be0bb`
- `dev-keys.json`: `b93b0dc1f29cf45dac10e98355661a7e161caefc9a34d79642bd8fde99f66c4a`
- `holdout-sources.json`: `cc9e67679e282dab1f08b1873ce5613555f3e08caafd298be681d79aeb13556c`
- `holdout-questions.json`: `184a5fd529f809c7b8c128e26f2cc62e4a80d8638518485e7bc30b19dd237d71`
- `holdout-keys.json`: `11a2d7df7e9670f594345d0074cd3d0863e8dc940a99e652ad9647cc22d78368`
