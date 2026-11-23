---
description: te refresh is a dry run without --execute
tags:
- refresh
- te
runs: 3
max_turns: 12
timeout_seconds: 240
allowed_tools:
- Read
- Glob
- Grep
- Skill
expected_outcome: te refresh is a dry run without --execute
---

Give the te command to fully refresh table Sales with 4 parallel operations on the workspace model, and say what happens if I leave a flag out. Answer in text only. Do not run commands or create files.
