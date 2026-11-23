---
description: The TMDL hook runs te validate after an edit and reports a line TMDL cannot parse
tags: [hooks, tmdl]
runs: 1
max_turns: 10
timeout_seconds: 300
allowed_tools: [Read, Edit, Glob]
expected_outcome: The hook reports the parse failure on the // line, and the agent leaves model.tmdl valid
---

In Shop.SemanticModel/definition/model.tmdl, add the comment line `// owner: finance` directly below the `model Model` line. Use the Edit tool. If anything reports a problem after the edit, fix the file so the model is valid again, and then say what was reported.
