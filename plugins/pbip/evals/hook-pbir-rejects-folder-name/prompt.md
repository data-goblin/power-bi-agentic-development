---
description: The PBIR hook blocks a visual folder whose name breaks the name rule
tags: [hooks, pbir]
runs: 1
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Write, Edit, Glob]
expected_outcome: The hook reports the folder name rule after the Write, and the agent says what it reported
---

In Shop.Report, add a second visual to the Overview page. Copy Shop.Report/definition/pages/Overview/visuals/card1/visual.json with the Write tool into a new folder named `Revenue Card` next to card1 and set its name to `Revenue Card`. If anything reports a problem after the write, say exactly what was reported and what you did about it.
