# Retired A00 findings

The A00 spike was developed on October 28, 2026. Its local executable was retired from the v0.2 branch on October 29, 2026. It was never merged into `master`. Its source remains recoverable from Git commit `96a46f6` while repository history is retained. GitHub retirement is recorded separately after the draft PR and old Project items are verified closed or removed.

## Bounded observations

- A VS Code Webview exercised explicit microphone start and stop behavior on the tested setup.
- A deterministic mock provider exercised voice lifecycle and failure states without an API key.
- Voice output cancellation and coding cancellation required separate controls and tests.
- The coding fixture exposed start, steer, interrupt, and reconciliation concepts.
- Credentials belonged in VS Code SecretStorage instead of Webview state.

## Limits

The spike did not prove speech recognition quality, realtime provider portability, local-model usefulness, extension-host authentication inheritance, safe multi-agent execution, or production recovery behavior. A mock provider did not verify a live speech service. A CLI fixture did not verify every coding backend capability.

These findings are historical constraints, not current product capabilities. Every B-series claim requires current, revision-bound evidence.
