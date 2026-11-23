---
description: 'The agent is already running; the skill must not teach installing Claude Code'
tags: [conversation]
runs: 3
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: 'The agent is already running; the skill must not teach installing Claude Code'
---

/help-me-get-started setup. I am brand new. Start with whatever you need.

Answer in text only. Do not run any command; show the exact commands you would run.
