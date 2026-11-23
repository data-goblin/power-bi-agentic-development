---
description: "near miss: interactive report must not fire the skill"
tags: [near-miss]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "Interactive report answer without loading the paginated-report skill"
---
Create an interactive Power BI report page with two slicers and cross-filtering between visuals. Outline the steps in three bullets.
