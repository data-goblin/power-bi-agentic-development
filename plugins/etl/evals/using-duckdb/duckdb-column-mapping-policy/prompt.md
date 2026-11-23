---
description: 'DuckDB 2.0 defaults delta_column_mapping_policy to strict'
tags: [delta]
runs: 3
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: 'DuckDB 2.0 defaults delta_column_mapping_policy to strict'
---

After upgrading from DuckDB 1.5 to 2.0, reading one Delta table from my lakehouse fails with a column mapping id-mode error although it worked before. What changed and how do I fix it?

Answer in text only. Do not run any command; show the exact commands you would run.
