---
description: A UDF with an optional parameter and its GA status
tags:
- dax
- udf
runs: 3
max_turns: 12
timeout_seconds: 240
allowed_tools:
- Read
- Glob
- Grep
- Skill
expected_outcome: A UDF with an optional parameter and its GA status
---

Write a DAX user-defined function Finance.AddTax with an optional taxRate parameter that defaults to 10 percent, show how to call it without the argument, and say whether UDFs are still preview. Answer in text only. Do not run commands or create files.
