---
description: Framing needs --execute; there is no --dry-run flag
tags:
- semantic-model
- te
runs: 3
max_turns: 12
timeout_seconds: 240
allowed_tools:
- Read
- Glob
- Grep
- Skill
expected_outcome: Framing needs --execute; there is no --dry-run flag
---

I deployed new Direct Lake tables to the workspace through XMLA and every query errors. Give the te command that fixes it. Answer in text only. Do not run commands or create files.
