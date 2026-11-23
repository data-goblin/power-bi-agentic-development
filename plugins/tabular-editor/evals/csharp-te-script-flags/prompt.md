---
description: "te script flags: --file, --inline, --save (no -S or -e)"
tags: [c-sharp-scripting, tool]
runs: 1
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "te script flags: --file, --inline, --save (no -S or -e)"
---
Give me the te command to run fix.csx against ./model and persist the result, and a second command that runs the one-liner foreach (var m in Model.AllMeasures) m.IsHidden = false; inline.
