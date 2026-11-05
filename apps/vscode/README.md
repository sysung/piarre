# Piarre

Open a trusted local Git repository, then run `Piarre: Open` from the Command Palette or select Piarre in the secondary sidebar.

Piarre opens in the secondary sidebar on the right. On first use, select **Connect with Codex** in the setup overlay. The overlay remains while connecting and offers retry guidance if connection fails. It clears after the backend confirms the connection. Its four tabs are Chat, Sessions, Agents, and Knowledge. Opening a session returns to Chat. Drafts, selected references, and model choices stay with their session when you switch tabs or restore the view. The plus menu contains local plan drafting and repository-file context; connecting Codex and sending context remain explicit actions.

Detailed proposals and agent work reviews open beside the current editor. Use **Return to chat draft** to resume the originating session. Hiding or closing the sidebar does not stop active backend work. Stop controls remain available while work is active.

Use the plus menu to search project references. Suggestions follow your message rather than a fixed source category order. Agents and repository skills have reference buttons in **Agents**. Skills are text excerpts, not instructions that automatically run an agent. Discovery includes ordinary repository `SKILL.md` files and `.agents/skills/<name>/SKILL.md`; it does not scan your home directory. Python files can be shared as text excerpts.

Repository file selection occurs when you send, followed by an exact context review. Cancelling preserves your draft. Accepting an earlier send preserves later edits to its text, model, or references. Binary images and recursive folder attachments are not supported.
