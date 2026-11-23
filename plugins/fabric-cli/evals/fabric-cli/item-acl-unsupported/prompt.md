---
description: 'fab has no item-level ACL; the answer must not invent acl set on an item'
tags: [acl, gotcha]
runs: 3
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: 'fab has no item-level ACL; the answer must not invent acl set on an item'
---

Give alice (Entra object id 11111111-2222-3333-4444-555555555555) read access to the semantic model 'Contoso 100M' in workspace contoso-dev using the fab CLI.

Answer in text only. Do not run any command; show the exact commands you would run.
