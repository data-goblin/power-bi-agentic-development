---
description: "Deneb 2.0 row limit and context menu properties"
tags: [deneb]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "30,000 rows, override not guaranteed for PDF/PPT, enableContextMenuSelector"
---
What is the default number of rows a Deneb 2.0 visual loads, does the row limit override help a PDF export, and which visual.json property turns off data point resolution in the right-click menu while keeping the menu itself?
