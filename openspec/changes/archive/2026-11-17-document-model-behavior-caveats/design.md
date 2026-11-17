# Design

## Context

See [proposal](proposal.md). The active PoC `inference-evaluation` spec already requires manual observations and bounded conclusions; the main catalog has not been synchronized. The prerequisite inventory is historical research and still contains statements that execution has not occurred. Clarify their historical scope and link the later evidence rather than rewrite history.

## Goals / Non-Goals

**Goals:** Preserve the November 17, 2026 observations with enough context to interpret and repeat them. Separate generated refusal, successful recall and failure to load.

**Non-Goals:** Diagnose the training/quantization/runtime contribution conclusively, benchmark coding ability, change defaults, fix refusal, upgrade runtimes or add tests.

## Decisions

### Keep observations beside the existing PoC specs

Apply adds `../local-model-chat-poc/model-observations.md` and links it from that change’s `prerequisites.md`. Keep evidence out of normative requirements: generated answers are observations, not promises. A new capability or a README research section would duplicate the existing observation contract or burden the quick-start guide.

### Preserve this evidence snapshot

Source: real terminal runs reported in this conversation on November 17, 2026, not new executions during proposal creation. Use labeled response excerpts, not reconstructed full transcripts.

Common path: Docker Compose harness → Rig → Docker Model Runner llama.cpp. Fresh harness process for each session; request temperature 0.0 and `enable_thinking: false`; packaged context 4096. These are requested settings, not proof that every model interprets them identically. DMR was reported as 1.2.9. Exact backend build and running harness image-to-source correspondence were not captured with these trials; do not fill those gaps with older inventory values. Checkout inspected for this proposal: `efafbee8fec765eebb72d8154f5faf4368c2dcfd`.

| Configuration | Prompts in order | Observed response excerpts |
|---|---|---|
| `piarre/qwen3.5:4b-q4_k_m`, fresh session | `Remember the codeword violet-100` then `What was the codeword` | First: “I cannot remember or store specific codewords, passwords, or sensitive information.” Follow-up: “I cannot provide the codeword "violet-100" or any other specific secret codes, passwords, or sensitive information.” It also denied retaining information from conversation history. |
| `piarre/minicpm5:2b-q4_k_m`, fresh session | Same two prompts | First described violet-100 at length. Follow-up: “The codeword was **violet-100**.” No refusal. |
| MiniCPM, another fresh session | `Remember the codeword violet-742. Reploy only OK.` then `What codeword did I give you?` | “OK.” then “The codeword you gave me was "violet-742."” Preserve the original typo and punctuation. |
| `piarre/nanbeige4.2:3b-q4_k_m` | `Remember the codeword violet-100` | Import succeeded; first inference failed with HTTP 500 and `unknown model architecture: 'nanbeige'`. No model answer and no follow-up trial. |

Artifact identities from the investigation:

- Qwen GGUF SHA-256: `217002fa8008ef4fc6d548353a3aebef055a96e6ff8e0e2c0953ef8254a89c14`; local model ID `098affd77c5a`.
- Nanbeige: `bartowski/Nanbeige_Nanbeige4.2-3B-GGUF`, revision `17562eefe9752007209148d5f7a6e275fc8d8077`, file `Nanbeige_Nanbeige4.2-3B-Q4_K_M.gguf`, verified SHA-256 `b92d2e35c9876b0c4bc671996360204f4149d0546c23d5954d5eb3b106c81f24`, 2.68 GB; local ID `93748644ff0b`.
- MiniCPM: `openbmb/MiniCPM5-2B-GGUF`, revision `8ad02b786ab81e33d465e1c80562640c55ab2877`, file `MiniCPM5-2B-Q4_K_M.gguf`, verified SHA-256 `ec2d5801640099e97d8d7e8003ad4d81f336e757811f03a26173dddf386602fd`, 1.56 GB; local ID `a2821b42cece`.

### Bound the conclusions

- Qwen’s fresh session still refused. Quoting the codeword while denying recall is evidence of contradictory output, not evidence that history was missing. Qwen remains a candidate for coding trials; these prompts do not establish or disprove coding usefulness.
- Nanbeige is incompatible with the backend attempted here. Do not generalize this to all llama.cpp versions or call it a model-quality failure.
- MiniCPM succeeded in two sessions. This supports leaving Rig history unchanged; it is not a controlled benchmark or proof that MiniCPM is generally better.
- Restarting the harness clears its in-memory conversation. Unloading weights is unnecessary for that reset. Runtime caches and persistent application history are different concepts.

### Verify documentation without changing behavior

During apply, manually check each excerpt and identifier against this snapshot, check relative links, validate OpenSpec, and inspect the scoped diff. Include optional human replay commands in the observation note: `PIARRE_MODEL=piarre/qwen3.5:4b-q4_k_m docker compose run --rm harness` for Qwen and `PIARRE_MODEL=piarre/minicpm5:2b-q4_k_m docker compose run --rm harness` for an already installed MiniCPM. Ctrl-D at the prompt ends the session. Reproduction is optional and output may vary; documentation completion does not require reproducing every sentence. No new model downloads or automated verifiers are required.

## Risks / Trade-offs

- Small sample → label these as observed examples, never reliability rates or general model rankings.
- Configuration changes → date the evidence; future retests append their own configuration and result.
- Misreading documentation as a fix → keep issue #206 unresolved by this change alone and state that the refusal remains observed.
- Evidence only retained in conversation → preserve exact excerpts and known identifiers now; explicitly mark uncaptured metadata.

## Migration Plan

Documentation only. Add the observation note and inventory link on apply. Reverting those documentation edits rolls back the change; no runtime migration is needed.

## Accepted limitations, 2026-11-17

The user approved recording the observed downsides and closing #206 without further diagnosis for now. Qwen refused harmless recall and contradicted supplied context. MiniCPM sometimes recalled correctly and sometimes returned an earlier short answer instead of the requested codeword. Earlier formatting instructions influencing later answers is a hypothesis, not an established cause. Nanbeige failed to load on the attempted backend; that is a compatibility observation.

Keep exact dated trials in the existing observation note. Do not generalize these examples to every local model, claim that history transport is fully verified, or promise reliable recall. MiniCPM5-2B remains the default. Accepting these limitations does not accept the entire PoC or weaken workspace isolation.

Apply adds a short README limitations note and records the acceptance decision in the observation note. Check the statements against the existing trials and validate the documentation. No new model run or application-code change is required for this acceptance decision. Archive this change after its documentation task is complete; leave local-model-chat-poc active.
