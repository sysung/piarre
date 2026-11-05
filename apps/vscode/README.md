# Piarre

Open a trusted local Git repository, then run `Piarre: Open` from the Command Palette or select Piarre in the secondary sidebar.

Piarre opens in the secondary sidebar on the right. On first use, select **Connect with Codex** in the setup overlay. The overlay remains while connecting and offers retry guidance if connection fails. It clears after the backend confirms the connection. Its four tabs are Chat, Sessions, Agents, and Knowledge. Opening a session returns to Chat. Drafts, selected references, and model choices stay with their session when you switch tabs or restore the view. The plus menu contains local plan drafting and repository-file context; connecting Codex and sending context remain explicit actions.

Detailed proposals and agent work reviews open beside the current editor. Use **Return to chat draft** to resume the originating session. Hiding or closing the sidebar does not stop active backend work. Stop controls remain available while work is active.

Use the plus menu to search project references. Suggestions follow your message rather than a fixed source category order. Agents and repository skills have reference buttons in **Agents**. Skills are text excerpts, not instructions that automatically run an agent. Discovery includes ordinary repository `SKILL.md` files and `.agents/skills/<name>/SKILL.md`; it does not scan your home directory. Python files can be shared as text excerpts.

Repository file selection occurs when you send, followed by an exact context review. Cancelling preserves your draft. Accepting an earlier send preserves later edits to its text, model, or references. Binary images and recursive folder attachments are not supported.

### Offline setup and local discussion

Choose **Continue offline** during first use to inspect the project and draft deterministic plans without connecting or calling a provider. The choice and unsent session drafts stay in webview state. Sending remains disabled until an explicit provider connection.

For optional discussion, inspect the installed Docker CLI with `docker model --help` and explicitly install the configured candidate with `docker model pull docker.io/ai/qwen3.5:4b-q6_K` if needed. Start Docker Model Runner yourself with an 8,192-token context configured using the installed CLI’s supported settings, then use **+ → Connect local model**. Piarre never downloads a model, starts Docker, executes local agent work, or falls back to Codex. The model picker preserves each session's provider/model preference. Switching providers disconnects discussion and requires an explicit connection; coding and coordination continue to use their existing Codex preflights.

Machine settings `piarre.localDiscussion.endpoint`, `.model`, and `.digest` use global values only. Workspace overrides are ignored. The endpoint must be exactly `http://model-runner.docker.internal/engines/v1` or a literal loopback HTTP address ending in `/engines/v1`. Direct HTTP bypasses environment proxies and rejects redirects. The provisional configured model is `docker.io/ai/qwen3.5:4b-q6_K`, with operator-configured digest `ea484046efba5fc126b1b331c2d590a20cb7d3abdfc65366a7f8b547350cd629`. Configuration is not independent verification of installed weights. Responses retain the actual observed model locator and optional response ID; local requests have no fabricated Codex thread/turn IDs.

Every send reviews the exact prompt, provider, model, session and source revision before dispatch. Local discussion admits at most 6,000 UTF-8 prompt bytes, requests at most 1,024 output tokens, reads at most 65,536 response bytes, and times out after 60 seconds. The byte policy is conservative admission, not a proven general tokenizer/template bound for an 8,192-token runtime context. Requests disable thinking via `chat_template_kwargs.enable_thinking=false` and request a strict JSON schema; Piarre independently validates every summary and citation index. No source is silently trimmed.

Stop cancels local HTTP delivery, records unknown completion, and requires explicit reconnect. Backend compute may continue. No retry, fallback, zero-usage claim, or confirmed GPU termination is implied. HTTP fixture tests prove boundary behavior; actual model quality, Metal use, installed digest and backend cancellation require separate runtime evidence.
