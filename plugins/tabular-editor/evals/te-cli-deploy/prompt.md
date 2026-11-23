---
description: "te deploy needs --execute and --force in CI"
tags: [te-cli, gotcha]
runs: 1
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "te deploy needs --execute and --force in CI"
---
Give me the te command that deploys ./model to the workspace Dev as the database SalesModel in a CI pipeline without prompting.
