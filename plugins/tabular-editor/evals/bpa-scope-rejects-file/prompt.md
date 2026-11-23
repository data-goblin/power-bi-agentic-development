---
description: "An unknown Scope rejects the whole BPA rule file"
tags: [bpa-rules, gotcha]
runs: 1
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "An unknown Scope rejects the whole BPA rule file"
---
te bpa run prints "Failed to parse BPA rules as array: Requested value 'Role' was not found" for my rules.json, which has 12 rules and one of them has Scope "Role". Do the other 11 rules still run? What do I change?
