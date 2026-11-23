---
description: "Deneb template v2 placeholders"
tags: [deneb, templates]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "__dataset.N__ placeholders, strip usermeta, pbir visuals deneb --spec-file"
---
A colleague sent a Deneb template that uses a Deneb 2.0 template header with "metaVersion": 2 and a "datasets" record. I need to apply it to a visual from a terminal without the Deneb UI. What do the placeholder keys look like, what must I strip from the spec before injecting it, and which command injects it?
