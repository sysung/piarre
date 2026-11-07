# The local reply fix reaches parity but fails promotion

The frozen comparison does not show an advantage over direct Qwen. Both independent reviewers scored 24 of 32 samples as faithful, complete and adequately cited in each arm. Piarre had two prerequisite or authority problems and one rejected truncated reply. Keep PR #99 in draft.

| Outcome | Piarre candidate | Direct Qwen |
| --- | ---: | ---: |
| Accepted responses | 31/32 | 32/32 |
| Strict semantic passes, each reviewer | 24/32 | 24/32 |
| Strict passes in repetition 1 | 12/16 | 12/16 |
| Strict passes in repetition 2 | 12/16 | 12/16 |
| Cases passing both repetitions | 10/16 | 12/16 |
| Samples with prerequisite or authority problems | 2 | 0 |

There were sixteen independent synthetic cases, each repeated twice per arm. Repetitions are not additional independent tasks. Reviewers agreed on strict pass counts and safety flags, with three disagreements across individual dimension labels. Their rationales and all outputs are retained in `results`. Presentation can reveal the generating arm, so the review was only partially blinded.

## What failed

- Applied arithmetic remained unreliable even though the complete required source evidence was present. Replies contained incorrect totals, contradictory conclusions, invented ambiguity and wrong margins.
- One Piarre response exhausted the 1,024-token limit while repeatedly revising a capacity calculation. Its finish reason was `length`; the controller rejected it and saved an unknown outcome. The discarded partial response was not counted as an accepted answer.
- One Piarre answer granted qualification despite stating a below-threshold result. Another requested generic permission to disable captions while a specified steward exemption was absent. The latter authority-bypass interpretation is explicit in both reviewers' rationales.
- Some clarification attempts repeated the original decision question instead of asking for the missing fact. A clear declarative request counted as useful clarification. Question punctuation alone was not scored.

The source facts, generation settings and model digest matched. Direct Qwen received ordinary indexed source text and free-form output. Piarre used the actual controller/client and reviewed context. Private criteria were absent from model prompts. All 64 dispatched requests returned the pinned model digest. There were no retries. All 32 saved Piarre states reopened with zero task, proposal, execution or coordination effects, including the unknown outcome. This verifies the discussion boundary, not answer usefulness.

Candidate commit was `2bf1d2f9ea168f5b8f9fb9230aa5925c62a03689`. The independent suite hash was checked before use and the candidate was committed before opening it. See `protocol.md`, `results/runtime-report.json` and `results/state-audit.json`.

## The decoding diagnostic did not justify another change

After the comparison, a fifteen-call development diagnostic replayed the four clarification prompts and the failed computation prompt. It tested original greedy generation, Qwen's recommended general non-thinking sampling profile, and that profile with generic JSON-object grammar. One sample per cell screened hypotheses only.

Greedy replay reproduced the truncated computation. The recommended profile finished, but claimed 24 remaining positions while its own arithmetic yielded one. Adding generic JSON mode returned the computation question without answering it. That mode also failed to request the missing crop in one clarification. These changes do not establish reliable completion and are not promoted.

Docker documents generic JSON mode, and Qwen documents sampling and presence-penalty settings intended to reduce repetition. API acceptance does not independently confirm effective backend sampler values. [Docker API](https://docs.docker.com/ai/model-runner/api-reference/) and [Qwen model card](https://huggingface.co/Qwen/Qwen3.5-4B).

## Next hypothesis

Before building a larger index, test the upper bound of source filtering on the exposed arithmetic failures. Compare the existing complete-context responses with new responses containing only the independently specified required original passages. This oracle diagnostic deliberately uses known relevance labels to remove distractors. It cannot demonstrate a deployable retrieval improvement. If arithmetic still fails with only relevant evidence, prioritize computation and decision validation over another retrieval rewrite. Any later automatic selector needs a separate fresh corpus and a strong matched-budget direct control.

See `results/research.md` for primary-source findings and their limits. None of these experiments establishes everyday readiness or superiority over direct Qwen. The suite is now exposed development data.
