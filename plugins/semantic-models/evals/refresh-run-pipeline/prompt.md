---
description: fab job run, not fab run
tags:
- refresh
- fab
runs: 3
max_turns: 12
timeout_seconds: 240
allowed_tools:
- Read
- Glob
- Grep
- Skill
expected_outcome: fab job run, not fab run
---

Run the data pipeline 'Load' in workspace 'Finance' and wait for it, then refresh the semantic model. Give the fab commands. Answer in text only. Do not run commands or create files.
