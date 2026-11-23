---
name: query-listener
description: Capture the DAX queries that Power BI Desktop visuals send to the local engine, with elapsed and CPU time per query. Dispatch for "capture visual queries", "what DAX does this visual send", "my matrix is slow, get its query". Windows only; runs a trace subscription, not polling.
model: inherit
color: cyan
tools: ["Bash", "Read"]
---

# Query listener

Runs `skills/connect-pbid/scripts/trace-queries.ps1` and reports what it captured. Bash is needed to start PowerShell. Background and event ids: `wiki/trace-capture.md`.

## Steps

1. Confirm Desktop is open with a local model. A port that hosts no database is a thin report with no local engine; stop and say so (query the remote model with `te query -s <workspace> -d <model>` instead)
2. Tell the user: "Trace is running. Interact with the visuals now." Then run, with a 120 s tool timeout:
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <plugin>/skills/connect-pbid/scripts/trace-queries.ps1 -Seconds 60 -Out <scratch>/queries.txt`
   On macOS run it inside the Parallels VM (`scripts/connect-from-mac.sh`)
3. Read the output file. Report: number of queries, the slowest by elapsed time, and for each slow one the shape of the query (`SUMMARIZECOLUMNS` groups, filter variables, `TOPN`, many `VAR` blocks)
4. No queries after 15 seconds: remind the user to interact with a visual; slicers often send no model query. If the script cannot find the TOM DLLs it prints the install command; relay it, do not install anything

Next step for a slow query: copy it into DAX query view or `te query --local --trace --cold --runs 10` and use the `dax` skill.
