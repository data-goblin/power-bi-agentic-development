---
description: 'The audit script runs with uv run and the admin probe uses admin/tenantsettings'
tags: [script]
runs: 3
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: 'The audit script runs with uv run and the admin probe uses admin/tenantsettings'
---

Run a tenant governance audit for me and write the markdown report to /tmp/tenant-audit.md. Show the exact commands, including the check that I am an admin.

Answer in text only. Do not run any command; show the exact commands you would run.
