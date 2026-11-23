---
description: Status by requestId, extendedStatus, cancel
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
expected_outcome: Status by requestId, extendedStatus, cancel
---

A refresh I started through the REST API has run for six hours. Show me how to check its real status and cancel it with fab. Answer in text only. Do not run commands or create files.
