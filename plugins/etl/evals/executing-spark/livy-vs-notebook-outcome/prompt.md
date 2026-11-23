---
description: 'A Completed notebook job does not prove success; a Livy statement reports output.status'
tags: [livy, notebooks]
runs: 3
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: 'A Completed notebook job does not prove success; a Livy statement reports output.status'
---

I ran my ETL notebook with a Fabric job and it says Completed, but no rows landed. How do I find out whether it really succeeded, and how would a Livy statement differ?

Answer in text only. Do not run any command; show the exact commands you would run.
