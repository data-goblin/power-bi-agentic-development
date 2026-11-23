---
description: "A relationship has no Description property, so /// is a parse error"
tags: [tmdl, gotcha]
runs: 1
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "A relationship has no Description property, so /// is a parse error"
---
In definition/relationships.tmdl, add a description saying 'Orders to Date on order date' to the relationship that has fromColumn: Orders.'Order Date'. Show the edited relationship block.
