---
name: {{SKILL_NAME}}
description: Use this skill when you need to run Docker commands on the host.
metadata:
  short-description: Use when running Docker commands
---

## Host Docker Socket

- The host Docker socket is mounted, so Docker commands act on the host.
- You may use Docker commands as needed to complete the task.
- Before finishing, ensure no containers, images, volumes, or networks are left dangling from your work.
- Do not touch or break existing Docker resources unless the user explicitly asks you to.
