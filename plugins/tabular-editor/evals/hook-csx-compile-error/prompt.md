---
description: The tabular-editor hook compiles a .csx edit and reports the compile error
tags: [hooks, csx]
runs: 1
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Edit, Glob]
expected_outcome: The hook reports the compile failure after the edit, and the agent says what was reported
---

In add-measure.csx add a third line `t.AddMeasure("Sales Rows", COUNTROWS(Sales));` with the Edit tool. If anything reports a problem after the edit, quote exactly what was reported, verbatim, and what you did about it.
