---
description: "byConnection reaches Fabric models only; other AS models need byPath with modelReference.json"
tags: [pbip, gotcha]
runs: 1
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "byConnection reaches Fabric models only; other AS models need byPath with modelReference.json"
---
My thin report's definition.pbir should point at an on-premises SSAS model: server ssas01, database SalesModel. Write the datasetReference for definition.pbir.
