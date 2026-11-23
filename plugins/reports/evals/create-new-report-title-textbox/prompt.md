---
description: "Page 1 already has a title textbox (y 20, height 90); rename the page, do not add a second textbox, start content at y 120"
tags: [create-pbi-report]
runs: 3
max_turns: 8
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "Page 1 already has a title textbox (y 20, height 90); rename the page, do not add a second textbox, start content at y 120"
---

I just created a report with pbir new report. Give me the y coordinate where my first visual should start so it does not overlap anything, and say whether I should add a title textbox.
