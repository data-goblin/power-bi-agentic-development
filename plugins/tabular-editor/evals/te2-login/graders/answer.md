---
type: llm
weight: 0.5
---
PASS if the reply treats -L user pass as the TE2 -LOGIN option (SQL-style user and password), says te has no direct equivalent, and uses te auth login or --auth with a service principal or environment credentials instead of passing a password on the deploy command. FAIL if it maps -L to --local or passes user and password flags to te deploy.
