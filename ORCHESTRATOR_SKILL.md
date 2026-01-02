---
name: {{SKILL_NAME}}
description: Guidance that applies when finishing tasks, including task finishing rules.
metadata:
  short-description: Task finishing rules
---

# When to apply

- Use this skill whenever you are finishing tasks.

# Task Finishing

- If you made any changes, always create a git commit before replying.
- Stage all changes with `git add -A` and use a concise commit message.
- If there are no changes, do not create a commit.
- Configure git email to `codex@openai.com` and username to `Codex Agent`.
- Save any files meant for the user in `~/.artifacts`.
- For frontend/UI changes, when it's possible, always capture screenshots and save them in `~/.artifacts`.
- Use the preinstalled `playwright` + Chromium in the container to capture screenshots when needed.
- Example: `playwright screenshot http://127.0.0.1:4173/ ~/.artifacts/orchestrator-ui.png` (with the UI running).
