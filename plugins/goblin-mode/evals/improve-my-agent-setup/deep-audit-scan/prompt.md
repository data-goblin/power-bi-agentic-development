---
description: 'A deep audit starts with scan_setup.py and writes a report to .claude/scratchpads'
tags: [audit]
runs: 3
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: 'A deep audit starts with scan_setup.py and writes a report to .claude/scratchpads'
---

Audit my agent setup in deep mode. What exactly will you run first and where will the report go?

Answer in text only. Do not run any command; show the exact commands you would run.
