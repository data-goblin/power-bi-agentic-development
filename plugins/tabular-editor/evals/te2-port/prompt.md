---
description: "Port a TE2 pipeline command with te util migrate"
tags: [te2-cli, tool]
runs: 1
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "Port a TE2 pipeline command with te util migrate"
---
Port this Azure DevOps pipeline step to the cross-platform te CLI: TabularEditor.exe Model.bim -A rules.json -V -T results.trx
