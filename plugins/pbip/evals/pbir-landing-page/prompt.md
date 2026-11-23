---
description: "pagesMetadata landingPageName beats activePageName"
tags: [pbir-format, gotcha]
runs: 1
max_turns: 8
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "pagesMetadata landingPageName beats activePageName"
---
My report's pages.json has activePageName set to 'Summary' and landingPageName set to 'Overview'. Which page does the report open on for users?
