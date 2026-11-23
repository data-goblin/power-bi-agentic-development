---
description: Variant data type after adding a calculation group
tags:
- semantic-model
- gotcha
runs: 3
max_turns: 12
timeout_seconds: 240
allowed_tools:
- Read
- Glob
- Grep
- Skill
expected_outcome: Variant data type after adding a calculation group
---

I added a Time Intelligence calculation group with a dynamic format string that reads another measure, and now format strings error and my dynamic-title card shows 'Cannot convert value of type Text to type Numeric'. What happened and how do I fix both? Answer in text only. Do not run commands or create files.
