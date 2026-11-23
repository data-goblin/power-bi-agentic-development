---
description: "DAX SVG progress bar"
tags: [svg]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "utf8 data URI, plain # hex, ImageUrl data category"
---
Write a DAX measure that returns an SVG progress bar (teal fill #2B7A78 on a light grey track) showing [Sales] against [Target], for a table cell. Return only the measure and one line on what else I must set.
