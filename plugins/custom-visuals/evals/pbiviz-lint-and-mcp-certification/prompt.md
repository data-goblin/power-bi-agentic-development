---
description: "certification checks with the toolchain and MCP server"
tags: [pbiviz, certification]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "pbiviz lint, package --certification-audit, MCP prepare_certification and check_vulnerabilities"
---
I want to check my pbiviz project against the certification rules before I submit it. Which pbiviz commands do I run, and which tools of the pbiviz MCP server should an agent call?
