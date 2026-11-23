---
description: "an unrelated edit to an RDL whose body is too wide for the page"
tags: [rdl, hook, pdf]
runs: 1
max_turns: 16
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill, Edit]
expected_outcome: "The edit lands and the hook surfaces the PDF width trap, which gets fixed"
---
In report.rdl rename the Region textbox's value so the first column shows the region in upper case. Edit the file and tell me when it is done.
