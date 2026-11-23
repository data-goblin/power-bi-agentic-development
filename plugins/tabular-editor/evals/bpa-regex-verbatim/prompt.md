---
description: "Dynamic LINQ rejects @ strings; verify with te bpa run"
tags: [bpa-rules, gotcha]
runs: 1
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "Dynamic LINQ rejects @ strings; verify with te bpa run"
---
My BPA rule fails with: No property or field '@' exists in type 'Measure'. The expression is RegEx.IsMatch(Name, @"^Total \w+$"). Fix it and tell me how to confirm the rule works.
