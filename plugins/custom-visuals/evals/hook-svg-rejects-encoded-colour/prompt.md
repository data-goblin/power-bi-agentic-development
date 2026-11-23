---
description: The custom-visuals hook errors on a %23 colour in a DAX SVG measure
tags: [hooks, svg]
runs: 1
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Edit, Glob]
expected_outcome: The hook reports the %23 error after the edit, and the agent says what was reported
---

In measures.dax change the fill of the second rect from `#2a7de1` to `%232a7de1`, so the colour is URL-encoded, using the Edit tool. If anything reports a problem after the edit, say exactly what was reported and what you did about it.
