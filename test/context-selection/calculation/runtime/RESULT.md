# Requested thinking mode changes observed behavior

A two-call diagnostic used the same arithmetic expression and pinned model, temperature0 and cap256. With `enable_thinking:false`, the runtime returned the correct result5 in visible content with zero reasoning characters. With `enable_thinking:true`, it returned771 reasoning characters and no final content before the256-token cap. Both responses identified the pinned digest. This establishes a behavioral difference for this installed runtime and request, not independent verification of all sampler parameters.

Docker Model Runner client/server both reportedv1.2.9. Read-only model inspection confirmed the expected artifact digest and GGUF format. No engine configuration or model weights were changed. The detailed reasoning text was not exported; the signal log records only its character count.

Upstream reports of ignored thinking flags concern particular versions and CLI paths. They motivated checking the local behavior, not assuming this runtime had the same defect. The installed release includes the supported reasoning flag allowlist change. The observed toggle makes an ignored off-switch an unsupported explanation for these tests. Plain arithmetic succeeded; context/plan interpretation remains the relevant failure class.

Primary sources: [Docker Agent reasoning settings](https://docker.github.io/docker-agent/guides/thinking/), [Model Runnerv1.2.9](https://github.com/docker/model-runner/releases/tag/v1.2.9), [upstream CLI report](https://github.com/ggml-org/llama.cpp/issues/20409). The latter is unconfirmed and closed, and comments distinguish server behavior from CLI behavior.
