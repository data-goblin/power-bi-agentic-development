---
description: "-L after -D is -LOGIN; te has no equivalent, use te auth"
tags: [te2-cli, gotcha]
runs: 1
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "-L after -D is -LOGIN; te has no equivalent, use te auth"
---
Port this deploy to the cross-platform te CLI: TabularEditor.exe Model.bim -D myserver SalesModel -O -L user pass
