---
description: The RDL hook reports the PDF width trap when an edit makes body width plus margins exceed the page
tags: [hooks, rdl]
runs: 1
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Edit, Glob]
expected_outcome: The hook reports the PDF width trap after the margin edit, and the agent says what was reported
---

In report.rdl change the LeftMargin from 0.5in to 1in with the Edit tool. If anything reports a problem after the edit, say exactly what was reported and what you did about it.
