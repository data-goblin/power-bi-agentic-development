---
description: 'Unattended Spark work should be a Livy batch, not a session'
tags: [livy]
runs: 3
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: 'Unattended Spark work should be a Livy batch, not a session'
---

I need a daily PySpark transformation that runs unattended against a lakehouse, with no notebook item. How should I run it through the API?

Answer in text only. Do not run any command; show the exact commands you would run.
