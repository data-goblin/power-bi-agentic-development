---
description: 'Semantic model changes go te CLI first, then an MCP, then connect-pbid, TMDL by hand last'
tags: [install-map]
runs: 3
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: 'Semantic model changes go te CLI first, then an MCP, then connect-pbid, TMDL by hand last'
---

/help-me-get-started setup. I want Claude to change my semantic model. Which tools do you install, and in what order of preference does the agent use them?

Answer in text only. Do not run any command; show the exact commands you would run.
