---
description: "how to check an RDL before publishing"
tags: [rdl]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "Names the bundled validate_rdl.py"
---
Before I publish report.rdl I want a deterministic structural check that also catches the PDF blank-page width problem and misspelled Fields! references. What exactly do I run?
