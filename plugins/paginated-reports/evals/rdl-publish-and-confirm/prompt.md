---
description: "publishing and confirming with the bundled scripts"
tags: [rdl, publish]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "publish_rdl.sh then export_rdl.sh to PDF"
---
Publish report.rdl to workspace 11111111-2222-3333-4444-555555555555 where a report with that name already exists, then confirm it renders to a non-empty PDF. Give the exact commands.
