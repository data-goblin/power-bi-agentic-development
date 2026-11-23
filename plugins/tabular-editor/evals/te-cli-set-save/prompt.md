---
description: "te mutations are dry runs until --save, and the model is a flag"
tags: [te-cli, gotcha]
runs: 1
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "te mutations are dry runs until --save, and the model is a flag"
---
Using the te CLI, set the format string of measure Total Sales in table Sales to #,0 for the model in ./model and make sure the change is written to disk. Give the command.
