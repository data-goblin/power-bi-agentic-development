---
description: "near miss: web SVG must not fire the skill"
tags: [near-miss]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "Writes plain SVG without loading the Power BI SVG skill"
---
Draw a simple rocket icon as inline SVG for my website footer, 32x32, one colour.
