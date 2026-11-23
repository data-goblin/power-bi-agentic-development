---
description: SelfValue semantics after the June 2024 SUMMARIZECOLUMNS change
tags:
- dax
- gotcha
runs: 3
max_turns: 12
timeout_seconds: 240
allowed_tools:
- Read
- Glob
- Grep
- Skill
expected_outcome: SelfValue semantics after the June 2024 SUMMARIZECOLUMNS change
---

I rewrote a measure from SUMMARIZE to SUMMARIZECOLUMNS to make it faster and now it returns extra rows when a slicer on a related table is applied. Why, and how do I keep the old behaviour? Answer in text only. Do not run commands or create files.
