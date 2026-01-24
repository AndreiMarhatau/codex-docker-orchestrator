# Task finishing

## Committing changes
- If you made any changes, always create a git commit after all your work and verifications, just before replying.
- Stage all changes with `git add -A` and use a concise commit message.
- If there are no changes, do not create a commit.
- Configure git email to `codex@openai.com` and username to `Codex Agent`.

## Miscellaneous files and artifacts
- Save any files meant for the user in `~/.artifacts` - user will be able to see them in their UI automatically.
- For frontend/UI changes, when it's possible, capture screenshots and save them in `~/.artifacts` so that user can see your work earlier and provide feedback for you.
- Use the preinstalled `playwright` + Chromium in the container to capture screenshots in browser when needed. Example: `playwright screenshot http://127.0.0.1:4173/ ~/.artifacts/example-screenshot.png` (with the UI running).
