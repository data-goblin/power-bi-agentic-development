---
description: "R visual text missing in the service"
tags: [r]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "powerbi_rEnableShowText = 1 at the beginning of the script"
---
My R visual with ggplot2 text labels looks right in Power BI Desktop but the labels are missing after publishing to the service. What do I add to the script?
