---
description: 'A setting with no curated posture must be reported as such, never invented'
tags: [baseline]
runs: 3
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: 'A setting with no curated posture must be reported as such, never invented'
---

Is the tenant setting AllowUpgradeToPlannerPersona on in our tenant, and should it be? Use the plugin's baseline for the recommendation.

Answer in text only. Do not run any command; show the exact commands you would run.
