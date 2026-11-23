---
description: "adding a Python visual with pbir"
tags: [python, pbir]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "pbir add visual pythonVisual with -d Values:..., pbir visuals python --script-file"
---
With the pbir CLI, add a Python visual named PyChart to page Overview of Sales.Report bound to Sales.Date and Sales.Revenue, then load the script chart.py into it. Give only the commands.
