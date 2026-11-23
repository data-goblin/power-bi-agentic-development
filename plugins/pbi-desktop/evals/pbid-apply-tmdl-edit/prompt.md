---
description: pbir desktop refresh -m applies on-disk TMDL edits
tags:
- connect-pbid
runs: 3
max_turns: 12
timeout_seconds: 240
allowed_tools:
- Read
- Glob
- Grep
- Skill
expected_outcome: pbir desktop refresh -m applies on-disk TMDL edits
---

I edited a table's TMDL on disk while the PBIP is open in Power BI Desktop. How do I get Desktop to pick up the model change without closing it? Answer in text only. Do not run commands or create files.
