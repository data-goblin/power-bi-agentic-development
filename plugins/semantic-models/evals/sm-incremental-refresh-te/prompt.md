---
description: Incremental refresh policy through te set
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
expected_outcome: Incremental refresh policy through te set
---

With the te CLI, configure incremental refresh on table Orders of ./model: keep 5 years, refresh the last 10 days. Commands only. Answer in text only. Do not run commands or create files.
