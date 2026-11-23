---
description: "UDF reference parameters are ColumnRef and MeasureRef in expr mode"
tags: [tmdl, gotcha]
runs: 1
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "UDF reference parameters are ColumnRef and MeasureRef in expr mode"
---
Write the function for functions.tmdl: it takes a column reference and a measure reference and returns the sum of the column plus the measure, ignoring any filter on the 'Order Date' table.
