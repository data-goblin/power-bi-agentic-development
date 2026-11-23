---
description: "SVG measure renders black in an image visual"
tags: [svg]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "Data URIs need sourceType imageData with the measure as sourceField"
---
I bound my SVG data URI measure to an image visual with sourceType imageUrl and it renders black and logs VisualDataProxyExecutionUnknownError. What is wrong?
