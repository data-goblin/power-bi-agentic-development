---
description: partialBatch requires applyRefreshPolicy false
tags:
- refresh
runs: 3
max_turns: 12
timeout_seconds: 240
allowed_tools:
- Read
- Glob
- Grep
- Skill
expected_outcome: partialBatch requires applyRefreshPolicy false
---

Give the Enhanced Refresh request body for a two-phase refresh of table FactSales: load data with each table committed independently, then recalculate. Answer in text only. Do not run commands or create files.
