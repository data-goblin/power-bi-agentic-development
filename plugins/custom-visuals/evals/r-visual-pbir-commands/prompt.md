---
description: "adding an R visual with pbir"
tags: [r, pbir]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "pbir add visual scriptVisual with -d Values:..., pbir visuals r --script-file"
---
With the pbir CLI, add an R visual named RChart to page Overview of Sales.Report bound to Sales.Date and Sales.Revenue, then load the script chart.R into it. Give only the commands.
