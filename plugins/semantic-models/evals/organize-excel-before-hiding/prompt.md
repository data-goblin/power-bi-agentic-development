---
description: Excel use is not a bound report; check before IsAvailableInMDX
tags:
- organize
runs: 3
max_turns: 12
timeout_seconds: 240
allowed_tools:
- Read
- Glob
- Grep
- Skill
expected_outcome: Excel use is not a bound report; check before IsAvailableInMDX
---

Tidy a model for Copilot users: hide the technical columns and set IsAvailableInMDX to false on them. List the checks you do before changing IsAvailableInMDX. Answer in text only. Do not run commands or create files.
