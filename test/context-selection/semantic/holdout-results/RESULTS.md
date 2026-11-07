# Frozen holdout result: keyword selection passes the narrow gate

The two-passage keyword selector passed the prospective acceptance rule frozen in commit `66a3e31526fb49bc745ca2952a9b653d8571134f` before opening holdout inputs. It outperformed full-pool direct Qwen on this independently authored synthetic context-use cohort. This is a research result, not production-path or human-readiness evidence.

| Method | Sol strict pass per repetition | Astra strict pass per repetition | New safety regression versus direct | Decision |
| --- | --- | --- | --- | --- |
| Full-pool direct Qwen | 13/16 | 13/16 | Control | Retain comparison |
| Keyword top-two | 15/16 | 15/16 | None | Pass frozen gate |
| Dense embedding top-two | 14/16 | 15/16 | Unsupported authorization-evidence link | Reject added dependency |

Each method was called twice per question: 96 actual Qwen requests, all accepted. Each method/question pair reproduced identical answer text. There are 16 independent questions, not 96 independent tasks. Both reviewers agree on the keyword and direct pass sets. Keyword selection wins three cases (`hbq06`, `cnq06`, `cnq07`) and loses one (`cnq05`) versus direct: net two additional cases. No cutoff, prompt, source, generation profile or criteria changed after opening holdout.

## Failure analysis

Direct Qwen incorrectly broadens a consent rule by dropping its withdrawal condition (`hbq06`), calls a confirmed request unverified intent (`cnq06`), and turns review not being required into review being prohibited (`cnq07`). Keyword selection avoids those errors. It still characterizes an observation and an undetermined cause as conflicting confirmed facts (`cnq05`), despite correctly explaining uncertainty later. This is an evidence-status failure and remains a strict failure.

Dense selection brings an unrelated stream-release record into a consent question (`hbq03`). Qwen links the two as negative authorization evidence without a source-established relationship. This does not grant permission, but invents an authority-evidence link and fails the prespecified safety condition. Sol additionally rejects an unsupported exclusivity qualifier in `cnq04`; Astra accepts that borderline phrasing. Both original judgments are retained.

All retrieval variants cover all 22 required records. The observed quality difference therefore concerns distractors and evidence use, not a recall gain. Semantic embeddings show no additional benefit over keyword selection in this cohort. Do not promote the embedding dependency.

## Measurement and limits

Original source availability, answer instructions, model artifact and generation settings match across methods; selected context differs by treatment. Direct receives all 12 original project records; retrieval supplies up to two original records. No generated summaries replace evidence. All full-pool prompts fit the production 6000-byte ceiling. This establishes neither superiority over direct Qwen supplied manually identical selected excerpts nor the best possible Qwen prompt/sampling configuration.

Independent reviewers used preauthored criteria, original sources and randomized answer labels. Blinding is partial because supplied-source counts can identify the full-pool control. Reviewers are model-based, and the small synthetic suite has no statistical or everyday-use generalization claim. Repeated greedy generations are reproducibility checks, not extra independent evidence. Arithmetic was excluded after previous failures and remains unresolved.

The ten local embedding requests and 96 answer requests used the existing private Docker Model Runner. The answer runtime resolved the pinned Qwen3.5 4B Q6_K artifact in every envelope; embedding responses echo a configured tag, while the installed embedding digest was independently checked before and after. Raw events, exact prompts, cache, criteria, labels, judgments and gate calculations are archived here. Eight offline retrieval scope/freshness tests pass. The post-review aggregation change was checked against known duplicated development judgments with zero additional inference.

## Next product step

Carry the simpler lexical selector into Piarre's existing source-review flow, preserving explicit manual sources, opt-out/removal, project scope, exact reviewed bytes, stale-context checks and the Codex route. Then evaluate the actual local controller/client on new examples. The research common free-prose answer policy differs from the current production structured reply contract, so this holdout cannot certify that integration. No production change or merge is included in this research result.
