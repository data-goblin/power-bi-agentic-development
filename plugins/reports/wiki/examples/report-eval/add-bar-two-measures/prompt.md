---
description: Add a bar chart that compares two measures by a category, then validate the report
tags: [report-authoring, gate-and-rubric]
runs: 3
max_turns: 20
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Edit, Write, Bash, Skill]
expected_outcome: A clusteredBarChart named sales_returns on page Overview, bound to Product Category, Total Sales and Returned Sales, with the validation output saved
---

In Bikes.Report add a clustered bar chart to the Overview page. Name the visual sales_returns and give it a title. It compares Total Sales and Returned Sales for each Product Category. Place it so it does not overlap anything and give both measures a number format. Then run `pbir validate Bikes.Report --fields` and save its output to validate.log.
