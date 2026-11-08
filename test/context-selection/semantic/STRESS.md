# Additional retrieval regression cases

Run `node --test test/context-selection/semantic/retrieval.test.mjs test/context-selection/semantic/stress.test.mjs` from the repository root.

These six synthetic development/regression cases extend the existing selector tests. They are not independent holdouts or generated-answer evaluations. They cover three required sources under a two-source budget, a lexical paraphrase miss, conflicting/historical standing, observation versus authorization, 120 distractors with a cross-project duplicate ID, and deletion/withdrawal. They deliberately preserve retrieval limitations instead of changing the selector to pass examples.

Validation: all 14 tests passed on Node 24.22.1. Zero model requests. Original holdout artifacts are unchanged. Preserving a standing label does not establish that a model obeys it; project filtering does not establish user authorization.

The existing `lexical2` arm already calls Qwen directly with selected original records. A separate call with identical prompt and envelope is a reproducibility diagnostic, not another independent treatment. The remaining production comparison belongs in #95: use the reviewed selected excerpts in both the controller and direct-adapter arms, pin model/configuration, and record selection, accepted answer, unsupported claims, clarification, tokens and latency separately.

Before a new accuracy evaluation, independently author and freeze new project families, public source/question hashes, private keys, candidate commit, rubric and run budget. These exposed cases must remain regression evidence. Large-corpus retrieval and complete-prompt byte limits must be reported separately; never silently truncate a required source to fit the model.
