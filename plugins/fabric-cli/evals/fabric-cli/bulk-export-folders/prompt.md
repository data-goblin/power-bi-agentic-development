---
description: 'bulk-export preserves folder structure and needs --recursive'
tags: [export]
runs: 3
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: 'bulk-export preserves folder structure and needs --recursive'
---

Export the workspace contoso-dev to ./backup with its folder structure and item bindings preserved, using fab.

Answer in text only. Do not run any command; show the exact commands you would run.
