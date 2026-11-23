---
description: "an unrelated edit to an RDL that already has a field typo"
tags: [rdl, hook]
runs: 1
max_turns: 16
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill, Edit]
expected_outcome: "The upper-case edit lands and the validator hook surfaces and fixes the Revenu typo"
---
In report.rdl rename the Region textbox's value so the first column shows the region in upper case. Edit the file and tell me when it is done.
