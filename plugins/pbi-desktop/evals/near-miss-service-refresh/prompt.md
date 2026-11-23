---
description: A service refresh question must not load the Desktop skill
tags:
- near-miss
runs: 3
max_turns: 12
timeout_seconds: 240
allowed_tools:
- Read
- Glob
- Grep
- Skill
expected_outcome: A service refresh question must not load the Desktop skill
---

Refresh the Sales semantic model in the Finance workspace of the Fabric service. Answer in text only. Do not run commands or create files.
