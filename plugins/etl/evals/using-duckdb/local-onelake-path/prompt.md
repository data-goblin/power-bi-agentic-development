---
description: 'OneLake paths use GUIDs and the cli credential chain'
tags: [path]
runs: 3
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: 'OneLake paths use GUIDs and the cli credential chain'
---

Using DuckDB on my laptop, count the rows of gold.orders in lakehouse SalesLH in workspace 'Contoso Dev'.

Answer in text only. Do not run any command; show the exact commands you would run.
