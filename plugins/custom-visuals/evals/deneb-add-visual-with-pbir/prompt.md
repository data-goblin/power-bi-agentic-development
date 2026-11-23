---
description: "adding a Deneb visual with released pbir"
tags: [deneb, pbir]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "Uses pbir cp or a hand-added publicCustomVisuals entry, binds fields, injects the spec, no invented add command"
---
Using the pbir CLI, add a Deneb bar chart of Revenue by Category to page Overview of Sales.Report. List the exact commands. If pbir has no command for a step, say so plainly.
