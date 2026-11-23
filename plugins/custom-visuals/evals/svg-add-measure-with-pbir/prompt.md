---
description: "adding the SVG measure to a report"
tags: [svg, pbir]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "pbir dax measures add --data-category ImageUrl, visuals bind, table-density"
---
The SVG measure expression is ready. Give the exact pbir commands to add it to Sales.Report as a report-level measure on table Sales named 'Bar SVG', bind it to the table visual Tbl on page Overview, and set the image size to 24 high and 110 wide.
