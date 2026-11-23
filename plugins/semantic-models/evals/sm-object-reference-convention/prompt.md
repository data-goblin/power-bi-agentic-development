---
description: House convention for column and measure references
tags:
- semantic-model
runs: 3
max_turns: 12
timeout_seconds: 240
allowed_tools:
- Read
- Glob
- Grep
- Skill
expected_outcome: House convention for column and measure references
---

Write a measure Net Sales YTD for a model with table Sales (column Net Amount), a Date table with column Date, and an existing measure Net Sales. Give only the DAX.
