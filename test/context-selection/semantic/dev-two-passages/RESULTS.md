# Two passages passed the development screen

Both independent reviewers scored lexical and dense top-two retrieval8/8 for faithful, complete, adequately cited answers, with no authority/evidence flags. Direct full-context Qwen scored6/8 and7/8 under the two reviewers. All24 responses were complete and returned without protocol errors. The direct-control prompts and generation settings were byte-identical to the previous run; all8 direct response texts reproduced exactly.

All11 required source IDs remained covered. The shared unsupported diagnostic-absence inference disappeared when the unrelated third record was removed. This is a development observation, not proof that fewer passages always help. Fixed top-two retrieval can miss a third necessary record on another question. No weights or answer instructions changed. Cache reuse required zero embedding requests; the run made24 actual local Qwen calls.

Keyword and semantic retrieval are tied here. Prefer the simpler keyword method unless independent fresh evidence establishes an added semantic-search benefit. The holdout test will compare both against the same full-source direct baseline prospectively; it will not change source budgets or prompts after reading holdout inputs. All original review disagreements are retained.
