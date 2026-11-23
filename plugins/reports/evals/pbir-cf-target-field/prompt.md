---
description: "Uses pbir visuals cf with --rules, --field Margin %, --on values.* and --target-field Revenue"
tags: [pbir-cli]
runs: 3
max_turns: 8
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "Uses pbir visuals cf with --rules, --field Margin %, --on values.* and --target-field Revenue"
---

Using pbir, colour the Revenue column of a table visual red when the Margin % measure is below zero. Give the exact command. Do not run anything.
