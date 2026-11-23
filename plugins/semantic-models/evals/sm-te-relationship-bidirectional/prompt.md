---
description: te can set CrossFilteringBehavior; relationships need no -t
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
expected_outcome: te can set CrossFilteringBehavior; relationships need no -t
---

Using the te CLI on a TMDL folder ./model, give the commands to add a relationship Orders[Customer Key] to Customers[Customer Key], make it bidirectional, and save. Commands only, no prose. Answer in text only. Do not run commands or create files.
