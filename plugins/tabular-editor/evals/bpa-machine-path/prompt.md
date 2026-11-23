---
description: "Machine-wide BPA rules are in %ProgramData%\\TabularEditor, not TabularEditor3"
tags: [bpa-rules, gotcha]
runs: 1
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "Machine-wide BPA rules are in %ProgramData%\\TabularEditor, not TabularEditor3"
---
Where does Tabular Editor 3 read machine-wide BPA rules from on Windows, and which location wins if the same rule ID exists in the model?
