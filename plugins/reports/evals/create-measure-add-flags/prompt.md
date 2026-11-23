---
description: "Uses -t Sales, -n, -e and -d Text (data type is required)"
tags: [create-pbi-report, pbir-cli]
runs: 3
max_turns: 8
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "Uses -t Sales, -n, -e and -d Text (data type is required)"
---

Give me the exact pbir command to add a report measure called Status Color on the Sales table that returns "good" or "bad" based on [Revenue] vs [Target].
