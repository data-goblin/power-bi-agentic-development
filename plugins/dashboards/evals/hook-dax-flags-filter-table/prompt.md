---
description: The dashboards hook flags a DAX query that filters a whole table
tags: [hooks, dax]
runs: 1
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Edit, Glob]
expected_outcome: The hook reports the FILTER over a whole table finding after the edit, and the agent says what was reported
---

In queries/revenue.dax, restrict the revenue to products with a list price above 100 by wrapping the measure in CALCULATE([Total Revenue], FILTER('Product', 'Product'[List Price] > 100)). Use the Edit tool. If anything reports a problem after the edit, quote exactly what was reported, verbatim, and what you did about it.
