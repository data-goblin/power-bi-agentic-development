---
description: Intra-model dependencies must not load the cross-workspace lineage skill
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
expected_outcome: Intra-model dependencies must not load the cross-workspace lineage skill
---

Which measures inside my model depend on [Total Sales]? I only need the dependency list. Answer in text only. Do not run commands or create files.
