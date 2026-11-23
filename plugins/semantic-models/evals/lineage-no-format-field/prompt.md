---
description: The reports REST response has no PBIR format field
tags:
- lineage
- gotcha
runs: 3
max_turns: 12
timeout_seconds: 240
allowed_tools:
- Read
- Glob
- Grep
- Skill
expected_outcome: The reports REST response has no PBIR format field
---

List the reports bound to my semantic model and tell me which of them are PBIR versus legacy format using the Power BI REST reports API. Answer in text only. Do not run commands or create files.
